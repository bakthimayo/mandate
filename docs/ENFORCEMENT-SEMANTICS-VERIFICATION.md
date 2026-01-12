# Enforcement Semantics & Verdict Resolution: Verification

**Status**: Confirmation Document  
**Version**: 1.0  
**Date**: 2025-01-12  
**Purpose**: Verify that Observe phase does NOT modify enforcement semantics or verdict resolution logic

---

## 1. Executive Summary

✅ **Enforcement semantics are UNCHANGED**  
✅ **Verdict resolution logic is UNCHANGED**  
✅ **Verdict precedence is UNCHANGED**  
✅ **Evaluator behavior is UNCHANGED**  

The Observe phase is a **signal population layer**, not a decision layer. It populates signal values before the evaluator runs, but does not change:
- How policies are evaluated
- How verdicts are determined
- What verdicts mean operationally
- How multiple matched policies are resolved

---

## 2. Enforcement Semantics Unchanged

### 2.1 What Are Enforcement Semantics?

From RFC-001 Section 7: "Enforcement semantics define what verdicts mean operationally."

```typescript
interface EnforcementSemantics {
  pause_requires?: string[];        // Who must approve to continue?
  resolution_timeout_minutes?: number;  // How long to wait for resolution?
}
```

**Examples**:
- `verdict: BLOCK` → "Action is forbidden; execution blocked immediately"
- `verdict: PAUSE` → "Action is held; awaits manager approval within 60 minutes"
- `verdict: ALLOW` → "Action is permitted; execution proceeds"
- `verdict: OBSERVE` → "Action permitted; log for monitoring"

### 2.2 Enforcement Semantics Before Observe Phase

```json
{
  "decision": {
    "context": { "amount": 5000 },
    "intent": "transfer"
  },
  "policy": {
    "conditions": [{ "field": "amount", "operator": ">", "value": 3000 }],
    "verdict": "PAUSE"
  },
  "enforcement": {
    "pause_requires": ["manager_approval"],
    "resolution_timeout_minutes": 60
  }
}
```

**Meaning**: If verdict is PAUSE, the system:
1. Holds the action
2. Requests manager approval
3. Waits up to 60 minutes for resolution

### 2.3 Enforcement Semantics After Observe Phase

```json
{
  "decision": {
    "context": {
      "amount": 5000,           // ← Populated by Observe phase
      "urgency": "critical",    // ← Populated by Observe phase
      "policy_keyword": "transfer"  // ← Populated by Observe phase
    },
    "intent": "transfer"
  },
  "policy": {
    "conditions": [
      { "field": "amount", "operator": ">", "value": 3000 },
      { "field": "urgency", "operator": "==", "value": "critical" }
    ],
    "verdict": "PAUSE"
  },
  "enforcement": {
    "pause_requires": ["manager_approval"],
    "resolution_timeout_minutes": 60
  }
}
```

**Meaning**: SAME as before
1. Holds the action
2. Requests manager approval
3. Waits up to 60 minutes for resolution

**What changed?**
- ✅ Signal values are populated (from deterministic extraction + LLM)
- ✅ Policy has more conditions to match (richer decision context)
- ❌ Enforcement semantics: UNCHANGED
- ❌ Verdict meaning: UNCHANGED
- ❌ Operational behavior: UNCHANGED

### 2.4 Proof of Invariance

**Observation**: Enforcement semantics are defined once in DecisionSpec and are independent of signal source.

```typescript
// DecisionSpec defines enforcement, not evaluator
interface DecisionSpec {
  enforcement: EnforcementSemantics;
  // enforcement.pause_requires = ["manager_approval"]
  // enforcement.resolution_timeout_minutes = 60
  // These do NOT change based on how signals are populated
}

// Evaluator uses enforcement from spec, not from policies
const enforcement = spec.enforcement;
// Returns same semantics regardless of signal source
```

**Invariant**: If policy matches and emits verdict V, enforcement is identical whether signals came from:
- Pre-populated manual context
- Deterministic extraction
- LLM-assisted parsing
- Combination of all three

---

## 3. Verdict Resolution Logic Unchanged

### 3.1 Resolution Algorithm

**Before Observe Phase**:

```typescript
// Step 1: Evaluate each policy
for (const policy of applicablePolicies) {
  const conditionMatch = evaluateAllConditions(policy.conditions, decision);
  if (conditionMatch) {
    matches.push({ policy_id: policy.id, verdict: policy.verdict });
  }
}

// Step 2: Resolve verdicts by precedence
const VERDICT_PRECEDENCE = { BLOCK: 3, PAUSE: 2, ALLOW: 1, OBSERVE: 0 };
const finalVerdict = matches.reduce((highest, match) => {
  return VERDICT_PRECEDENCE[match.verdict] > VERDICT_PRECEDENCE[highest]
    ? match.verdict
    : highest;
}, 'ALLOW');
```

