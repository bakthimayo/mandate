# LLM-Assisted Parsing: Implementation Quick Start

**Purpose**: Implement optional LLM-based signal extraction as a **non-authoritative signal sensor**  
**Audience**: Backend engineers, LLM integration specialists  
**Reference**: `RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md`

---

## Quick Rules

| Rule | What It Means |
|------|---------------|
| **Only context signals** | LLM can ONLY populate `source: 'context'` signals |
| **Never override** | If deterministic found it, LLM result is ignored |
| **Only increase risk** | LLM may never clear or suppress risk indicators |
| **Fail gracefully** | If LLM is down, system still works safely |
| **Confidence threshold** | Low-confidence results automatically dropped (default: 0.8) |

---

## Integration Points

### 1. Update `signal-populator.ts`

The `extractAssisted` function already exists. Update configuration acceptance:

```typescript
// In populateSignals() function
if (enableAssisted && assistedFn) {
  const assistedResults = await extractAssisted(
    unstructuredText,
    signalDefs,
    assistedFn,
    confidenceThreshold,
    determinismSet  // ← LLM only touches unpopulated signals
  );
  
  for (const result of assistedResults) {
    results[result.name] = result.value;  // ← Merge without override
  }
}
```

✅ **Already enforces**: Source filtering, determinism protection, confidence thresholds

### 2. Pass Config to Decisions Route

```typescript
// packages/server/src/routes/decisions.ts

const observeConfig: ObservePhaseConfig = {
  enableAssistedParsing: process.env.ENABLE_LLM_PARSING === 'true',
  assistedParsingConfidenceThreshold: 0.85,  // ← Configurable
  assistedParsingFn: process.env.ENABLE_LLM_PARSING 
    ? llmAssistedParser 
    : undefined
};

// In POST /api/v1/decisions handler
const enrichedDecision = await executeObservePhase(
  decision,
  spec,
  req.body.unstructured_context,
  observeConfig
);
```

### 3. Create LLM Integration Module

Create `packages/server/src/llm/signal-parser.ts`:

```typescript
import { OpenAI } from 'openai';
import type { SignalDefinition } from '@mandate/shared';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * LLM-based signal extraction for unpopulated context signals.
 * Non-authoritative; results filtered by confidence threshold.
 */
export async function llmAssistedParser(
  unstructuredText: string,
  allSignalDefs: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>> {
  // Build schema for LLM
  const schema = contextSignals.map((s) => ({
    name: s.name,
    type: s.type,
    description: `Extract signal "${s.name}" (${s.type})`,
    allowedValues: s.values
  }));

  const prompt = buildSignalExtractionPrompt(unstructuredText, schema);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,  // ← Deterministic
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    // Validate format
    const validated: Record<string, { value: any; confidence: number }> = {};
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'object' && 'value' in val && 'confidence' in val) {
        validated[key] = val as { value: any; confidence: number };
      }
    }

    return validated;
  } catch (err) {
    // Non-fatal: log and return empty
    logger.warn('[LLM_PARSER] Extraction failed', { 
      error: err instanceof Error ? err.message : String(err) 
    });
    return {};
  }
}

function buildSignalExtractionPrompt(text: string, schema: any[]): string {
  return `
You are a signal extraction assistant. Your job is to extract predefined signals from unstructured text.

TEXT TO ANALYZE:
"""
${text}
"""

SIGNALS TO EXTRACT:
${JSON.stringify(schema, null, 2)}

INSTRUCTIONS:
1. Extract values for the signals listed above
2. For each signal, return { value: <extracted>, confidence: <0-1> }
3. Omit signals you cannot extract
4. Be conservative with confidence scores (prefer 0.7-0.9 range)
5. Never guess or hallucinate values

RETURN FORMAT (valid JSON only):
{
  "signal_name": { "value": <extracted_value>, "confidence": <0-1> },
  ...
}
`;
}
```

---

## Configuration

### Environment Variables

```bash
# Enable LLM-assisted parsing (default: false)
ENABLE_LLM_PARSING=true

# LLM provider key
OPENAI_API_KEY=sk-...

# Confidence threshold (0-1, default: 0.85)
LLM_CONFIDENCE_THRESHOLD=0.85

# Timeout for LLM calls (ms, default: 5000)
LLM_TIMEOUT_MS=5000
```

### Per-Domain Configuration

```typescript
const domainConfig = {
  'finance': {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.85
  },
  'security': {
    enableAssistedParsing: false  // ← Strict domain
  },
  'marketing': {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.75  // ← More permissive
  }
};
```

