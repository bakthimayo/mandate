/**
 * Airline Chatbot Demo - TypeScript Example
 *
 * This example demonstrates how a third-party chatbot integrates with Mandate
 * to intercept and govern unverified claims before they reach customers.
 *
 * Flow:
 * 1. Chatbot generates draft response
 * 2. Submit to Mandate pre-delivery via SDK
 * 3. Observe phase populates signals from unstructured text
 * 4. Policy evaluation produces verdict
 * 5. Chatbot sends safe response based on verdict
 * 6. Audit trail recorded
 *
 * RFC-002 v1.2 Compliance:
 * - organization_id is explicitly provided (required, top-level)
 * - domain_name is explicitly provided (required, top-level)
 * - scope includes organization_id and domain_name (required)
 * - No inference or defaults - caller provides full attribution
 * - All decisions and verdicts are persisted in the database via SDK
 *
 * Key principles:
 * - Request decision BEFORE sending response
 * - Respect all verdicts (ALLOW, BLOCK, PAUSE, OBSERVE)
 * - Report outcome after response is sent
 * - Never bypass verdicts - treat them as governance signals
 */

import 'dotenv/config';
import { MandateClient } from '@mandate/sdk';

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOMAIN = 'customer-support';

const client = new MandateClient({
  baseUrl: process.env.MANDATE_URL ?? 'http://localhost:3001',
  apiKey: process.env.MANDATE_API_KEY,
});

// ============================================================================
// PART 1: Chatbot Generates Draft Response
// ============================================================================

/**
 * Simulated third-party LLM chatbot with context-aware responses.
 * Knows nothing about Mandate governance.
 */
async function generateChatbotDraftResponse(
  userMessage: string,
  flightStatus?: string,
  bookingAmount?: number
): Promise<string> {
  // In production, this would call an external LLM service (e.g., OpenAI)
  
  const isRefundRequest = userMessage.toLowerCase().includes('refund') || 
                          userMessage.toLowerCase().includes('cancel') ||
                          userMessage.toLowerCase().includes('money back');

  if (!isRefundRequest) {
    return `Your booking is confirmed. How can I help you further?`;
  }

  // Context-aware refund response based on flight status
  const amount = bookingAmount || 500;
  
  if (flightStatus === 'departed') {
    return `I understand your flight has already departed. Regarding the refund: \
for flights that have already departed, we typically cannot offer refunds. \
However, let me check what options might be available for you. \
The amount of $${amount} would normally be refundable if eligible.`;
  }

  if (flightStatus === 'completed') {
    return `Your flight has been completed. For completed flights, refunds are generally \
not available. However, we can explore if you're eligible for a credit or alternative solution.`;
  }

  if (flightStatus === 'scheduled') {
    return `Yes, you can receive a full refund of $${amount} for your booking. \
This will be processed to your original payment method immediately \
without any deduction or fee.`;
  }

  // Default refund response
  return `Yes, you can receive a refund of $${amount} for your booking. \
This will be processed to your original payment method immediately \
without any deduction or fee.`;
}

// ============================================================================
// PART 2: Signal Extraction from Unstructured Response
// ============================================================================

/**
 * Extracts flight status from user message context
 */
function extractFlightStatusFromMessage(text: string): string | undefined {
  const flightStatusPatterns = [
    { status: 'departed', patterns: ['already left', 'already departed', 'already flew', 'flight left', 'flight departed', 'has departed', 'took off'] },
    { status: 'completed', patterns: ['already completed', 'flight completed', 'past month', 'last month', 'already finished', 'completed flight'] },
    { status: 'cancelled', patterns: ['cancelled', 'canceled', 'cancelled flight'] },
    { status: 'scheduled', patterns: ['scheduled', 'next week', 'upcoming', 'future flight', 'booking for'] },
  ];

  for (const { status, patterns } of flightStatusPatterns) {
    for (const pattern of patterns) {
      if (new RegExp(`\\b${pattern}\\b`, 'i').test(text)) {
        return status;
      }
    }
  }
  return undefined;
}

/**
 * Simulates Observe phase: extracts signals deterministically from draft response
 * Mimics DeterministicExtractors from signal-populator.ts
 */