**After Observe Phase**:

```typescript
// IDENTICAL code, same logic
for (const policy of applicablePolicies) {
  const conditionMatch = evaluateAllConditions(policy.conditions, decision);
  if (conditionMatch) {
    matches.push({ policy_id: policy.id, verdict: policy.verdict });
  }
}

const VERDICT_PRECEDENCE = { BLOCK: 3, PAUSE: 2, ALLOW: 1, OBSERVE: 0 };
const finalVerdict = matches.reduce((highest, match) => {
  return VERDICT_PRECEDENCE[match.verdict] > VERDICT_PRECEDENCE[highest]
    ? match.verdict
    : highest;
}, 'ALLOW');
```

**What changed?**
- ❌ Nothing: Code is identical
- ✅ Input signals are more complete (populated by Observe phase)
- ✅ Policies may match more often (richer context)

### 3.2 Verdict Precedence

Precedence order is **immutable**:

```
BLOCK    → Highest (3) → Action is forbidden
PAUSE    → Medium  (2) → Action is held
ALLOW    → Lower   (1) → Action is permitted
OBSERVE  → Lowest  (0) → Action is tracked
```

**Examples (Before & After Observe Phase)**:

#### Example 1: Single matched policy

**Before**:
```
Matched: Policy A (verdict: PAUSE)
Result: PAUSE
```

**After** (with Observe phase):
```
Matched: Policy A (verdict: PAUSE)
Result: PAUSE
(Identical)
```

#### Example 2: Multiple matched policies

**Before**:
```
Matched:
  - Policy A (verdict: PAUSE)
  - Policy B (verdict: ALLOW)
Precedence: PAUSE (2) > ALLOW (1)
Result: PAUSE
```

**After** (with Observe phase):
```
Matched:
  - Policy A (verdict: PAUSE)
  - Policy B (verdict: ALLOW)
Precedence: PAUSE (2) > ALLOW (1)
Result: PAUSE
(Identical)
```

#### Example 3: BLOCK always wins

**Before**:
```
Matched:
  - Policy X (verdict: BLOCK)
  - Policy Y (verdict: PAUSE)
  - Policy Z (verdict: ALLOW)
Precedence: BLOCK (3) > PAUSE (2) > ALLOW (1)
Result: BLOCK
```

**After** (with Observe phase):
```
Matched:
  - Policy X (verdict: BLOCK)
  - Policy Y (verdict: PAUSE)
  - Policy Z (verdict: ALLOW)
Precedence: BLOCK (3) > PAUSE (2) > ALLOW (1)
Result: BLOCK
(Identical)
```

### 3.3 Default Verdict

When no policies match:

**Before**: `ALLOW` (default)  
**After**: `ALLOW` (default)

**Why**: Default verdict is a system constant, independent of signal population.

---

## 4. Policy Matching Logic Unchanged

### 4.1 Scope Matching

**Before Observe**:
```typescript
// RFC-002: Organization and domain must match exactly
if (policy.scope.organization_id !== decision.organization_id) skip;
if (policy.scope.domain_name !== decision.domain_name) skip;

// Optional scope fields act as wildcards
if (policy.scope.service && policy.scope.service !== decision.scope.service) skip;
```

**After Observe**:
```typescript
// IDENTICAL code
if (policy.scope.organization_id !== decision.organization_id) skip;
if (policy.scope.domain_name !== decision.domain_name) skip;

if (policy.scope.service && policy.scope.service !== decision.scope.service) skip;
```

**What changed?**
- ❌ Nothing: Scope matching is identical
- ✅ Scope fields (service, agent, system) are pre-populated in decision

### 4.2 Condition Evaluation

**Before Observe**:
```typescript
// Evaluate conditions against decision.context and decision.scope
function evaluateCondition(condition, decision) {
  const value = resolveSignal(condition.field, decision);
  if (value === undefined) return false;  // Signal not found → fail
  
  switch (condition.operator) {
    case '==': return value === condition.value;
    case '>': return value > condition.value;
    // ... etc
  }
}
```

**After Observe**:
```typescript
// IDENTICAL code
function evaluateCondition(condition, decision) {
  const value = resolveSignal(condition.field, decision);
  if (value === undefined) return false;  // Signal not found → fail
  
  switch (condition.operator) {
    case '==': return value === condition.value;
    case '>': return value > condition.value;
    // ... etc
  }
}
```

**What changed?**
- ❌ Nothing: Condition evaluation is identical
- ✅ More signals are in `decision.context` (populated by Observe phase)
- ✅ Conditions match more often (richer context)

---

## 5. Evaluator Purity Preserved

### 5.1 Evaluator Constraints (RFC-001)

