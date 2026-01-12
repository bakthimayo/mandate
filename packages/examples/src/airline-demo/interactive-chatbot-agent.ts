/**
 * Interactive Airline Chatbot Agent - Mandate Demo
 *
 * A conversational agent that showcases Mandate's governance capabilities
 * across multiple decision scenarios. All responses are passed through Mandate
 * before reaching the customer.
 *
 * Predefined Policies (Showcase All Verdict Types):
 * 1. pol-refund-001: HIGH-RISK (amount >= $100) → PAUSE (escalation required)
 * 2. pol-refund-002: SAFE REFUND (amount < $100) → ALLOW (automatic approval)
 * 3. pol-refund-003: AUDIT-ALL → OBSERVE (logging only)
 *
 * Verdict Outcomes:
 * - PAUSE: Safe fallback response, escalation to compliance team
 * - ALLOW: Original response sent directly to customer
 * - BLOCK: Request rejected entirely
 * - OBSERVE: Audit-only, original response sent
 */

import { MandateClient } from '@mandate/sdk';
import * as readline from 'readline';
import { extractSignalsWithLLM } from './llm-signal-extractor.js';

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

const ORGANIZATION_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOMAIN = 'customer-support';
const SPEC_ID = 'spec-refund-v1';

// LLM Configuration
const ENABLE_LLM_EXTRACTION = process.env.ENABLE_LLM_EXTRACTION === 'true';

const client = new MandateClient({
  baseUrl: process.env.MANDATE_URL ?? 'http://localhost:3001',
  apiKey: process.env.MANDATE_API_KEY,
});

// ============================================================================
// AGENT CONVERSATION STATE
// ============================================================================

interface ConversationContext {
  customerId: string;
  bookingId: string;
  conversationId: string;
  messageCount: number;
  decisions: Array<{
    intent: string;
    verdict: string;
    timestamp: string;
    policyId: string;
  }>;
}

const context: ConversationContext = {
  customerId: 'C' + Math.random().toString(36).substr(2, 9).toUpperCase(),
  bookingId: 'BK' + Math.floor(Math.random() * 10000),
  conversationId: 'CONV-' + Date.now(),
  messageCount: 0,
  decisions: [],
};

// ============================================================================
// CHATBOT RESPONSE GENERATOR
// ============================================================================

interface DraftResponse {
  text: string;
  intent: string;
  confidence: number;
}

/**
 * Generate agent response based on user message AND extracted signals.
 * The agent should make concrete commitments based on what the user asked for.
 */
async function generateDraftResponse(
  userMessage: string,
  userSignals: Record<string, any>
): Promise<DraftResponse> {
  const lower = userMessage.toLowerCase();

  // Detect refund requests
  if (lower.includes('refund') || lower.includes('cancel')) {
    // If signals show monetary amount, use it in response
    if (userSignals.has_monetary_value && userSignals.monetary_amount !== undefined) {
      const amount = userSignals.monetary_amount;
      return {
        intent: 'issue_refund',
        text: `I can help you with your refund request. For your booking ${context.bookingId}, \
we can process a refund of $${amount} to your original payment method. \
This will be processed and you should see the credit within 2-3 business days.`,
        confidence: 0.95,
      };
    }

    // Fallback: ask for amount
    return {
      intent: 'issue_refund',
      text: `I understand you'd like a refund. Could you tell me the amount you're requesting \
for your booking ${context.bookingId}? That will help me process this for you quickly.`,
      confidence: 0.8,
    };
  }

  // Detect booking info requests
  if (lower.includes('booking') || lower.includes('flight') || lower.includes('status')) {
    return {
      intent: 'check_booking',
      text: `Your booking ${context.bookingId} is confirmed for flight AA101 on January 15, 2026. \
Passenger: ${context.customerId}. Seat: 12A. Total: $599.99.`,
      confidence: 0.98,
    };
  }

  // Default: generic greeting
  return {
    intent: 'greeting',
    text: `Hello! I'm here to help with refunds, booking information, or any other questions \
about your flight. How can I assist you today?`,
    confidence: 0.9,
  };
}

// ============================================================================
// SIGNAL EXTRACTION (OBSERVE PHASE)
// ============================================================================

/**
 * Deterministic signal extraction (regex-based, always runs)
 */
function extractSignalsDeterministic(text: string): Record<string, any> {
  const signals: Record<string, any> = {};

  // Extract monetary value
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

  // Extract escalation urgency
  const escalationWords = ['immediately', 'automatic', 'right away', 'without deduction'];
  let hasEscalationLanguage = false;
  for (const word of escalationWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
      hasEscalationLanguage = true;
      break;
    }
  }
  signals.requires_escalation = hasEscalationLanguage;

  return signals;
}

/**
 * Enhanced signal extraction with optional LLM fallback
 */
