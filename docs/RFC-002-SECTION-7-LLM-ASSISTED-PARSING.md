# RFC-002 Section 7: LLM-Assisted Signal Parsing as Signal Sensor

**Status**: Specification  
**Version**: 1.0  
**Date**: 2025-01-12  
**Applies To**: Mandate Server v1.0+  

---

## 1. Overview

LLM-assisted parsing is an **optional, non-authoritative signal sensor** in the Observe phase. It runs only after deterministic extraction fails, for **context-sourced signals only**, and never overrides or clears risk classifications.

### Design Principle

**Assisted parsing may suggest signals; it may never suppress them.**

---

## 2. Core Constraints

These constraints are **non-negotiable** and enforced by architecture, not by trust.

### 2.1 LLM Output Isolation

| What LLM CAN Do | What LLM CANNOT Do |
|-----------------|-------------------|
| ✅ Populate unpopulated context signals | ❌ Override deterministically extracted signals |
| ✅ Suggest values for fuzzy signal types (e.g., strings) | ❌ Clear or modify risk indicators |
| ✅ Extract implicit information (e.g., "urgency" from tone) | ❌ Populate scope or timestamp signals |
| ✅ Return confidence scores (filtered by threshold) | ❌ Influence verdict logic directly |
| ✅ Fail gracefully without halting execution | ❌ Persist unstructured input to audit trail |

### 2.2 Signal Source Restriction

**LLM-assisted parsing ONLY operates on `context`-sourced signals.**

```typescript
// ✅ LLM can try to populate this
const contextSignal: SignalDefinition = {
  name: 'urgency_level',
  type: 'string',
  source: 'context',  // ← ONLY this source
  required: false
};

// ❌ LLM cannot populate scope-sourced signals
const scopeSignal: SignalDefinition = {
  name: 'service_id',
  type: 'string',
  source: 'scope',  // ← Blocked; pre-populated only
  required: false
};

// ❌ LLM cannot populate timestamp signals
const timeSignal: SignalDefinition = {
  name: 'created_at',
  type: 'string',
  source: 'timestamp',  // ← Blocked; pre-populated only
  required: false
};
```

### 2.3 Risk Monotonicity (Never Clear Risk)

The system enforces **risk direction**: LLM may only maintain or **increase** suspicion, never decrease it.

**This is enforced architecturally:**

1. **Deterministic extraction always runs first** and is authoritative
2. **LLM only touches unpopulated signals** (deterministic wins)
3. **Confidence thresholds** prevent low-confidence results
4. **No risk-clearing signals** allowed in LLM output
5. **Audit trail** makes any changes visible

**Examples of forbidden LLM behavior:**

```javascript
// ❌ FORBIDDEN: LLM tried to override deterministic result
{
  decision: {
    context: {
      has_monetary_value: true  // ← Set deterministically
    }
  },
  llmOutput: {
    has_monetary_value: false   // ← LLM cannot flip it
  }
}

// ❌ FORBIDDEN: LLM clears a high-risk indicator
{
  llmOutput: {
    requires_approval: false    // ← Deterministic said true; LLM cannot unset it
  }
}

// ❌ FORBIDDEN: LLM populates non-context signal
{
  llmOutput: {
    organization_id: "org-999"  // ← source: 'scope'; LLM cannot touch this
  }
}
```

**Examples of allowed LLM behavior:**

```javascript
// ✅ ALLOWED: LLM populates unpopulated signal
{
  decision: {
    context: {}  // ← Empty, deterministic found nothing
  },
  llmOutput: {
    tone_classification: 'urgent'  // ← Source: context, not previously set
  }
}

// ✅ ALLOWED: LLM increases suspicion
{
  decision: {
    context: {
      has_proportion: false  // ← Deterministic returned false or undefined
    }
  },
  llmOutput: {
    implicit_scope: 'system-wide'  // ← New signal, different field
  }
}

// ✅ ALLOWED: LLM fails gracefully
{
  deterministic: { amount: 5000 },
  llmOutput: {}  // ← LLM unavailable; system continues safely
}
```

---

## 3. Architecture