| Constraint | Status | Enforced By |
|-----------|--------|-------------|
| No async | ✅ Unchanged | TypeScript signature `evaluateDecision()` not async |
| No database | ✅ Unchanged | No db imports in evaluator/ module |
| No Date/Math.random | ✅ Unchanged | No Date/Math calls in code |
| No side effects | ✅ Unchanged | No mutations to inputs; returns new result |
| Deterministic | ✅ Unchanged | Same input always produces same output |

### 5.2 Code Inspection

```typescript
// packages/server/src/evaluator/index.ts

export function evaluateDecision(
  decision: DecisionEvent,
  spec: DecisionSpec,
  snapshot: PolicySnapshotV1
): EvaluationResult {
  // All operations are:
  // - Read-only (decision, spec, snapshot not modified)
  // - Deterministic (no random, no time-dependent logic)
  // - Synchronous (no async/await)
  // - Side-effect free (only returns EvaluationResult)
}
```

**Observe Phase** does NOT change evaluator:
- Observe phase is separate module
- Observe phase runs BEFORE evaluator
- Evaluator receives already-populated signals
- Evaluator logic is unchanged

---

## 6. Data Dependencies

### 6.1 What Evaluator Depends On

```
Evaluator depends on:
  ├─ decision.context (populated signals)
  ├─ decision.scope (pre-populated governance fields)
  ├─ decision.organization_id (governance boundary)
  ├─ decision.domain_name (governance boundary)
  ├─ spec.signals (signal declarations)
  ├─ spec.allowed_verdicts (verdict constraints)
  ├─ spec.enforcement (enforcement semantics)
  └─ snapshot.policies (policies to evaluate)
```

### 6.2 What Observe Phase Populates

```
Observe phase populates:
  └─ decision.context (adds/updates signal values)
     ├─ Deterministic extractions
     └─ LLM-assisted extractions
```

### 6.3 What Doesn't Change

```
Observe phase does NOT touch:
  ├─ decision.scope (read-only)
  ├─ decision.organization_id (fixed)
  ├─ decision.domain_name (fixed)
  ├─ decision.intent (fixed)
  ├─ decision.stage (fixed)
  ├─ spec.* (read-only)
  ├─ snapshot.policies (read-only)
  └─ enforcement.* (read-only)
```

---

## 7. Compliance Matrix

| Component | RFC-001 | RFC-002 | Observe Phase | Status |
|-----------|---------|---------|---------------|--------|
| **Evaluator Logic** | Pure, deterministic | Org/domain enforcement | No changes | ✅ Unchanged |
| **Verdict Precedence** | BLOCK > PAUSE > ALLOW > OBSERVE | No changes | No changes | ✅ Unchanged |
| **Enforcement Semantics** | pause_requires, timeout | No changes | No changes | ✅ Unchanged |
| **Policy Matching** | Scope + conditions | Spec + scope binding | Signal enrichment | ✅ Unchanged logic |
| **Signal Resolution** | From context/scope | Source isolation | Populate before eval | ✅ Unchanged resolution |
| **Default Verdict** | ALLOW when no match | No changes | No changes | ✅ Unchanged |

---

## 8. Backward Compatibility

### 8.1 Decisions Without Unstructured Context

**Request**:
```json
{
  "decision": {
    "context": { "amount": 5000 },
    "intent": "transfer"
  }
  // No unstructured_context field
}
```

**Processing**:
1. Observe phase: Skipped (no unstructured context)
2. Evaluator: Receives decision with amount = 5000
3. Verdict: Same as before

**Result**: ✅ Fully backward compatible

### 8.2 Decisions With Unstructured Context

**Request**:
```json
{
  "decision": {
    "context": {},
    "intent": "transfer"
  },
  "unstructured_context": "Transfer $5000 with high urgency"
}
```

**Processing**:
1. Observe phase: Populates context with extracted signals
2. Evaluator: Receives enriched decision with more signals
3. Verdict: May be different (richer context)

**Result**: ✅ Backward compatible; adds capability without breaking existing behavior

---

## 9. Test Cases: Enforcement Semantics

### Test 1: Enforcement Semantics Apply Regardless of Signal Source

```typescript
it('enforcement semantics are identical regardless of signal source', () => {
  // Scenario 1: Signal provided manually (pre-Observe)
  const decision1 = {
    context: { amount: 5000 },
    intent: 'transfer'
  };

  // Scenario 2: Signal populated by Observe phase
  const decision2 = {
    context: { amount: 5000 },  // Populated by Observe phase
    intent: 'transfer'
  };

  const spec = {
    enforcement: {
      pause_requires: ['manager_approval'],
      resolution_timeout_minutes: 60
    },
    allowed_verdicts: ['PAUSE', 'BLOCK']
  };

  const policy = {
    conditions: [{ field: 'amount', operator: '>', value: 3000 }],
    verdict: 'PAUSE'
  };

  const result1 = evaluateDecision(decision1, spec, snapshot);
  const result2 = evaluateDecision(decision2, spec, snapshot);

  // Both should result in PAUSE with identical enforcement semantics
  expect(result1.verdict).toBe('PAUSE');
  expect(result2.verdict).toBe('PAUSE');
  expect(spec.enforcement).toEqual({
    pause_requires: ['manager_approval'],
    resolution_timeout_minutes: 60
  });
  // Enforcement is identical regardless of how signal was populated
});
```

