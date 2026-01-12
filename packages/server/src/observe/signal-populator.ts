/**
 * Signal Population from Unstructured Context
 *
 * During the Observe phase, this module populates values for already-declared
 * DecisionSpec signals from unstructured AI-generated response text.
 *
 * Rules (strict):
 * - Only populate signals explicitly declared in DecisionSpec
 * - Never introduce new signals or modify signal definitions
 * - Execute BEFORE spec and scope resolution
 * - Deterministic extractors first (numeric, currency, keywords, qualifiers)
 * - Optional assisted parsing only for context-sourced signals
 * - Assisted parsing is non-authoritative and must NOT reduce risk
 *
 * Signal sources:
 * - 'scope': Populated from decision.scope (read-only for this module)
 * - 'context': Populated from unstructured text via extractors
 * - 'timestamp': Populated from decision.timestamp (read-only)
 *
 * @see RFC-002 Section 7 (Signal Population from Unstructured Context)
 */

import type { SignalDefinition, DecisionEvent } from '@mandate/shared';

/**
 * Result of signal population attempt for a single signal.
 */
export interface SignalPopulationResult {
  name: string;
  populated: boolean;
  value?: any;
  method?: 'deterministic' | 'assisted';
  confidence?: number; // 0-1, for assisted parsing only
}

/**
 * Configuration for signal population behavior.
 */
export interface SignalPopulationConfig {
  /**
   * Enable assisted (LLM-based) parsing for context-sourced signals.
   * Default: false (only deterministic extraction).
   */
  enableAssistedParsing?: boolean;

  /**
   * Minimum confidence threshold for assisted parsing results.
   * Default: 0.8 (80% confidence required).
   * Results below this threshold are discarded.
   */
  assistedParsingConfidenceThreshold?: number;

  /**
   * Function to perform assisted parsing (e.g., LLM call).
   * Must return an object with field names as keys and values.
   * Optional; used only if enableAssistedParsing is true.
   */
  assistedParsingFn?: (
    unstructuredText: string,
    signalDefs: readonly SignalDefinition[],
    contextSignals: readonly SignalDefinition[]
  ) => Promise<Record<string, { value: any; confidence: number }>>;
}

/**
 * Deterministic extractors for common signal types.
 * These run first and are fully authoritative.
 */