### 3.1 Execution Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ Observe Phase: Signal Population Pipeline                       │
└─────────────────────────────────────────────────────────────────┘

1. PRE-POPULATION (Read-Only)
   ├─ Populate scope-sourced signals from decision.scope
   └─ Populate timestamp signal from decision.timestamp

2. DETERMINISTIC EXTRACTION (Authoritative)
   ├─ Run all regex-based extractors
   ├─ Results are final for populated signals
   └─ Record which signals were deterministically populated

3. ASSISTED PARSING (Optional, Non-Authoritative)
   ├─ IF enableAssistedParsing === false
   │  └─ Skip to step 4
   ├─ Filter to context-sourced signals only
   ├─ Filter to signals NOT populated by deterministic extraction
   ├─ Call assistedParsingFn(unstructuredText, signalDefs, contextSignals)
   ├─ Apply confidence threshold (default: 0.8)
   ├─ Merge results (without overriding deterministic)
   └─ Non-fatal error handling (log and continue)

4. VALIDATION & PERSISTENCE
   ├─ Validate all populated signals against spec
   └─ Merge into decision.context
```

### 3.2 Data Flow Diagram

```
Unstructured Context
        │
        ├──→ Deterministic Extractors ──→ Extracted[1..n]
        │                                        │
        │                                        ├─→ has_monetary_value: true
        │                                        ├─→ policy_keyword: 'fee'
        │                                        └─→ [other deterministic signals]
        │
        ├──→ (Deterministic Results Recorded)
        │
        ├──→ LLM Assisted Parser (if enabled) ──→ LLM Results
        │    (only for unpopulated signals)         │
        │                                        ├─→ tone: 'urgent'
        │                                        ├─→ implicit_urgency: true
        │                                        └─→ [filtered by confidence]
        │
        └──→ Merge (Deterministic ∪ LLM Results) ──→ Populated Signals
                                                    │
                                                    └─→ decision.context
```

### 3.3 Isolation Boundaries

**Hard Boundaries (Enforced by Code)**:

```typescript
// Isolation 1: Source Filter
// LLM can ONLY see context-sourced signals
const contextSignalsOnly = signalDefs.filter(
  (def) => def.source === 'context'
);
const llmResult = await assistedParsingFn(
  unstructuredText,
  signalDefs,
  contextSignalsOnly  // ← Explicit boundary
);

// Isolation 2: Determinism Override Check
// LLM results blocked if deterministic already populated
const unpopulatedSignals = contextSignalsOnly.filter(
  (def) => !determinismSet.has(def.name)
);
// LLM can only modify these signals

// Isolation 3: Confidence Threshold
// Low-confidence results automatically discarded
if (llmResult.confidence < confidenceThreshold) {
  // Discard result
}

// Isolation 4: Non-Fatal Error Handling
try {
  const llmResult = await assistedParsingFn(...);
  // merge results
} catch (err) {
  // Log and continue; decision proceeds without LLM results
  console.warn('[OBSERVE_PHASE] LLM parsing failed:', err);
}
```

---

## 4. Configuration

### 4.1 Enable/Disable Assisted Parsing

```typescript
interface ObservePhaseConfig {
  /**
   * Enable LLM-assisted parsing for context-sourced signals.
   * Default: false (only deterministic extraction).
   *
   * If false, LLM parsing is skipped entirely (no latency).
   * System still operates safely and completely.
   */
  enableAssistedParsing?: boolean;

  /**
   * Minimum confidence threshold for LLM results.
   * Default: 0.8 (80% confidence required).
   *
   * Results below this threshold are silently discarded.
   * Lower threshold = more signals populated; higher = more conservative.
   */
  assistedParsingConfidenceThreshold?: number;

  /**
   * Custom LLM parsing function.
   * Must return Record<signal_name, { value, confidence }>.
   *
   * Called ONLY if:
   * - enableAssistedParsing === true
   * - Signal is context-sourced
   * - Signal not populated by deterministic extraction
   * - Deterministic extraction completed without error
   */
  assistedParsingFn?: (
    unstructuredText: string,
    allSignalDefs: readonly SignalDefinition[],
    contextSignals: readonly SignalDefinition[]
  ) => Promise<Record<string, { value: any; confidence: number }>>;
}
```

### 4.2 Deployment Configuration

```typescript
// Recommendation 1: Start with deterministic only
const config: ObservePhaseConfig = {
  enableAssistedParsing: false  // ← Default safe state
};