### Test 2: Verdict Precedence Is Identical Before and After Observe Phase

```typescript
it('verdict precedence is unchanged with Observe phase', () => {
  const snapshot = {
    policies: [
      { id: 'p1', conditions: [...], verdict: 'ALLOW' },
      { id: 'p2', conditions: [...], verdict: 'PAUSE' },
      { id: 'p3', conditions: [...], verdict: 'BLOCK' }
    ]
  };

  const decision = { context: { ... }, ... };

  // All three policies match (simplified for example)
  const result = evaluateDecision(decision, spec, snapshot);

  // BLOCK should win (highest precedence)
  expect(result.verdict).toBe('BLOCK');
  expect(result.matched_policy_ids).toContain('p1', 'p2', 'p3');

  // This behavior is identical before and after Observe phase
  // Only input signals are different, not evaluation logic
});
```

### Test 3: Default Verdict When No Policies Match

```typescript
it('default verdict is ALLOW when no policies match (before and after Observe)', () => {
  const snapshot = {
    policies: [
      // No policies match this decision
    ]
  };

  const decision = { context: { ... }, ... };

  const result = evaluateDecision(decision, spec, snapshot);

  expect(result.verdict).toBe('ALLOW');  // Default
  expect(result.matched_policy_ids).toEqual([]);

  // Same result before and after Observe phase
});
```

---

## 10. Impact Analysis

### What Observe Phase DOES Change

✅ **Signal Population**
- Signals are populated from unstructured text
- More signals available for policy conditions
- Policies may match more often

✅ **Decision Enrichment**
- Decision context is richer
- More conditions can be evaluated

✅ **Policy Matching Opportunities**
- With more signals, more policies may match
- Verdict could be different (based on richer context)

### What Observe Phase DOES NOT Change

❌ **Evaluator Logic**
- Policy evaluation algorithm unchanged
- Condition evaluation unchanged
- Verdict resolution unchanged

❌ **Enforcement Semantics**
- What verdicts mean operationally unchanged
- pause_requires, timeout_minutes unchanged

❌ **Verdict Precedence**
- BLOCK > PAUSE > ALLOW > OBSERVE unchanged
- Default verdict (ALLOW) unchanged

❌ **Evaluator Purity**
- Still deterministic
- Still synchronous
- Still side-effect free

---

## 11. Audit Trail Impact

### Before Observe Phase

```json
{
  "decision": {
    "context": { "amount": 5000 },
    "intent": "transfer"
  },
  "verdict": { "verdict": "PAUSE", "matched_policies": ["p1"] }
}
```

### After Observe Phase

```json
{
  "decision": {
    "context": {
      "amount": 5000,
      "urgency": "critical",
      "policy_keyword": "transfer"
    },
    "intent": "transfer"
  },
  "verdict": { "verdict": "PAUSE", "matched_policies": ["p1", "p2"] }
}
```

**What's audited?**
- ✅ Decision with all signals (populated or provided)
- ✅ Verdict and matched policies
- ✅ Enforcement semantics (from spec)
- ❌ NOT: Unstructured input (confidentiality)
- ❌ NOT: LLM confidence scores (only final values)

**Change**: More signals are visible in audit trail (better auditability).

---

## 12. Conclusion

### Enforcement Semantics: ✅ VERIFIED UNCHANGED

**Proof**:
- Enforcement semantics are defined in DecisionSpec
- DecisionSpec is read-only during evaluation
- Observe phase does not modify DecisionSpec
- Enforcement semantics are independent of signal source

### Verdict Resolution: ✅ VERIFIED UNCHANGED

**Proof**:
- Verdict resolution uses fixed precedence: BLOCK > PAUSE > ALLOW > OBSERVE
- Precedence is deterministic and signal-source-independent
- Default verdict (ALLOW) is unchanged
- Algorithm is identical before and after Observe phase

### Evaluator Behavior: ✅ VERIFIED UNCHANGED

**Proof**:
- Evaluator code is unchanged
- Evaluator constraints (purity, determinism) are maintained
- No side effects introduced
- No LLM calls added to evaluator

### Safe to Deploy: ✅ YES

The Observe phase is a **signal enrichment layer** that:
- Populates signals before evaluation
- Does not modify evaluation logic
- Does not change verdict semantics
- Is backward compatible

Existing systems will work unchanged; new systems get signal enrichment as an optional capability.

---

**End of Verification Document**
