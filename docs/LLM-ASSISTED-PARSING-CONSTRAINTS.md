# LLM-Assisted Parsing: Constraints & Isolation Boundaries

**Purpose**: Document hard constraints that prevent LLM output from compromising safety  
**Audience**: Architects, security reviewers, policy authors  
**Status**: Non-negotiable design constraints

---

## Executive Summary

LLM-assisted parsing in the Observe phase is a **signal sensor**, not a decision engine. Its output:

- ✅ May only populate **unpopulated context-sourced signals**
- ✅ May never **override deterministic extraction**
- ✅ May never **clear risk indicators**
- ✅ May never **influence verdicts directly**
- ✅ Must **fail gracefully** if unavailable

**Design principle**: Assisted parsing may suggest signals; it may never suppress them.

---

## Constraint 1: Source Isolation

### Definition
LLM output may ONLY populate signals with `source: 'context'`.

### Enforcement
```typescript
// Hard filter before LLM call
const contextSignalsOnly = signalDefs.filter(
  (def) => def.source === 'context'
);

// LLM receives ONLY these signals
const llmResults = await assistedParsingFn(
  text,
  signalDefs,
  contextSignalsOnly  // ← Explicit boundary
);
```

### Why This Matters
- **scope signals** (`organization_id`, `service`, `agent`) are governance metadata from decision, not extracted text
- **timestamp signals** are infrastructure metadata, not inference targets
- Only **context signals** come from unstructured input

### Examples

✅ **Allowed**: LLM populates context signal
```json
{
  "signal": {
    "name": "urgency",
    "type": "string",
    "source": "context",  // ← Can be populated by LLM
    "required": false
  },
  "llm_output": { "urgency": "critical" }
}
```

❌ **Blocked**: LLM cannot touch scope signal
```json
{
  "signal": {
    "name": "organization_id",
    "type": "string",
    "source": "scope",  // ← Blocked by source filter
    "required": true
  },
  "llm_output": { "organization_id": "org-999" }  // ← Will be ignored
}
```

❌ **Blocked**: LLM cannot touch timestamp signal
```json
{
  "signal": {
    "name": "created_at",
    "type": "string",
    "source": "timestamp",  // ← Blocked by source filter
    "required": true
  },
  "llm_output": { "created_at": "2025-01-12T..." }  // ← Will be ignored
}
```

---

## Constraint 2: Determinism Always Wins

### Definition
If deterministic extraction populated a signal, LLM result for that signal is **ignored**.

### Enforcement
```typescript
// Track which signals deterministic extraction populated
const determinismSet = new Set(
  determinismResults.map((r) => r.name)
);

// Filter LLM signals to exclude those already populated
const unpopulatedSignals = contextSignalsOnly.filter(
  (def) => !determinismSet.has(def.name)
);

// LLM receives ONLY these
const llmResults = await assistedParsingFn(
  text,
  signalDefs,
  unpopulatedSignals  // ← Key boundary
);
```

### Why This Matters
- **Deterministic extraction is pure regex**: auditable, reversible, explainable
- **LLM is probabilistic**: may hallucinate, may be influenced by prompt injection
- **Deterministic must win** to maintain security properties

### Examples

✅ **Correct**: LLM populates unpopulated signal
```javascript
{
  deterministic: { policy_keyword: 'fee' },     // Extracted
  context: {},                                   // Empty
  llm_output: { urgency: 'high' },              // Populates empty signal
  final: { policy_keyword: 'fee', urgency: 'high' }  // Both present
}
```

❌ **Blocked**: LLM cannot override deterministic
```javascript
{
  deterministic: { has_monetary_value: true },     // Extracted
  llm_output: { has_monetary_value: false },       // LLM disagrees
  final: { has_monetary_value: true }              // Deterministic wins
}
```

❌ **Blocked**: LLM cannot flip boolean
```javascript
{
  deterministic: { requires_approval: true },      // Set
  llm_output: { requires_approval: false },        // Cannot unset
  final: { requires_approval: true }               // Original remains
}
```

---

## Constraint 3: Risk Monotonicity

### Definition
LLM output may never **clear** or **reduce** risk indicators. It may only:
- Populate new signals (adding information)
- Suggest equal or higher suspicion
- Leave signals unset

### Enforcement

This is enforced by **Constraints 1 and 2**:
1. LLM only touches context-sourced signals
2. LLM never overrides deterministic extraction
3. Deterministic extractors are designed to **flag** high-risk patterns, not clear them

**Example**: Cannot flip high-risk to low-risk
```javascript
{
  deterministic: { has_monetary_value: true },     // High-risk indicator
  llm: { has_monetary_value: false },              // Cannot flip (ignored)
  result: { has_monetary_value: true }             // Risk remains
}
```

### Why This Matters
- **Prevents risk suppression**: LLM cannot convince system "don't worry"
- **Maintains security properties**: System gets stricter or stays same
- **Audit trail**: All populated signals are visible; no hidden unsetting

---

## Constraint 4: No Direct Verdict Influence

### Definition
LLM output does not directly influence verdict logic. It may only:
- Populate signals
- Policies then reference those signals
- Policies then issue verdicts

