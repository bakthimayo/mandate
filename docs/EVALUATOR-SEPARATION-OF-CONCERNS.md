# Evaluator Separation of Concerns: Summary

**Purpose**: Clarify the boundary between signal population (Observe phase) and policy evaluation (Evaluator)  
**Audience**: Architects, engineers, policy authors  
**Status**: Design specification

---

## 1. Core Principle

**Evaluators consume only populated signal values. They never parse raw text, never call LLMs, and never perform signal extraction.**

```
Unstructured Input
      ↓
  OBSERVE PHASE (RFC-002 Section 7)
  ├─ Deterministic extraction
  └─ Optional LLM-assisted parsing
      ↓
  Populated Signals in decision.context
      ↓
  EVALUATOR (RFC-001 Section 7)
  ├─ Scope matching
  ├─ Policy condition evaluation
  └─ Verdict resolution
      ↓
  Verdict (ALLOW|PAUSE|BLOCK|OBSERVE)
```

---

## 2. Quick Reference: What Each Module Does

| Concern | Observe Phase | Evaluator |
|---------|---------------|-----------|
| **Input** | Unstructured text | Populated signals |
| **Output** | Signal values | Verdict |
| **Parsing** | ✓ Extracts from text | ✗ Never parses text |
| **LLM** | ✓ Optional (controlled) | ✗ Never calls LLM |
| **Extraction Logic** | ✓ Regex, pattern matching | ✗ Only signal matching |
| **Determinism** | ✓ Deterministic | ✓ Deterministic |
| **Async** | ✓ Can be async (LLM) | ✗ Sync only |
| **Side Effects** | ✗ None | ✗ None |
| **Database Access** | ✗ None | ✗ None |
| **Random/Time** | ✗ None | ✗ None |

---

## 3. Input/Output Contracts

### Observe Phase

**Input**: 
```typescript
{
  decision: DecisionEvent,        // With unstructured input?
  spec: DecisionSpec,              // Signal declarations
  unstructuredText: string         // AI response, logs, etc.
}
```

**Output**:
```typescript
{
  decision: DecisionEvent with populated context  // Enriched signals
}
```

**Example**:
```
Input:  decision.context = {}
        unstructuredText = "Charge $500 with high priority"

Output: decision.context = {
          amount: 500,
          priority: 'high'
        }
```

### Evaluator

**Input**:
```typescript
{
  decision: DecisionEvent,         // With populated context
  spec: DecisionSpec,               // Signal declarations + enforcement
  snapshot: PolicySnapshotV1       // Policies to evaluate
}
```

**Output**:
```typescript
{
  verdict: 'ALLOW' | 'PAUSE' | 'BLOCK' | 'OBSERVE',
  matched_policy_ids: string[]
}
```

**Example**:
```
Input:  decision.context = { amount: 500, priority: 'high' }
        policy = { condition: amount > 300, verdict: PAUSE }

Output: { verdict: 'PAUSE', matched_policy_ids: ['policy-1'] }
```

---

## 4. Design Constraints

### Observe Phase Constraints

✅ **Can**:
- Extract signals from unstructured text
- Call LLM for fuzzy extraction (confidently/threshold)
- Be async (network calls)
- Fail gracefully (no LLM → continue with deterministic)

❌ **Cannot**:
- Modify evaluator logic
- Issue verdicts
- Persist unstructured input
- Access evaluator internals

### Evaluator Constraints

✅ **Can**:
- Read populated signals from decision.context
- Read pre-populated fields from decision.scope
- Reference declared signals from spec
- Match policies and resolve verdicts

❌ **Cannot**:
- Parse raw text
- Call LLM services
- Modify decision or spec
- Access database
- Use Date/Math.random
- Perform async operations

---

## 5. Signal Flow Guarantee

### Contract: Populated Before Evaluation