// Recommendation 2: Enable with high confidence threshold
const config: ObservePhaseConfig = {
  enableAssistedParsing: true,
  assistedParsingConfidenceThreshold: 0.9,  // ← Conservative
  assistedParsingFn: myLLMService.extractSignals
};

// Recommendation 3: Per-domain enablement
const configByDomain = {
  'finance': {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.85
  },
  'security': {
    enableAssistedParsing: false  // ← Strict domain
  }
};
```

---

## 5. LLM Function Contract

### 5.1 Input Parameters

```typescript
async function myLLMParsingFunction(
  unstructuredText: string,
  allSignalDefs: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>>
```

**Parameters**:

- **`unstructuredText`**: Raw AI response or log text (not modified)
- **`allSignalDefs`**: Complete SignalDefinition array (for reference)
- **`contextSignals`**: Filtered to context-sourced signals only (for parsing focus)

### 5.2 Expected Return

```typescript
// Valid response
{
  "signal_name_1": {
    value: "extracted_value",
    confidence: 0.85
  },
  "signal_name_2": {
    value: 123,
    confidence: 0.92
  }
  // ... only unpopulated context signals
}

// Signals NOT in this object are treated as unpopulated
{
  "tone": { value: "urgent", confidence: 0.88 }
  // signal_name_2 not returned → treated as failed extraction
}

// Empty result (all signals failed or low-confidence)
{}
```

### 5.3 Input Contracts & Constraints

**The LLM function MUST**:

1. ✅ Accept `unstructuredText` as-is (no preprocessing)
2. ✅ Return only fields for **context-sourced signals**
3. ✅ Include confidence scores (0-1)
4. ✅ Fail gracefully (throw Error if needed; caller will catch)
5. ✅ Not modify the decision or any state
6. ✅ Not make assumptions about intent, domain, or stage

**The LLM function MUST NOT**:

1. ❌ Modify `decision` or any input parameter
2. ❌ Populate scope or timestamp signals
3. ❌ Override or modify values already in `decision.context`
4. ❌ Clear risk indicators (only add/increase)
5. ❌ Call database, file system, or external services (except LLM inference)
6. ❌ Make governance decisions (only extract signals)
7. ❌ Assume deterministic extraction failed (LLM results validated separately)

### 5.4 Implementation Example: OpenAI Adapter

```typescript
import { OpenAI } from 'openai';
import type { SignalDefinition } from '@mandate/shared';

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function llmAssistedParser(
  unstructuredText: string,
  allSignalDefs: readonly SignalDefinition[],
  contextSignals: readonly SignalDefinition[]
): Promise<Record<string, { value: any; confidence: number }>> {
  // Build signal schema for LLM
  const signalSchema = contextSignals.map((sig) => ({
    name: sig.name,
    type: sig.type,
    allowedValues: sig.values,
  }));

  const prompt = `
Extract signal values from the following text.
Return ONLY a JSON object with signal names as keys.
Include a confidence score (0-1) for each signal.

Text:
"""
${unstructuredText}
"""

Signals to extract:
${JSON.stringify(signalSchema, null, 2)}

Return format:
{
  "signal_name": { "value": <extracted>, "confidence": <0-1> },
  ...
}

If a signal cannot be extracted, omit it from the response.
`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,  // ← Deterministic responses
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '{}';
    const result = JSON.parse(content);

    // Validate result format
    const validated: Record<string, { value: any; confidence: number }> = {};
    for (const [key, val] of Object.entries(result)) {
      if (typeof val === 'object' && 'value' in val && 'confidence' in val) {
        validated[key] = val as { value: any; confidence: number };
      }
    }

    return validated;
  } catch (err) {
    // Non-fatal: log and return empty
    console.warn('[LLM_PARSER] Extraction failed:', err);
    return {};
  }
}
```

---

## 6. What LLM-Assisted Parsing Can Extract

### 6.1 Implicit Signals

**Example**: Extract emotional tone or urgency from text (not explicit keywords)

```
Input:  "PLEASE I NEED THIS FIXED IMMEDIATELY!!!"
Output: { urgency: { value: 'critical', confidence: 0.95 } }