async function extractSignals(text: string, enableLLM: boolean = false): Promise<Record<string, any>> {
  // Always run deterministic first
  const deterministicSignals = extractSignalsDeterministic(text);

  // If LLM enabled, use it for signals not found deterministically
  if (enableLLM) {
    const signalDefs = [
      {
        name: 'has_monetary_value',
        type: 'boolean' as const,
        required: true,
        source: 'context' as const,
      },
      {
        name: 'monetary_amount',
        type: 'number' as const,
        required: false,
        source: 'context' as const,
      },
      {
        name: 'policy_keyword',
        type: 'enum' as const,
        values: ['refund', 'charge', 'fee', 'escalate'],
        required: false,
        source: 'context' as const,
      },
      {
        name: 'requires_escalation',
        type: 'boolean' as const,
        required: false,
        source: 'context' as const,
      },
    ];

    try {
      const llmSignals = await extractSignalsWithLLM(text, signalDefs, signalDefs);

      // Merge: LLM fills gaps left by deterministic
      return {
        has_monetary_value:
          deterministicSignals.has_monetary_value !== false
            ? deterministicSignals.has_monetary_value
            : llmSignals.has_monetary_value?.value ?? false,
        monetary_amount:
          deterministicSignals.monetary_amount ?? llmSignals.monetary_amount?.value,
        policy_keyword:
          deterministicSignals.policy_keyword || llmSignals.policy_keyword?.value,
        requires_escalation:
          deterministicSignals.requires_escalation ||
          llmSignals.requires_escalation?.value ||
          false,
      };
    } catch (error) {
      console.warn('[SIGNAL] LLM extraction failed, using deterministic only:', error);
      return deterministicSignals;
    }
  }

  return deterministicSignals;
}

// ============================================================================
// FALLBACK RESPONSES (BY VERDICT)
// ============================================================================

const FALLBACK_RESPONSES = {
  PAUSE: `Thank you for reaching out. Your request requires review by our compliance team \
to ensure accuracy. A specialist will contact you within 1 business day with a confirmed answer. \
Your reference: ${context.bookingId}. We appreciate your patience!`,

  BLOCK: `I'm unable to process this request at the moment. Please contact our support team \
at support@acme-airlines.com or call 1-800-ACME-AIR. Reference: ${context.bookingId}`,

  OBSERVE: '', // No fallback for OBSERVE - send original
};

// ============================================================================
// VERDICT HANDLER & DECISION SUBMISSION
// ============================================================================