function extractSignalsFromResponse(text: string): Record<string, any> {
  const signals: Record<string, any> = {};

  // Extract currency/monetary value
  const currencyPattern = /\$\s*(\d+(?:\.\d+)?)/;
  const currencyMatch = text.match(currencyPattern);
  if (currencyMatch) {
    signals.has_monetary_value = true;
    signals.monetary_amount = parseFloat(currencyMatch[1]);
  } else {
    signals.has_monetary_value = false;
  }

  // Extract policy keyword
  const keywords = ['refund', 'charge', 'fee', 'escalate'];
  for (const keyword of keywords) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      signals.policy_keyword = keyword;
      break;
    }
  }

  // Extract escalation indicator
  const escalationWords = ['immediately', 'automatic', 'without exception', 'without deduction', 'right away'];
  let requiresEscalation = false;
  for (const word of escalationWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
      requiresEscalation = true;
      break;
    }
  }
  signals.requires_escalation = requiresEscalation;

  return signals;
}

// ============================================================================
// PART 3: Safe Fallback Response
// ============================================================================

/**
 * Safe fallback response for PAUSE verdicts
 */
const SAFE_FALLBACK_RESPONSE = `Thank you for your question about refunds. Your request requires review \
by our compliance team to ensure we provide you with the correct information \
about your specific refund eligibility.

A specialist will reach out to you within 1 business day with a confirmed \
answer.

We appreciate your patience!`;

// ============================================================================
// PART 4: Chatbot Integration with Mandate
// ============================================================================

/**
 * Main chatbot function that integrates Mandate governance
 */
async function chatbotWithGovernance(
  userMessage: string,
  customerId: string,
  bookingId: string,
  bookingAmount?: number
): Promise<string> {
  // =========================================================================
  // Step 0: Detect flight status from user message (before draft response)
  // =========================================================================
  const flightStatus = extractFlightStatusFromMessage(userMessage);

  // =========================================================================
  // Step 1: Generate draft response (chatbot unaware of governance)
  // =========================================================================
  console.log('\n[CHATBOT] Step 1: Generating draft response...');
  const draftResponse = await generateChatbotDraftResponse(userMessage, flightStatus, bookingAmount);
  console.log('[CHATBOT] Draft response:', draftResponse);

  // =========================================================================
  // Step 2: Extract signals from draft response (Observe phase)
  // =========================================================================
  console.log('\n[OBSERVE] Step 2: Extracting signals from draft response...');
  const signals = extractSignalsFromResponse(draftResponse);
  if (flightStatus) {
    signals.flight_status = flightStatus;
    console.log(`[OBSERVE] ✓ Merged flight status: "${flightStatus}"`);
  }
  console.log('[OBSERVE] Final extracted signals:', JSON.stringify(signals, null, 2));

  // =========================================================================
  // Step 3: Submit to Mandate for pre-delivery governance
  // =========================================================================
  console.log('\n[CHATBOT] Step 3: Submitting to Mandate for governance...');

  let result;
  try {
    result = await client.requestDecision({
      organization_id: ORGANIZATION_ID,
      domain_name: DOMAIN,
      intent: 'issue_refund',
      stage: 'pre_commit',
      actor: 'chatbot-v3',
      target: `customer:${customerId}`,
      context: {
        customer_id: customerId,
        booking_id: bookingId,
        cancellation_reason: 'customer_request',
        ...signals, // Merge extracted signals into context
      },
      scope: {
        organization_id: ORGANIZATION_ID,
        domain_name: DOMAIN,
        agent: 'chatbot-v3',
        service: 'chat-api',
        environment: 'production',
      },
    });
  } catch (error: any) {
    console.error('[CHATBOT] ERROR: Mandate submission failed:', error.message);
    return 'Unable to process your request at this time.';
  }

  // =========================================================================
  // Step 4: Policy evaluation results
  // =========================================================================
  console.log('\n[CHATBOT] Step 4: Policy evaluation results...');
  console.log('[POLICY] Decision context:', JSON.stringify(result.decision.context, null, 2));

  // =========================================================================
  // Step 5: Handle verdict
  // =========================================================================
  console.log('\n[CHATBOT] Step 5: Handling verdict...');
  console.log(`[VERDICT] Verdict: ${result.verdict.verdict}`);
  console.log(
    `[VERDICT] Matched policies: ${result.verdict.matched_policy_ids.join(', ') || 'none'}`
  );

  let finalResponse: string;

  switch (result.verdict.verdict) {
    case 'PAUSE':
      console.log('[CHATBOT] Verdict is PAUSE - sending safe fallback response');
      console.log(`[ESCALATION] Decision paused. Requires review by: ${result.verdict.owning_team}`);
      finalResponse = SAFE_FALLBACK_RESPONSE;
      break;

    case 'BLOCK':
      console.log('[CHATBOT] Verdict is BLOCK - blocking response entirely');
      finalResponse = 'Unable to process your request at this time.';
      break;

    case 'ALLOW':
      console.log('[CHATBOT] Verdict is ALLOW - sending original draft response');
      finalResponse = draftResponse;
      break;

    default:
      console.log('[CHATBOT] Verdict is OBSERVE - sending original draft response');
      finalResponse = draftResponse;
  }

  // =========================================================================
  // Step 6: Report outcome
  // =========================================================================
  console.log('\n[CHATBOT] Step 6: Reporting response delivery...');
  try {
    await client.reportOutcome({
      decision_id: result.decision.decision_id,
      success: true,
      details: {
        response_sent_at: new Date().toISOString(),
        response_length: finalResponse.length,
        verdict_applied: result.verdict.verdict,
      },
    });
    console.log('[OUTCOME] Response delivered and logged');
  } catch (error) {
    console.error('[OUTCOME] Failed to report outcome:', error);
  }

  // =========================================================================
  // Step 7: Audit trail
  // =========================================================================
  console.log('\n[AUDIT] Timeline entries recorded:');
  console.log(`  - Decision ID: ${result.decision.decision_id}`);
  console.log(`  - Verdict ID: ${result.verdict.verdict_id}`);
  console.log(`  - Verdict: ${result.verdict.verdict}`);
  console.log(`  - Spec: ${result.verdict.spec_id} v${result.verdict.spec_version}`);
  console.log(`  - Scope ID: ${result.verdict.scope_id}`);
  console.log(`  - Domain: ${result.verdict.domain_name}`);

  return finalResponse;
}