Input:  "This is a routine request."
Output: { urgency: { value: 'normal', confidence: 0.82 } }
```

### 6.2 Extracted Entities (Where Deterministic Failed)

**Example**: Extract named entities or relationships from prose

```
Input:  "The customer, Jane Doe, is located in Singapore."
Output: {
  customer_name: { value: 'Jane Doe', confidence: 0.88 },
  customer_location: { value: 'Singapore', confidence: 0.90 }
}
```

### 6.3 Semantic Context (For Known Signals)

**Example**: Classify sentiment or intent for a declared string signal

```
Input:  "This policy seems unfair and punitive."
Output: {
  policy_sentiment: { value: 'negative', confidence: 0.91 }
}
```

### 6.4 Synthesis of Multi-Sentence Information

**Example**: LLM extracts signal value from context scattered across paragraphs

```
Input:  """
In the first quarter, we processed 50,000 transactions.
Of these, 2,500 were flagged for review.
We expect this ratio to increase in Q2.
"""
Output: {
  flagged_ratio: { value: 0.05, confidence: 0.84 },
  flagged_count: { value: 2500, confidence: 0.88 }
}
```

---

## 7. What LLM-Assisted Parsing CANNOT Do

### 7.1 ❌ Override Deterministic Extraction

```javascript
// BLOCKED: Deterministic found it first
{
  deterministic: { has_monetary_value: true },
  llm: { has_monetary_value: false }  // ← Ignored
}
```

**Reason**: Deterministic extraction is authoritative. LLM is fallback only.

### 7.2 ❌ Clear Risk Indicators

```javascript
// BLOCKED: Cannot flip boolean from true to false
{
  deterministic: { requires_approval: true },
  llm: { requires_approval: false }  // ← Not allowed
}

// BLOCKED: Cannot delete high-risk signal
{
  deterministic: { policy_keyword: 'penalty' },
  llm: { policy_keyword: undefined }  // ← Not allowed
}
```

**Reason**: Risk monotonicity. Signals only increase or stay the same.

### 7.3 ❌ Populate Scope or Timestamp Signals

```javascript
// BLOCKED: source: 'scope'
{
  llm: { organization_id: "org-999" }  // ← Cannot populate
}

// BLOCKED: source: 'timestamp'
{
  llm: { created_at: "2025-01-12T10:00:00Z" }  // ← Cannot populate
}
```

**Reason**: Scope and timestamp are decision metadata, not signal extraction targets.

### 7.4 ❌ Influence Verdict Logic Directly

```javascript
// BLOCKED: LLM cannot say "block this"
{
  decision: { context: { ... } },
  llm: { verdict: 'BLOCK' }  // ← Governance decision, not signal
}

// BLOCKED: LLM cannot trigger re-evaluation
{
  llm: { reEvaluate: true }  // ← Not a signal, control logic
}
```

**Reason**: Verdicts come from policies, not LLM suggestions.

### 7.5 ❌ Persist Unstructured Input

```javascript
// BLOCKED: Unstructured text never stored in audit
{
  decision: { context: { raw_input: "..." } }  // ← Not allowed
}
```

**Reason**: RFC-002 Section 7 constraint: Unstructured input not persisted.

### 7.6 ❌ Make Factual Assertions

```javascript
// BLOCKED: LLM cannot assert facts about external world
{
  llm: {
    user_is_vip: true,                  // ← Requires DB lookup
    company_exists: true,               // ← Requires verification
    customer_has_prior_fraud: true      // ← Requires external data
  }
}
```

**Reason**: LLM is a signal extractor, not a fact validator. Use scope signals for external facts.

---

## 8. Operational Safety Guarantees

### 8.1 Graceful Degradation

**If LLM is unavailable**:

```
Decision received
  ├─ Deterministic extraction: ✅ Completes
  ├─ LLM call: ❌ Timeout/500 error
  └─ System: ✅ Continues with deterministic results only
              ✅ Policy evaluation proceeds
              ✅ Verdict issued normally
              ✅ Logged warning: "LLM parsing failed"