```
POST /api/v1/decisions
  │
  ├─→ [1] Resolve DecisionSpec
  │
  ├─→ [2] OBSERVE PHASE
  │       Input: decision + spec + unstructured_context
  │       Output: decision with populated context
  │       └─→ decision.context enriched with signals
  │
  ├─→ [3] Validate all required signals present
  │
  ├─→ [4] EVALUATOR
  │       Input: decision (with populated context) + spec + snapshot
  │       Output: verdict + matched_policy_ids
  │       └─→ Never sees unstructured_context
  │
  └─→ [5] Persist decision + verdict
```

**Invariant**: When evaluator runs, all required signals are populated. No extraction happens during evaluation.

---

## 6. Data Isolation

### What Evaluator Can Access

```typescript
decision = {
  context: {
    // ✓ Populated signals only
    "amount": 5000,
    "urgency": "critical",
    "has_monetary_value": true,
    // ...
  },
  scope: {
    // ✓ Pre-populated governance fields
    "organization_id": "org-123",
    "domain_name": "finance",
    "service": "billing"
  },
  timestamp: "2025-01-12T...",  // ✓ Pre-populated
  intent: "transfer",            // ✓ Fixed
  stage: "proposed"              // ✓ Fixed
}
```

### What Evaluator Cannot Access

```typescript
// ✗ Never available to evaluator:
unstructured_context       // Consumed by Observe phase, not passed to evaluator
raw_text                   // Never stored in decision
ai_response                // Never stored in decision
extraction_metadata        // Not persisted
llm_confidence            // Not available to evaluator
```

---

## 7. Determinism Guarantee

### Before Observe Phase

```typescript
// Evaluator is deterministic IF signals are given
const verdict1 = evaluateDecision(decision, spec, snapshot);
const verdict2 = evaluateDecision(decision, spec, snapshot);
// verdict1 === verdict2 ✓
```

### After Observe Phase

```typescript
// Observe phase may be non-deterministic (LLM can be)
const enriched1 = observePhase(decision, spec, unstructuredText);
const enriched2 = observePhase(decision, spec, unstructuredText);
// enriched1.context.signal1 !== enriched2.context.signal1 ✗ (if LLM)

// BUT: Evaluator is still deterministic on input
const verdict1 = evaluateDecision(enriched1, spec, snapshot);
const verdict2 = evaluateDecision(enriched2, spec, snapshot);
// verdict1 === verdict2 (different signals → different verdicts, but deterministic)
```

**Key**: Evaluator doesn't add non-determinism; it faithfully evaluates whatever signals it receives.

---

## 8. Testing Strategy

### Unit Test: Evaluator

```typescript
describe('Evaluator', () => {
  it('evaluates policies based on populated signals only', () => {
    const decision = {
      context: { amount: 5000 },  // Pre-populated
      scope: { organization_id: 'org-1' },
      // ✗ No unstructured_context
    };

    const result = evaluateDecision(decision, spec, snapshot);
    // ✓ Works with pre-populated signals
    expect(result.verdict).toBeDefined();
  });

  it('is deterministic', () => {
    const result1 = evaluateDecision(decision, spec, snapshot);
    const result2 = evaluateDecision(decision, spec, snapshot);
    expect(result1).toEqual(result2);  // ✓ Identical
  });

  it('never accesses unstructured text', () => {
    const decision = {
      context: { amount: 5000 },
      unstructured_context: "Charge $500"  // ✗ Should not use this
    };

    // Evaluator should ignore unstructured_context entirely
    const result = evaluateDecision(decision, spec, snapshot);
    expect(result.verdict).not.toContain(unstructured_context);
  });
});
```

### Integration Test: End-to-End

```typescript
describe('End-to-End: Observe → Evaluate', () => {
  it('should enrich signals, then evaluate', async () => {
    const decision = { context: {}, scope: { ... } };
    const unstructuredText = "Charge $5000 with urgency";

    // Step 1: Observe phase populates signals
    const enriched = await observePhase(decision, spec, unstructuredText);
    expect(enriched.context.amount).toBe(5000);
    expect(enriched.context.urgency).toBeDefined();

    // Step 2: Evaluator receives enriched decision
    const result = evaluateDecision(enriched, spec, snapshot);
    expect(result.verdict).toBeDefined();

    // Step 3: Unstructured text is NOT in audit trail
    expect(enriched.context).not.toHaveProperty('unstructured_context');
  });
});
```