async function processUserMessage(userMessage: string): Promise<string> {
  context.messageCount++;
  console.log(`\n${'═'.repeat(80)}`);
  console.log(`MESSAGE #${context.messageCount}`);
  console.log(`${'═'.repeat(80)}`);

  // Step 1: Extract signals from USER MESSAGE first (customer intent)
  console.log('\n[OBSERVE] Step 1: Extracting signals from user message...');
  if (ENABLE_LLM_EXTRACTION) {
    console.log(`[OBSERVE] Using LLM-based extraction (deterministic + OpenAI)`);
  } else {
    console.log(`[OBSERVE] Using deterministic extraction only (set ENABLE_LLM_EXTRACTION=true for LLM)`);
  }
  const userSignals = await extractSignals(userMessage, ENABLE_LLM_EXTRACTION);
  console.log(`[OBSERVE] User signals:`, JSON.stringify(userSignals, null, 2));

  // Step 2: Generate draft response (aware of user signals)
  console.log('\n[AGENT] Step 2: Generating draft response...');
  const draft = await generateDraftResponse(userMessage, userSignals);
  console.log(`[AGENT] Intent: ${draft.intent}`);
  console.log(`[AGENT] Draft: "${draft.text}"`);

  // Step 3: Extract signals from AGENT RESPONSE (what agent commits to)
  console.log('\n[OBSERVE] Step 3: Extracting signals from agent response...');
  const draftSignals = await extractSignals(draft.text, ENABLE_LLM_EXTRACTION);
  console.log(`[OBSERVE] Agent signals:`, JSON.stringify(draftSignals, null, 2));

  // Step 4: MERGE signals (user intent takes precedence, agent response is verification)
  console.log('\n[OBSERVE] Step 4: Merging signals...');
  const signals = {
    ...draftSignals, // Base: what agent says
    // Override with user's explicit signals (higher authority)
    has_monetary_value: userSignals.has_monetary_value || draftSignals.has_monetary_value,
    monetary_amount: userSignals.monetary_amount ?? draftSignals.monetary_amount,
    policy_keyword: userSignals.policy_keyword || draftSignals.policy_keyword,
    requires_escalation: draftSignals.requires_escalation, // Agent's language controls this
  };
  console.log(`[OBSERVE] Merged signals:`, JSON.stringify(signals, null, 2));

  // Step 5: Submit to Mandate
  console.log('\n[MANDATE] Step 5: Submitting to Mandate...');
  let result;
  try {
    result = await client.requestDecision({
      organization_id: ORGANIZATION_ID,
      domain_name: DOMAIN,
      intent: draft.intent,
      stage: 'pre_commit',
      actor: 'chatbot-v3',
      target: `customer:${context.customerId}`,
      context: {
        customer_id: context.customerId,
        booking_id: context.bookingId,
        conversation_id: context.conversationId,
        message_number: context.messageCount,
        ...signals,
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
    console.error('[MANDATE] ERROR:', error.message);
    return 'Unable to process your request. Please try again later.';
  }

  // Step 6: Log verdict
  console.log('\n[VERDICT] Step 6: Result:');
  console.log(`  Verdict: ${result.verdict.verdict}`);
  console.log(`  Policies: ${result.verdict.matched_policy_ids.join(', ') || 'none matched'}`);
  if (result.verdict.owning_team) {
    console.log(`  Escalation: ${result.verdict.owning_team}`);
  }

  // Track decision
  context.decisions.push({
    intent: draft.intent,
    verdict: result.verdict.verdict,
    timestamp: new Date().toISOString(),
    policyId: result.verdict.matched_policy_ids[0] || 'none',
  });

  // Step 7: Determine final response
  let finalResponse: string;
  const verdict = result.verdict.verdict;

  switch (verdict) {
    case 'PAUSE':
      console.log(`\n[ACTION] Verdict PAUSE → Escalating to compliance team`);
      finalResponse = FALLBACK_RESPONSES.PAUSE;
      break;

    case 'BLOCK':
      console.log(`\n[ACTION] Verdict BLOCK → Request denied`);
      finalResponse = FALLBACK_RESPONSES.BLOCK;
      break;

    case 'ALLOW':
      console.log(`\n[ACTION] Verdict ALLOW → Sending original response`);
      finalResponse = draft.text;
      break;

    case 'OBSERVE':
      console.log(`\n[ACTION] Verdict OBSERVE → Audit-only, sending original response`);
      finalResponse = draft.text;
      break;

    default:
      finalResponse = draft.text;
  }

  // Step 8: Report outcome
  try {
    await client.reportOutcome({
      decision_id: result.decision.decision_id,
      success: true,
      details: {
        response_sent_at: new Date().toISOString(),
        verdict_applied: verdict,
        response_length: finalResponse.length,
      },
    });
    console.log(`[OUTCOME] Step 8: Logged in audit trail (Decision ID: ${result.decision.decision_id})`);
  } catch (error) {
    console.warn('[OUTCOME] Failed to report:', error);
  }

  return finalResponse;
}

// ============================================================================
// INTERACTIVE AGENT LOOP
// ============================================================================

async function runInteractiveAgent(): Promise<void> {
  console.log('\n' + '═'.repeat(80));
  console.log('🚀 INTERACTIVE AIRLINE CHATBOT AGENT - MANDATE DEMO');
  console.log('═'.repeat(80));
  console.log(`
Context:
  Organization: ACME Airlines
  Domain: Customer Support
  Agent: Chatbot v3
  Customer ID: ${context.customerId}
  Booking ID: ${context.bookingId}
  Session: ${context.conversationId}

Policies Active (Showcasing Different Verdicts):
  ✓ pol-refund-001: $100+ refunds → PAUSE (escalation required)
  ✓ pol-refund-002: <$100 refunds → ALLOW (auto-approved)
  ✓ pol-refund-003: All requests → OBSERVE (audit logging)

Try these scenarios:
  • "I want a refund for my $500 ticket"     (triggers PAUSE policy)
  • "Can I get my $50 back?"                 (triggers ALLOW policy)
  • "What's my booking status?"              (info query)
  • "I need to cancel immediately"           (escalation language)
  • Type 'exit' to end the session

${'═'.repeat(80)}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (query: string): Promise<string> => {
    return new Promise((resolve) => rl.question(query, resolve));
  };

  let running = true;
  while (running) {
    const userInput = await askQuestion('\nYou: ');

    if (userInput.toLowerCase() === 'exit') {
      running = false;
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    const response = await processUserMessage(userInput);
    console.log(`\n[RESPONSE] Agent: "${response}"`);
  }

  // Session Summary
  console.log('\n' + '═'.repeat(80));
  console.log('SESSION SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total Messages: ${context.messageCount}`);
  console.log(`\nDecision History:`);
  context.decisions.forEach((decision, idx) => {
    const icon =
      decision.verdict === 'PAUSE'
        ? '⏸'
        : decision.verdict === 'ALLOW'
          ? '✅'
          : decision.verdict === 'BLOCK'
            ? '❌'
            : '👁';
    console.log(`  ${idx + 1}. ${icon} ${decision.intent} → ${decision.verdict} (${decision.policyId})`);
  });

  const verdictCounts = context.decisions.reduce(
    (acc, d) => {
      acc[d.verdict] = (acc[d.verdict] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log(`\nVerdict Distribution:`);
  Object.entries(verdictCounts).forEach(([verdict, count]) => {
    console.log(`  ${verdict}: ${count}`);
  });

  console.log(`\n✅ Conversation ended. All decisions governed by Mandate.\n`);
  rl.close();
}

// ============================================================================
// MAIN
// ============================================================================

runInteractiveAgent().catch(console.error);