```

**No blocking, no halting, no fallback to unsafe state.**

### 8.2 Confidence Threshold Protection

**Low-confidence results automatically filtered**:

```typescript
if (llmResult.confidence < 0.8) {
  // Silently discarded; signal remains unpopulated
  // No error, no retry, no degradation
}
```

### 8.3 Non-Fatal Error Handling

```typescript
try {
  const llmResults = await assistedParsingFn(...);
  // merge results
} catch (err) {
  // Log and continue
  logger.warn('LLM parsing failed', { error: err.message });
  // Decision proceeds without LLM results
  // Deterministic results sufficient for safety
}
```

### 8.4 Audit Trail Clarity

```typescript
// Populated signals include source information
// Policies can reference extraction method if needed

const result = {
  signal: 'urgency_level',
  value: 'critical',
  method: 'assisted',     // ← Shows LLM populated this
  confidence: 0.92,       // ← Shows confidence
  timestamp: '2025-01-12T...'
};
```

---

## 9. Monitoring & Observability

### 9.1 Metrics to Track

```typescript
// For each decision:
metrics.observe_phase_deterministic_signals_extracted: number;
metrics.observe_phase_llm_signals_extracted: number;
metrics.observe_phase_llm_latency_ms: number;
metrics.observe_phase_llm_failures: counter;
metrics.observe_phase_llm_low_confidence_discarded: number;