---

## Testing

### Mock Test (No Real LLM)

```typescript
import { populateSignals } from '@mandate/server/observe';

describe('LLM-Assisted Signal Parsing', () => {
  it('should extract signals with LLM fallback', async () => {
    const mockLLM = async () => ({
      urgency: { value: 'critical', confidence: 0.92 },
      user_sentiment: { value: 'frustrated', confidence: 0.88 }
    });

    const result = await populateSignals(
      decision,
      [
        { name: 'urgency', type: 'string', source: 'context', required: false },
        { name: 'user_sentiment', type: 'string', source: 'context', required: false }
      ],
      'Please fix this immediately! I am very frustrated.',
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.8,
        assistedParsingFn: mockLLM
      }
    );

    expect(result.urgency).toBe('critical');
    expect(result.user_sentiment).toBe('frustrated');
  });

  it('should discard low-confidence results', async () => {
    const mockLLM = async () => ({
      urgency: { value: 'high', confidence: 0.5 }  // Below threshold
    });

    const result = await populateSignals(
      decision,
      signals,
      text,
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.8,
        assistedParsingFn: mockLLM
      }
    );

    expect(result).not.toHaveProperty('urgency');
  });

  it('should not override deterministic results', async () => {
    const mockLLM = async () => ({
      has_monetary_value: { value: false, confidence: 0.95 }
    });

    const result = await populateSignals(
      { ...decision, context: { has_monetary_value: true } },  // ← Already set
      signals,
      text,
      {
        enableAssistedParsing: true,
        assistedParsingFn: mockLLM
      }
    );

    expect(result.has_monetary_value).toBe(true);  // Deterministic wins
  });

  it('should handle LLM errors gracefully', async () => {
    const mockLLM = async () => {
      throw new Error('LLM service unavailable');
    };

    const result = await populateSignals(
      decision,
      signals,
      text,
      {
        enableAssistedParsing: true,
        assistedParsingFn: mockLLM
      }
    );

    // Should complete without error
    expect(result).toBeDefined();
    // Should contain only deterministic results (if any)
  });

  it('should skip LLM if disabled', async () => {
    const mockLLM = jest.fn();

    await populateSignals(
      decision,
      signals,
      text,
      {
        enableAssistedParsing: false,  // ← Disabled
        assistedParsingFn: mockLLM
      }
    );

    expect(mockLLM).not.toHaveBeenCalled();
  });
});
```

### Integration Test (Optional: Real LLM)

```typescript
import { executeObservePhase } from '@mandate/server/observe';
import { llmAssistedParser } from '@mandate/server/llm';

describe('End-to-End with LLM', () => {
  it.skip('should populate signals via LLM (requires API key)', async () => {
    const decision = createTestDecision();
    const spec = createTestSpec();
    const context = 'Customer requests urgent refund of 50% due to service issue.';

    const enriched = await executeObservePhase(
      decision,
      spec,
      context,
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.85,
        assistedParsingFn: llmAssistedParser
      }
    );

    expect(enriched.context).toHaveProperty('urgency');
    expect(enriched.context).toHaveProperty('refund_reason');
  });
});
```

---

## Usage Examples

### Example 1: Basic Signal Extraction

```typescript
const unstructuredContext = 'Please apply a $50 fee to the account.';

const enriched = await executeObservePhase(
  decision,
  spec,
  unstructuredContext,
  {
    enableAssistedParsing: false  // ← Deterministic only
  }
);

// enriched.context:
// - has_monetary_value: true (deterministic)
// - policy_keyword: 'fee' (deterministic)
```

### Example 2: With LLM Fallback

```typescript
const unstructuredContext = 'URGENT: Customer is very upset and wants immediate resolution.';

const enriched = await executeObservePhase(
  decision,
  spec,
  unstructuredContext,
  {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.85,
    assistedParsingFn: llmAssistedParser
  }
);

// enriched.context:
// - has_universal_scope: false (deterministic - no "all")
// - urgency: 'critical' (LLM, confidence: 0.92)
// - sentiment: 'negative' (LLM, confidence: 0.88)
```

### Example 3: Graceful Degradation

```typescript
// LLM disabled or unavailable
const enriched = await executeObservePhase(
  decision,
  spec,
  context,
  {
    enableAssistedParsing: false  // ← Safe fallback
  }
);

// ✅ System works completely
// ✅ Deterministic results used
// ✅ No timeout, no error
// ✅ Decision proceeds normally
```

---

## Monitoring

### Metrics to Track

