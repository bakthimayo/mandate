/**
 * LLM-Based Signal Extractor using OpenAI GPT-4o Mini
 *
 * Implements the assistedParsingFn interface for signal-populator.ts
 * to extract signals from unstructured text using LLM-based parsing.
 *
 * Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key (required)
 * - OPENAI_MODEL: Model to use (default: gpt-4o-mini)
 *
 * Usage:
 * ```typescript
 * const signals = await extractSignalsWithLLM(
 *   userMessage,
 *   specSignalDefinitions,
 *   contextSignalDefs
 * );
 * ```
 */

import type { SignalDefinition } from '@mandate/shared';

// ============================================================================
// OPENAI CLIENT SETUP
// ============================================================================

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = 'https://api.openai.com/v1';

if (!OPENAI_API_KEY) {
  console.warn(
    '[LLM_EXTRACTOR] Warning: OPENAI_API_KEY not set. LLM extraction will fail. Set it to enable LLM-based signal extraction.'
  );
}

// ============================================================================
// LLM SIGNAL EXTRACTION
// ============================================================================

/**
 * Call OpenAI API to extract signals from unstructured text.
 */
async function callOpenAI(messages: OpenAIMessage[]): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. Cannot perform LLM-based signal extraction.'
    );
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0, // Deterministic for signal extraction
      top_p: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as OpenAIResponse;
  return data.choices[0].message.content;
}

/**
 * Extract signals from unstructured text using LLM.
 *
 * This function:
 * 1. Takes unstructured text (user message or agent response)
 * 2. Sends it to OpenAI with signal definitions
 * 3. Requests extraction of each signal with confidence scores
 * 4. Returns structured signal values
 *
 * Implements the assistedParsingFn interface for signal-populator.ts
 */
export async function extractSignalsWithLLM(
  unstructuredText: string,
  allSignalDefs: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>> {
  if (!OPENAI_API_KEY) {
    return {}; // Silently return empty; deterministic extraction already ran
  }

  try {
    // Build signal description for the prompt
    const signalDescriptions = contextSignals
      .map((signal) => {
        const typeInfo =
          signal.type === 'enum' && signal.values ? `enum: ${signal.values.join(', ')}` : signal.type;
        return `- ${signal.name} (${typeInfo})`;
      })
      .join('\n');

    // Create the extraction prompt
    const systemPrompt = `You are an expert signal extractor for governance systems.
Your task is to extract specific signals from unstructured text with high accuracy.
Return a JSON object with signal names as keys and extraction results.

For each signal, provide:
- value: The extracted value (null if not found)
- confidence: A number from 0 to 1 indicating confidence in the extraction

Rules:
1. Extract ONLY the signals listed below
2. Use null for signals not found in the text
3. Be conservative: only extract if clearly present
4. For monetary amounts, extract the numeric value (e.g., 90 from "$90 USD")
5. For enums, match against allowed values
6. Confidence should reflect how certain you are (0.9+ for clear matches, 0.5-0.7 for ambiguous)

Signals to extract:
${signalDescriptions}`;

    const userPrompt = `Extract signals from this text:

"${unstructuredText}"

Return ONLY valid JSON with no markdown formatting. Example format:
{
  "signal_name": { "value": extracted_value, "confidence": 0.95 },
  "another_signal": { "value": null, "confidence": 0 }
}`;

    console.log(`[LLM_EXTRACTOR] Calling ${OPENAI_MODEL}...`);

    const response = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    console.log(`[LLM_EXTRACTOR] Response:`, response);

    // Parse the response
    const result = JSON.parse(response);

    // Validate and normalize the result
    const normalized: Record<string, { value: any; confidence: number }> = {};

    for (const signal of contextSignals) {
      if (result[signal.name]) {
        const extracted = result[signal.name];
        normalized[signal.name] = {
          value: extracted.value,
          confidence: typeof extracted.confidence === 'number' ? extracted.confidence : 0.5,
        };
      }
    }

    console.log(`[LLM_EXTRACTOR] Extracted signals:`, JSON.stringify(normalized, null, 2));
    return normalized;
  } catch (error) {
    console.error('[LLM_EXTRACTOR] Error during extraction:', error);
    return {}; // Return empty on error; deterministic extraction already ran
  }
}

// ============================================================================
// SIMPLE TEST FUNCTION
// ============================================================================

/**
 * Test the LLM extractor standalone
 */
export async function testLLMExtractor(): Promise<void> {
  const testText = 'I want to cancel the booking for BK3681 and I want you to refund the amount $90 USD please';

  const signalDefs: SignalDefinition[] = [
  {
    name: 'has_monetary_value',
    type: 'boolean',
    required: true,
    source: 'context',
  },
  {
    name: 'monetary_amount',
    type: 'number',
    required: false,
    source: 'context',
  },
  {
    name: 'policy_keyword',
    type: 'enum',
    values: ['refund', 'charge', 'fee', 'escalate'],
    required: false,
    source: 'context',
  },
  {
    name: 'booking_id',
    type: 'string',
    required: false,
    source: 'context',
  },
  ];

  console.log('\n[TEST] Testing LLM Signal Extractor');
  console.log(`[TEST] Text: "${testText}"`);
  console.log(`[TEST] Model: ${OPENAI_MODEL}`);
  console.log(`[TEST] Signals to extract:`, signalDefs.map((s) => s.name).join(', '));

  const result = await extractSignalsWithLLM(testText, signalDefs, signalDefs);
  console.log('\n[TEST] Final Result:', JSON.stringify(result, null, 2));
}

// Run test if executed directly (ES module compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  testLLMExtractor().catch(console.error);
}