// Example query: LLM success rate
const llmSuccessRate = (
  llm_signals_extracted / 
  (llm_signals_extracted + llm_failures)
);
```

### 9.2 Logging

```
[OBSERVE_PHASE] Signal population started
[OBSERVE_PHASE] Deterministic: extracted 3 signals
[OBSERVE_PHASE] LLM parsing enabled, calling extraction function
[OBSERVE_PHASE] LLM: extracted 1 signal (confidence: 0.85)
[OBSERVE_PHASE] LLM: discarded 2 signals (below threshold)
[OBSERVE_PHASE] Final signals: 4 total (3 deterministic, 1 LLM)
```

### 9.3 Decision Audit

```json
{
  "decision_id": "dec-123",
  "context": {
    "has_monetary_value": true,
    "policy_keyword": "refund",
    "urgency": "critical"
  },
  "signals_metadata": {
    "has_monetary_value": {
      "method": "deterministic",
      "value": true
    },
    "policy_keyword": {
      "method": "deterministic",
      "value": "refund"
    },
    "urgency": {
      "method": "assisted",
      "value": "critical",
      "confidence": 0.88
    }
  }
}
```

---

## 10. Testing LLM-Assisted Parsing

### 10.1 Unit Tests (Mock LLM)

```typescript
describe('Assisted Parsing', () => {
  it('should skip LLM if disabled', async () => {
    const result = await populateSignals(decision, signals, text, {
      enableAssistedParsing: false
    });
    // LLM function never called
  });

  it('should filter out low-confidence results', async () => {
    const mockLLM = async () => ({
      urgency: { value: 'high', confidence: 0.5 }  // Below 0.8
    });

    const result = await populateSignals(decision, signals, text, {
      enableAssistedParsing: true,
      assistedParsingConfidenceThreshold: 0.8,
      assistedParsingFn: mockLLM
    });

    expect(result).not.toHaveProperty('urgency');
  });

  it('should not override deterministic results', async () => {
    const mockLLM = async () => ({
      has_monetary_value: { value: false, confidence: 0.9 }
    });

    const result = await populateSignals(
      { ...decision, context: { has_monetary_value: true } },
      signals,
      text,
      { enableAssistedParsing: true, assistedParsingFn: mockLLM }
    );

    expect(result.has_monetary_value).toBe(true);  // Deterministic wins
  });

  it('should handle LLM errors gracefully', async () => {
    const mockLLM = async () => {
      throw new Error('LLM unavailable');
    };

    const result = await populateSignals(decision, signals, text, {
      enableAssistedParsing: true,
      assistedParsingFn: mockLLM
    });

    // Should complete without error, with only deterministic results
    expect(result).toBeDefined();
  });
});
```

### 10.2 Integration Tests (Real LLM or Mock)

```typescript
describe('End-to-End Observe Phase', () => {
  it('should populate signals with LLM and evaluate policy', async () => {
    const decision = createTestDecision();
    const spec = createTestSpec();
    const context = "Please refund the customer 50% of the transaction amount.";

    const enriched = await executeObservePhase(
      decision,
      spec,
      context,
      { enableAssistedParsing: true, assistedParsingFn: myLLMParser }
    );

    expect(enriched.context).toHaveProperty('has_monetary_value', true);
    expect(enriched.context).toHaveProperty('has_proportion', true);
    expect(enriched.context).toHaveProperty('policy_keyword', 'refund');
    expect(enriched.context).toHaveProperty('urgency'); // Populated by LLM
  });

  it('should issue PAUSE verdict when combined signals detected', async () => {
    // ... test full pipeline with policies
  });
});
```

---

## 11. Limitations & Future Improvements

### Current Limitations

1. **Prompt engineering required**: LLM quality depends on signal schema clarity
2. **Latency**: LLM calls add 100-1000ms per request
3. **Cost**: LLM inference has per-token costs
4. **Hallucination risk**: LLM may invent plausible-sounding values
5. **Confidentiality**: Unstructured text sent to external LLM

### Mitigation Strategies

- ✅ Use confidence thresholds to filter low-quality results
- ✅ Combine deterministic + LLM for best coverage
- ✅ Run LLM asynchronously if latency is concern
- ✅ Use deterministic-only mode for high-security domains
- ✅ Host LLM locally if confidentiality required

### Future Improvements

- [ ] Batch LLM calls across multiple decisions
- [ ] Cache LLM results for repeated patterns
- [ ] Fine-tune LLM on org-specific signal schemas
- [ ] A/B test LLM providers and models
- [ ] Feedback loop: correlate LLM signals with policy verdicts

---

## 12. Compliance Checklist

### RFC-002 Compliance

- ✅ LLM output ONLY populates context-sourced signals
- ✅ LLM output CANNOT override deterministic results
- ✅ LLM output CANNOT influence verdict logic directly
- ✅ LLM output CANNOT clear risk indicators
- ✅ Unstructured input NOT persisted to audit trail
- ✅ System operates safely if LLM unavailable
- ✅ Assisted parsing is clearly non-authoritative
- ✅ Isolation boundaries enforced by code, not trust

### Operational Safety

- ✅ Graceful degradation (LLM optional)
- ✅ Confidence thresholds (automatic filtering)
- ✅ Non-fatal error handling (continue on LLM failure)
- ✅ Audit trail (signals_metadata shows source)
- ✅ Observable (metrics, logging, decision trails)

---

## 13. Related Documentation

- **RFC-002 Section 7**: Signal Population from Unstructured Context
- **IMPLEMENTATION-RFC-002-SECTION-7.md**: Implementation guide
- **HIGH-RISK-SIGNAL-EXTRACTORS.md**: Deterministic extractors
- **packages/server/src/observe/signal-populator.ts**: Source code
- **packages/shared/src/schemas.ts**: Types and contracts

---

## 14. References & Examples

### Example: Using LLM-Assisted Parsing

```typescript
import { executeObservePhase } from '@mandate/server/observe';
import { llmAssistedParser } from '@mandate/server/llm';

const decision = { /* decision event */ };
const spec = { /* decision spec */ };
const unstructuredContext = `
  The customer is requesting an urgent refund of 75% of the transaction.
  This is their second refund request this month.
`;

const enrichedDecision = await executeObservePhase(
  decision,
  spec,
  unstructuredContext,
  {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.85,
    assistedParsingFn: llmAssistedParser
  }
);

// enrichedDecision.context now contains:
// - has_monetary_value: true (deterministic)
// - has_proportion: true (deterministic)
// - policy_keyword: 'refund' (deterministic)
// - urgency: 'critical' (LLM, confidence: 0.92)
// - refund_frequency: 'high' (LLM, confidence: 0.88)
```

---

**End of Specification**