LLM cannot:
- Set verdict value
- Bypass policy evaluation
- Override policy logic
- Trigger re-evaluation

### Enforcement

```typescript
// ✅ LLM populates signals
const llmOutput = { urgency: 'critical', sentiment: 'angry' };

// ✅ Policies reference those signals
const policy = {
  conditions: [
    { field: 'urgency', operator: '==', value: 'critical' },
    { field: 'sentiment', operator: '==', value: 'angry' }
  ],
  verdict: 'PAUSE'
};

// ✅ Policy evaluation happens
const verdict = evaluatePolicy(decision, policy);  // Issues PAUSE

// ❌ LLM cannot do this
const llmOutput = { verdict: 'BLOCK' };  // Not a signal; ignored
const llmOutput = { skipPolicyEvaluation: true };  // Not valid
```

### Examples

❌ **Forbidden**: LLM returns verdict-like output
```json
{
  "llm_output": {
    "verdict": "BLOCK",  // ← Not a signal
    "reason": "Too risky"
  }
}
```

❌ **Forbidden**: LLM attempts control flow
```json
{
  "llm_output": {
    "reEvaluate": true,  // ← Not a signal
    "skipValidation": true
  }
}
```

✅ **Correct**: LLM populates signals only
```json
{
  "llm_output": {
    "risk_level": "high",  // ← Signal
    "requires_human_review": true,  // ← Signal
    "escalation_reason": "multiple_red_flags"  // ← Signal
  }
}
```

---

## Constraint 5: Graceful Degradation

### Definition
If LLM is unavailable or fails, the system **must continue safely** without degradation.

### Enforcement

```typescript
try {
  const llmResults = await assistedParsingFn(
    unstructuredText,
    signalDefs,
    contextSignals
  );
  // merge results
} catch (err) {
  // ✅ MUST NOT throw; must continue
  logger.warn('[OBSERVE_PHASE] LLM parsing failed', { error: err });
  // Decision proceeds with only deterministic results
}
```

### Safety Guarantees

**If LLM times out**:
```
Request arrives
  ├─ Deterministic extraction: ✅ Completes
  ├─ LLM call: ❌ 5000ms timeout
  └─ Fallback: ✅ Continue with deterministic results
     └─ Decision evaluated normally
```

**If LLM API is down**:
```
Request arrives
  ├─ Deterministic extraction: ✅ Completes
  ├─ LLM call: ❌ 503 Service Unavailable
  └─ Fallback: ✅ Continue with deterministic results
     └─ Policy evaluation proceeds
```

**If LLM returns invalid JSON**:
```
Request arrives
  ├─ Deterministic extraction: ✅ Completes
  ├─ LLM call: ✅ Returns response
  ├─ JSON parse: ❌ Invalid format
  └─ Fallback: ✅ Log and continue
     └─ Use only deterministic results
```

### Examples

✅ **Correct**: Non-fatal error handling
```typescript
try {
  const llmResults = await llmService.extract(text);
  results = { ...results, ...llmResults };
} catch (err) {
  logger.warn('LLM failed; continuing', err);
  // ✅ Decision continues with deterministic results
}
```

❌ **Wrong**: Blocking on LLM failure
```typescript
const llmResults = await llmService.extract(text);  // ← Can throw
results = { ...results, ...llmResults };  // ← May not reach if LLM fails
```

---

## Constraint 6: No Unstructured Input Persistence

### Definition
The unstructured input text is **never persisted** to the audit trail or decision record.

### Enforcement

```typescript
// ✅ Only EXTRACTED VALUES are persisted
const decision = {
  context: {
    has_monetary_value: true,    // ← Extracted signal
    policy_keyword: 'refund',    // ← Extracted signal
    urgency: 'critical'          // ← Extracted signal
  }
};

// ❌ Unstructured text NOT stored
// decision.context does NOT contain:
// - raw_input: "The customer wants..."
// - unstructured_text: "Please refund..."
// - ai_response: "..."
```

### Why This Matters
- **Privacy**: Input text may contain PII, secrets, sensitive context
- **Audit compliance**: Only governance-relevant signals in audit trail
- **Data minimization**: Store only what's needed for decisions

### Examples

❌ **Forbidden**: Storing unstructured input
```json
{
  "decision": {
    "context": {
      "raw_input": "Customer details: name=John, email=john@..., ssn=123-45-6789"
    }
  }
}
```

✅ **Correct**: Storing only extracted signals
```json
{
  "decision": {
    "context": {
      "has_personal_data": true,
      "requires_pii_handling": true,
      "customer_location": "US"
    }
  }
}
```

---

## Constraint 7: Confidence Threshold Protection

### Definition
LLM results below the confidence threshold are **automatically discarded**, not evaluated for other constraints.

### Enforcement

```typescript
const confidenceThreshold = 0.8;  // Default

for (const [signalName, result] of Object.entries(llmResults)) {
  if (result.confidence < confidenceThreshold) {
    // Silently discard; do not merge
    continue;
  }
  // Merge only high-confidence results
  populatedSignals[signalName] = result.value;
}
```