---

## 9. Error Scenarios

### Scenario 1: Observe Phase Fails

```
Decision arrives
  ├─ Observe phase: Error in extraction
  └─ System: 500 Bad Request
     └─ Evaluator NOT called
     └─ No verdict issued
```

**Recovery**: Caller retries or provides explicit signals.

### Scenario 2: Required Signal Missing

```
Decision arrives
  ├─ Observe phase: Completed
  ├─ Signal validation: Required signal NOT found
  └─ System: 400 Bad Request
     └─ Evaluator NOT called
     └─ No verdict issued
```

**Recovery**: Caller provides missing signal or Observe phase must extract it.

### Scenario 3: LLM Unavailable

```
Decision arrives
  ├─ Observe phase:
  │   ├─ Deterministic extraction: ✓ Succeeded
  │   ├─ LLM parsing: ✗ Timeout
  │   └─ Fallback: Continue with deterministic
  ├─ Signal validation: ✓ Required signals present
  ├─ Evaluator: ✓ Runs normally
  └─ Verdict: ✓ Issued
```

**Result**: System works; LLM was optional.

### Scenario 4: Evaluator With Incomplete Context

```
Decision arrives
  ├─ Observe phase: Some signals extracted, some optional signals missing
  ├─ Signal validation: ✓ All required signals present
  ├─ Evaluator:
  │   ├─ Policy A: Matches (references required signals)
  │   ├─ Policy B: Skipped (references missing optional signal)
  │   └─ Verdict: Based on Policy A
```

**Result**: Evaluator continues with available signals; missing optional signals don't block.

---

## 10. Enforcement & Audit

### Enforcement (RFC-001, RFC-002)

Enforced by:
1. **Type System**: Evaluator signature doesn't accept unstructured text
2. **Module Boundaries**: evaluator/ imports no observe/ modules
3. **Code Review**: No text parsing in evaluator/
4. **Tests**: Explicit tests that evaluator rejects raw text

### Audit

**What's persisted**:
- ✓ Decision with populated signals
- ✓ Verdict and matched policies
- ✓ Enforcement semantics

**What's NOT persisted**:
- ✗ Unstructured input
- ✗ Extraction metadata
- ✗ LLM confidence scores
- ✗ Intermediate states

---

## 11. FAQ

**Q: Can evaluator re-extract signals if unhappy with populated values?**  
A: No. Evaluator receives what Observe phase gave it. If extraction quality is poor, that's a signal population issue, not an evaluator issue.

**Q: What if a policy needs a signal that Observe phase couldn't extract?**  
A: The signal won't be populated, the policy won't match, and a different verdict will be issued. This is correct behavior.

**Q: Can evaluator call Observe phase to re-extract?**  
A: No. Evaluator doesn't know about Observe phase. They're decoupled.

**Q: What if we want to make extraction decisions?**  
A: That happens in Observe phase. Evaluators only consume the results.

**Q: Is evaluator testable without Observe phase?**  
A: Yes. Mock the populated signals, test the evaluator logic. This is the whole point of separation.

---

## 12. Benefits of Separation

| Benefit | Reason |
|---------|--------|
| **Testability** | Can test evaluator with fixed signals; no need to mock Observe |
| **Determinism** | Evaluator is pure function; Observe can be stateful/async |
| **Audibility** | Clear boundary between extraction and evaluation |
| **Reusability** | Evaluator can be used with different signal sources |
| **Scalability** | Observe and Evaluator can be independent services |
| **Clarity** | Each module has single responsibility |
| **Safety** | Missing signals caught before evaluation, not during |

---

## 13. References

- **EVALUATOR-INPUT-CONTRACT.md**: Detailed contract for evaluator input
- **RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md**: Observe phase specification
- **ENFORCEMENT-SEMANTICS-VERIFICATION.md**: Proof that enforcement is unchanged
- **packages/server/src/evaluator/index.ts**: Source code
- **packages/server/src/routes/decisions.ts**: API integration

---

**End of Summary**