// ============================================================================
// PART 5: Demo Execution
// ============================================================================

async function runDemo() {
  // Test scenarios with different flight statuses
  const scenarios = [
    {
      name: 'Departed Flight - High Risk Refund',
      userMessage: 'My flight already left, can I get refund?',
      customerId: 'C123456',
      bookingId: 'BK6613',
      amount: 250,
    },
    {
      name: 'Scheduled Flight - Standard Refund',
      userMessage: 'Can I cancel my booking for next week? I want a refund.',
      customerId: 'C123457',
      bookingId: 'BK7824',
      amount: 450,
    },
    {
      name: 'Completed Flight - No Refund',
      userMessage: 'My flight completed last month. Can I get my money back?',
      customerId: 'C123458',
      bookingId: 'BK5291',
      amount: 550,
    },
  ];

  for (const scenario of scenarios) {
    console.log('\n' + '='.repeat(80));
    console.log(`SCENARIO: ${scenario.name}`);
    console.log('='.repeat(80));

    console.log(`\n👤 Customer: "${scenario.userMessage}"`);
    console.log(`📋 Booking ID: ${scenario.bookingId}`);
    console.log(`💰 Amount: $${scenario.amount}`);

    const response = await chatbotWithGovernance(
      scenario.userMessage,
      scenario.customerId,
      scenario.bookingId,
      scenario.amount
    );

    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESPONSE SENT TO CUSTOMER');
    console.log('='.repeat(80));
    console.log(`\n🤖 Chatbot: "${response}"\n`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('DEMO COMPLETE - SUMMARY');
  console.log('='.repeat(80));
  console.log(`
✅ Multiple scenarios tested with different flight statuses
✅ Flight status extracted from user messages
✅ Draft responses generated with context-aware content
✅ Signals populated from both user message and agent response
✅ Policy evaluation performed by Mandate for each scenario
✅ Verdicts issued and persisted in database
✅ Responses adapted based on verdict outcomes
✅ Decision and verdict recorded in database audit timeline
✅ Outcomes reported to Mandate
  `);
}

// Run the demo
runDemo().catch(console.error);