### Why This Matters
- **Quality filter**: Removes uncertain LLM outputs before they influence decisions
- **No fallback risk**: Even if LLM is compromised, low-confidence results don't propagate
- **Configurable strictness**: Threshold can be adjusted per domain

### Examples

✅ **Auto-discard**: Low confidence results
```javascript
{
  llm_result: { urgency: { value: 'high', confidence: 0.45 } },
  threshold: 0.8,
  action: 'discard'  // Below threshold
}
```

✅ **Accept**: High confidence results
```javascript
{
  llm_result: { urgency: { value: 'critical', confidence: 0.92 } },
  threshold: 0.8,
  action: 'merge'  // Above threshold
}
```

---

## Isolation Boundary Diagram

```
┌────────────────────────────────────────────────────────┐
│ LLM-Assisted Parsing Isolation Boundaries              │
└────────────────────────────────────────────────────────┘

Constraint 1: Source Isolation
┌─────────────────────────────────────────┐
│ LLM receives ONLY context-sourced       │
│ signals; scope and timestamp are        │
│ pre-populated and read-only             │
└─────────────────────────────────────────┘
         ↓
Constraint 2: Determinism Protection
┌─────────────────────────────────────────┐
│ If deterministic extraction found it,   │
│ LLM result is ignored; deterministic    │
│ always wins                             │
└─────────────────────────────────────────┘
         ↓
Constraint 3: Risk Monotonicity
┌─────────────────────────────────────────┐
│ LLM may never clear risk indicators;    │
│ can only maintain or increase suspicion │
└─────────────────────────────────────────┘
         ↓
Constraint 4: No Direct Verdict Influence
┌─────────────────────────────────────────┐
│ LLM populates signals only; policies    │
│ evaluate those signals to issue verdicts│
└─────────────────────────────────────────┘
         ↓
Constraint 5: Graceful Degradation
┌─────────────────────────────────────────┐
│ If LLM fails, system continues safely   │
│ with deterministic results only         │
└─────────────────────────────────────────┘
         ↓
Constraint 6: No Input Persistence
┌─────────────────────────────────────────┐
│ Unstructured input NOT stored; only     │
│ extracted signals persisted to audit    │
└─────────────────────────────────────────┘
         ↓
Constraint 7: Confidence Threshold
┌─────────────────────────────────────────┐
│ Low-confidence results auto-discarded;  │
│ threshold prevents low-quality signals  │
└─────────────────────────────────────────┘
```

---

## Compliance Verification

### Test Checklist

- [ ] **Source Filter**: Verify LLM cannot populate scope signals
- [ ] **Determinism Override**: Verify deterministic result blocks LLM result
- [ ] **Risk Monotonicity**: Verify LLM cannot flip true→false or clear signals
- [ ] **No Verdict**: Verify LLM output cannot set verdict directly
- [ ] **Graceful Failure**: Verify system works if LLM times out
- [ ] **No Persistence**: Verify unstructured input not in decision.context
- [ ] **Confidence Filter**: Verify results < threshold discarded
- [ ] **Error Handling**: Verify LLM exceptions logged, not thrown

### Security Review Questions

1. **Can LLM override a deterministic extraction?** No (Constraint 2)
2. **Can LLM populate scope signals?** No (Constraint 1)
3. **Can LLM clear risk indicators?** No (Constraint 3)
4. **Can LLM directly issue verdicts?** No (Constraint 4)
5. **What happens if LLM is down?** System continues (Constraint 5)
6. **Is unstructured input persisted?** No (Constraint 6)
7. **Can low-confidence results influence decisions?** No (Constraint 7)

---

## Audit Trail Implications

### What IS in Audit Trail

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
      "pattern_matched": "currency_symbol"
    },
    "policy_keyword": {
      "method": "deterministic",
      "pattern_matched": "refund_keyword"
    },
    "urgency": {
      "method": "assisted",
      "confidence": 0.92
    }
  }
}
```

### What is NOT in Audit Trail

```json
{
  // NOT stored:
  "unstructured_context": "Customer says...",
  "llm_response": "{ \"urgency\": ... }",
  "llm_prompt": "Extract signals from...",
  "llm_call_details": { ... }
}
```

---

## Recommendations for Deployers

1. **Start conservative**: `enableAssistedParsing: false` by default
2. **High threshold**: Start with `confidenceThreshold: 0.9` (90%)
3. **Per-domain control**: Finance/security have lower thresholds (stricter)
4. **Timeout protection**: Wrap LLM calls with timeouts (5s recommended)
5. **Monitoring**: Track LLM success rate, latency, confidence distribution
6. **Gradual rollout**: Enable for 10% of decisions, monitor, then increase
7. **Fallback testing**: Regularly test LLM failure scenarios
8. **Prompt review**: Have security team review LLM prompts before deployment

---

## References

- **Specification**: `RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md`
- **Implementation**: `LLM-ASSISTED-PARSING-IMPLEMENTATION.md`
- **Signal Extractors**: `HIGH-RISK-SIGNAL-EXTRACTORS.md`
- **Source Code**: `packages/server/src/observe/signal-populator.ts`

---

**Last Updated**: 2025-01-12  
**Status**: Non-negotiable Design Constraints