```typescript
// In observePhaseExecutor middleware:

const startTime = Date.now();

const enriched = await executeObservePhase(decision, spec, context, config);

const duration = Date.now() - startTime;

metrics.record('observe_phase_duration_ms', duration);
metrics.record('observe_phase_deterministic_count', deterministicCount);
metrics.record('observe_phase_llm_count', llmCount);

if (config.enableAssistedParsing) {
  metrics.record('observe_phase_llm_enabled', 1);
  metrics.record('observe_phase_llm_latency_ms', llmDuration);
}
```

### Sample Logs

```
[OBSERVE_PHASE] Signal population started (decision_id=dec-123)
[OBSERVE_PHASE] Deterministic extraction: 3 signals extracted
[OBSERVE_PHASE] LLM parsing enabled, calling extraction function
[OBSERVE_PHASE] LLM response received (latency: 245ms)
[OBSERVE_PHASE] LLM: extracted 2 signals, discarded 1 (confidence < threshold)
[OBSERVE_PHASE] Final signals: 5 total (3 deterministic, 2 LLM)
[OBSERVE_PHASE] Signal population completed (total: 3.5ms)
```

---

## Deployment Checklist

- [ ] Add `llmAssistedParser` to `packages/server/src/llm/`
- [ ] Update `signal-populator.ts` to accept `assistedParsingFn` config
- [ ] Update decisions route to pass config
- [ ] Add environment variables (ENABLE_LLM_PARSING, OPENAI_API_KEY, etc.)
- [ ] Write unit tests (mock LLM)
- [ ] Write integration tests (determinism protection, error handling)
- [ ] Add metrics/logging for observability
- [ ] Document in runbooks (what to do if LLM fails)
- [ ] Test graceful degradation (LLM timeout scenario)
- [ ] Security review (API key handling, prompt injection)
- [ ] Performance test (latency impact on decision latency)

---

## Safety Invariants

```typescript
// Invariant 1: Determinism always wins
assert(
  deterministic_value !== undefined &&
  llm_value !== undefined
  => final_value === deterministic_value
);

// Invariant 2: Only context signals
assert(
  llm_can_populate(signal) => signal.source === 'context'
);

// Invariant 3: Confidence filtering
assert(
  llm_confidence < threshold => signal_discarded
);

// Invariant 4: Graceful failure
assert(
  llm_error => system_continues_with_deterministic_only
);

// Invariant 5: No unstructured persistence
assert(
  decision.audit_trail.includes(unstructured_text) === false
);
```

---

## Common Patterns

### Pattern 1: Per-Domain Enablement

```typescript
function getObserveConfig(domainName: string): ObservePhaseConfig {
  const domainConfigs: Record<string, ObservePhaseConfig> = {
    finance: {
      enableAssistedParsing: true,
      assistedParsingConfidenceThreshold: 0.9  // Very strict
    },
    security: {
      enableAssistedParsing: false  // No LLM for security
    },
    support: {
      enableAssistedParsing: true,
      assistedParsingConfidenceThreshold: 0.75  // More permissive
    }
  };

  return domainConfigs[domainName] || {
    enableAssistedParsing: false  // Default safe
  };
}
```

### Pattern 2: Timeout Wrapper

```typescript
async function llmAssistedParserWithTimeout(
  text: string,
  allSignals: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[],
  timeoutMs: number = 5000
): Promise<Record<string, { value: any; confidence: number }>> {
  try {
    return await Promise.race([
      llmAssistedParser(text, allSignals, contextSignals),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), timeoutMs)
      )
    ]);
  } catch (err) {
    logger.warn('[LLM_PARSER] Timeout or error, returning empty', { error: err });
    return {};  // ← Graceful fallback
  }
}
```

### Pattern 3: A/B Testing

```typescript
async function experimentalLLMParser(
  text: string,
  allSignals: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>> {
  // Run both extractors in parallel
  const [deterministicResults, llmResults] = await Promise.all([
    deterministicExtraction(text, contextSignals),
    llmAssistedParser(text, allSignals, contextSignals)
  ]);

  // Compare results for learning
  logComparisonMetrics(deterministicResults, llmResults);

  // Return deterministic (winning strategy)
  return deterministicResults;
}
```

---

## References

- **Specification**: `docs/RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md`
- **Implementation Guide**: `docs/IMPLEMENTATION-RFC-002-SECTION-7.md`
- **Source Code**: `packages/server/src/observe/signal-populator.ts`
- **Signal Extractors**: `docs/HIGH-RISK-SIGNAL-EXTRACTORS.md`

---

**Last Updated**: 2025-01-12