const DeterministicExtractors = {
  /**
   * Extract numeric values (integers and floats).
   * Looks for: "amount: 150", "150 units", "$150", "150.50", etc.
   */
  extractNumbers: (text: string, fieldName: string): number | undefined => {
    const patterns = [
      // "field: 123" or "field: 123.45"
      new RegExp(`${fieldName}\\s*[:\\-=]\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'),
      // "123 field" or "123 units"
      new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s+${fieldName}`, 'i'),
      // "$123" or "€123.45"
      new RegExp(`[\\$€£¥]\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const num = parseFloat(match[1]);
        if (!isNaN(num)) {
          return num;
        }
      }
    }

    return undefined;
  },

  /**
   * Extract enum values based on declared allowed values.
   * Looks for exact case-insensitive matches or common abbreviations.
   */
  extractEnum: (text: string, fieldName: string, allowedValues: string[]): string | undefined => {
    // Direct exact match (case-insensitive)
    for (const value of allowedValues) {
      const pattern = new RegExp(`\\b${value}\\b`, 'i');
      if (pattern.test(text)) {
        return value;
      }
    }

    return undefined;
  },

  /**
   * Extract boolean values.
   * Looks for: "yes", "no", "true", "false", "enabled", "disabled", etc.
   */
  extractBoolean: (text: string, fieldName: string): boolean | undefined => {
    const truePatterns = [
      /\b(yes|true|enabled|allow|approved|ok|accept)\b/i,
      new RegExp(`${fieldName}\\s*[:\\-=]\\s*(yes|true|enabled|allow)`, 'i'),
    ];

    const falsePatterns = [
      /\b(no|false|disabled|block|denied|reject|decline)\b/i,
      new RegExp(`${fieldName}\\s*[:\\-=]\\s*(no|false|disabled|block)`, 'i'),
    ];

    for (const pattern of truePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    for (const pattern of falsePatterns) {
      if (pattern.test(text)) {
        return false;
      }
    }

    return undefined;
  },

  /**
   * Extract string values with universal qualifiers.
   * Examples: "high", "low", "medium", "critical", "urgent", etc.
   */
  extractQualifier: (text: string, fieldName: string, allowedValues?: string[]): string | undefined => {
    // If allowed values provided, search for them
    if (allowedValues && allowedValues.length > 0) {
      for (const value of allowedValues) {
        const pattern = new RegExp(`\\b${value}\\b`, 'i');
        if (pattern.test(text)) {
          return value;
        }
      }
    }

    // Fallback: look for common qualifiers
    const commonQualifiers = ['critical', 'high', 'medium', 'low', 'urgent', 'normal', 'routine'];
    for (const qualifier of commonQualifiers) {
      const pattern = new RegExp(`\\b${qualifier}\\b`, 'i');
      if (pattern.test(text)) {
        return qualifier;
      }
    }

    return undefined;
  },
};

/**
 * Deterministic extraction pipeline.
 * Runs pure, synchronous extraction logic.
 */
function extractDeterministic(
  unstructuredText: string,
  signalDefs: readonly SignalDefinition[]
): SignalPopulationResult[] {
  const results: SignalPopulationResult[] = [];

  // Only extract from 'context'-sourced signals; others are pre-populated
  const contextSignals = signalDefs.filter((def) => def.source === 'context');

  for (const def of contextSignals) {
    let value: any;
    let extracted = false;

    switch (def.type) {
      case 'number':
        value = DeterministicExtractors.extractNumbers(unstructuredText, def.name);
        extracted = value !== undefined;
        break;

      case 'enum':
        value = DeterministicExtractors.extractEnum(unstructuredText, def.name, def.values || []);
        extracted = value !== undefined;
        break;

      case 'boolean':
        value = DeterministicExtractors.extractBoolean(unstructuredText, def.name);
        extracted = value !== undefined;
        break;

      case 'string':
        value = DeterministicExtractors.extractQualifier(unstructuredText, def.name, def.values);
        extracted = value !== undefined;
        break;
    }

    if (extracted) {
      results.push({
        name: def.name,
        populated: true,
        value,
        method: 'deterministic',
      });
    }
  }

  return results;
}

/**
 * Assisted extraction pipeline (optional LLM-based).
 * Only called if enableAssistedParsing is true and deterministic extraction failed.
 * Non-authoritative and must NOT reduce risk classification.
 */
async function extractAssisted(
  unstructuredText: string,
  signalDefs: readonly SignalDefinition[],
  assistedParsingFn: (
    text: string,
    defs: readonly SignalDefinition[],
    contextSignals: readonly SignalDefinition[]
  ) => Promise<Record<string, { value: any; confidence: number }>>,
  confidenceThreshold: number,
  determinismResults: Set<string>
): Promise<SignalPopulationResult[]> {
  const results: SignalPopulationResult[] = [];

  // Only try assisted parsing for signals NOT already deterministically extracted
  const contextSignals = signalDefs.filter(
    (def) => def.source === 'context' && !determinismResults.has(def.name)
  );

  if (contextSignals.length === 0) {
    return results;
  }

  try {
    const assistedResults = await assistedParsingFn(unstructuredText, signalDefs, contextSignals);

    for (const def of contextSignals) {
      const result = assistedResults[def.name];
      if (result && result.confidence >= confidenceThreshold) {
        results.push({
          name: def.name,
          populated: true,
          value: result.value,
          method: 'assisted',
          confidence: result.confidence,
        });
      }
    }
  } catch (err) {
    // Assisted parsing errors are non-fatal; continue without those results
    console.warn('[SIGNAL_POPULATOR] Assisted parsing failed:', err);
  }

  return results;
}

/**
 * Populate signal values for already-declared DecisionSpec signals
 * from unstructured AI-generated response text.
 *
 * Algorithm:
 * 1. Pre-populate scope and timestamp signals (read-only sources)
 * 2. Run deterministic extractors on unstructured text for context signals
 * 3. If enabled and deterministic extraction failed, try assisted parsing
 * 4. Return populated signal map without modifying original decision
 *
 * @param decision - The decision event (unchanged)
 * @param signalDefs - Signal definitions from resolved DecisionSpec
 * @param unstructuredText - Unstructured context (e.g., AI response)
 * @param config - Population configuration
 * @returns Map of signal names to populated values, or undefined if not found
 *
 * @see RFC-002 Section 7
 */
export async function populateSignals(
  decision: DecisionEvent,
  signalDefs: readonly SignalDefinition[],
  unstructuredText: string,
  config: SignalPopulationConfig = {}
): Promise<Record<string, any>> {
  const results: Record<string, any> = {};

  // =========================================================================
  // Step 1: Pre-populate non-context signals (scope, timestamp)
  // These are read-only sources and come directly from the decision
  // =========================================================================
  for (const def of signalDefs) {
    if (def.source === 'scope') {
      const value = (decision.scope as any)[def.name];
      if (value !== undefined) {
        results[def.name] = value;
      }
    } else if (def.source === 'timestamp') {
      results[def.name] = decision.timestamp;
    }
  }

  // =========================================================================
  // Step 2: Deterministic extraction (always runs first)
  // =========================================================================
  const determinismResults = extractDeterministic(unstructuredText, signalDefs);
  const determinismSet = new Set(determinismResults.map((r) => r.name));

  for (const result of determinismResults) {
    results[result.name] = result.value;
  }

  // =========================================================================
  // Step 3: Assisted parsing (optional, non-authoritative)
  // Only runs if enabled and deterministic extraction didn't populate the signal
  // =========================================================================
  const enableAssisted = config.enableAssistedParsing ?? false;
  const confidenceThreshold = config.assistedParsingConfidenceThreshold ?? 0.8;
  const assistedFn = config.assistedParsingFn;

  if (enableAssisted && assistedFn) {
    const assistedResults = await extractAssisted(
      unstructuredText,
      signalDefs,
      assistedFn,
      confidenceThreshold,
      determinismSet
    );

    for (const result of assistedResults) {
      results[result.name] = result.value;
    }
  }

  return results;
}

/**
 * Helper function to merge populated signals into decision context.
 * This is a convenience function; actual population happens in a pre-resolution middleware.
 *
 * Returns a new decision with updated context, without modifying the original.
 */
export function mergeSignalsIntoDecision(
  decision: DecisionEvent,
  populatedSignals: Record<string, any>
): DecisionEvent {
  return {
    ...decision,
    context: {
      ...decision.context,
      ...populatedSignals,
    },
  };
}
