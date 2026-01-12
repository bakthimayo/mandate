# Observe Phase & Evaluator: Complete Integration Guide

**Status**: ✅ Complete  
**Version**: 1.0  
**Date**: 2025-01-12  

---

## Purpose

This guide covers the **complete architecture** for signal population (Observe phase) and policy evaluation (Evaluator), ensuring clean separation of concerns and safe signal consumption.

---

## Quick Start

### For Architects
1. Read: [EVALUATOR-SEPARATION-OF-CONCERNS.md](file:///d:/Learnings/ai/POC/mandate/docs/EVALUATOR-SEPARATION-OF-CONCERNS.md)
2. Reference: Diagram below
3. Verify: [ENFORCEMENT-SEMANTICS-VERIFICATION.md](file:///d:/Learnings/ai/POC/mandate/docs/ENFORCEMENT-SEMANTICS-VERIFICATION.md)

### For Engineers
1. Read: [EVALUATOR-INPUT-CONTRACT.md](file:///d:/Learnings/ai/POC/mandate/docs/EVALUATOR-INPUT-CONTRACT.md)
2. Implement: Test cases from contract spec
3. Deploy: Follow checklist in [EVALUATOR-UPDATES-SUMMARY.md](file:///d:/Learnings/ai/POC/mandate/docs/EVALUATOR-UPDATES-SUMMARY.md)

### For Policy Authors
1. Read: [HIGH-RISK-SIGNAL-EXTRACTORS.md](file:///d:/Learnings/ai/POC/mandate/docs/HIGH-RISK-SIGNAL-EXTRACTORS.md)
2. Reference: Quick reference in [HIGH-RISK-EXTRACTORS-QUICK-REFERENCE.md](file:///d:/Learnings/ai/POC/mandate/docs/HIGH-RISK-EXTRACTORS-QUICK-REFERENCE.md)
3. Create: Policies binding to extracted signals

### For Security Reviewers
1. Read: [LLM-ASSISTED-PARSING-CONSTRAINTS.md](file:///d:/Learnings/ai/POC/mandate/docs/LLM-ASSISTED-PARSING-CONSTRAINTS.md)
2. Verify: [ENFORCEMENT-SEMANTICS-VERIFICATION.md](file:///d:/Learnings/ai/POC/mandate/docs/ENFORCEMENT-SEMANTICS-VERIFICATION.md)
3. Confirm: Isolation boundaries are enforced

---

## Documents Overview

### Signal Population (Observe Phase)

| Document | Purpose | Audience |
|----------|---------|----------|
| **RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md** | Full specification of LLM-assisted parsing as signal sensor | Architects, engineers |
| **LLM-ASSISTED-PARSING-IMPLEMENTATION.md** | Implementation guide with code examples | Engineers |
| **LLM-ASSISTED-PARSING-CONSTRAINTS.md** | Hard constraints and isolation boundaries | Security reviewers |
| **HIGH-RISK-SIGNAL-EXTRACTORS.md** | Specification for deterministic extractors | Engineers, policy authors |
| **HIGH-RISK-EXTRACTORS-QUICK-REFERENCE.md** | Quick reference for signal declarations and policies | Policy authors |

### Evaluator & Evaluation

| Document | Purpose | Audience |
|----------|---------|----------|
| **EVALUATOR-INPUT-CONTRACT.md** | Detailed contract for evaluator inputs and behavior | Engineers |
| **EVALUATOR-SEPARATION-OF-CONCERNS.md** | Architecture and boundaries between Observe and Evaluator | Architects |
| **ENFORCEMENT-SEMANTICS-VERIFICATION.md** | Proof that enforcement and verdict logic are unchanged | Security reviewers |
| **EVALUATOR-UPDATES-SUMMARY.md** | Summary of evaluator changes and deployment checklist | Engineers, architects |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ POST /api/v1/decisions                                          │
│ {                                                               │
│   decision: { context: {}, scope: {...}, ... },               │
│   unstructured_context?: "AI response or raw text"            │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
         ↓
    [Validation & Spec Resolution]
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ OBSERVE PHASE (Optional) - RFC-002 Section 7                    │
│                                                                 │
│ Input:                                                          │
│   - decision (empty context)                                    │
│   - spec (signal definitions)                                   │
│   - unstructured_text (AI response, logs, etc.)                │
│                                                                 │
│ Processing:                                                     │
│   1. Deterministic Extraction (Regex patterns, 100% authoritative)
│   2. Optional LLM-Assisted Parsing (Non-authoritative fallback)│
│   3. Confidence Filtering (Only >= threshold)                  │
│                                                                 │
│ Output:                                                         │
│   - decision.context enriched with populated signals           │
│                                                                 │
│ Constraints:                                                    │
│   ✓ Can parse text, call LLM, be async                         │
│   ✗ Cannot touch evaluator, issue verdicts                     │
└─────────────────────────────────────────────────────────────────┘
         ↓
   [Signal Validation]
   (All required signals present?)
         ↓
    [Insert Decision to Audit Trail]
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ EVALUATOR - RFC-001 Section 7                                   │
│                                                                 │
│ Input:                                                          │
│   - decision (with populated context)                           │
│   - spec (signal definitions + enforcement)                     │
│   - snapshot (policies to evaluate)                             │
│                                                                 │
│ Processing:                                                     │
│   1. For each policy:                                          │
│      a. Check scope matches                                    │
│      b. Evaluate all conditions                                │
│      c. If all conditions true, collect verdict               │
│   2. Resolve final verdict (precedence: BLOCK > PAUSE > ALLOW) │
│                                                                 │
│ Output:                                                         │
│   { verdict: 'ALLOW'|'PAUSE'|'BLOCK'|'OBSERVE',              │
│     matched_policy_ids: [...] }                               │
│                                                                 │
│ Constraints:                                                    │
│   ✓ Pure, deterministic, sync                                  │
│   ✗ Cannot parse text, call LLM                                │
└─────────────────────────────────────────────────────────────────┘
         ↓
    [Insert Verdict to Audit Trail]
         ↓
   Response: { decision, verdict }
```

---

## Key Principles

### 1. Signal Population First

**Before evaluating policies, all signals must be populated.**

```
    Unstructured Input
            ↓
    Observe Phase
    (Extract signals)
            ↓
    Populated Signals
            ↓
    Signal Validation
    (Check required)
            ↓
    Evaluator
    (Evaluate policies)
```

### 2. Evaluators Never Parse

**Evaluators consume only structured signals. No text parsing.**

```
    ✓ Evaluator can:
      - Read decision.context (populated signals)
      - Read decision.scope (governance fields)
      - Match policies against signals
      - Resolve verdicts

    ✗ Evaluator cannot:
      - Parse text
      - Call LLM
      - Infer signals
      - Modify inputs
```

### 3. Determinism Preserved

**Evaluators remain pure functions with deterministic output.**

```
    Same Input → Always Same Output

    Observe phase may be non-deterministic (LLM)
    But evaluator is always deterministic
```

### 4. Safety Guarantees

**Missing signals cause safe failures before evaluation.**

```
    Required signal missing
            ↓
    Signal Validator catches it
            ↓
    400 Error (before evaluation)
            ↓
    Evaluator never runs
            ↓
    No verdict issued
```

---

## Enforcement Semantics: No Changes

### Verdict Meanings (Unchanged)

| Verdict | Meaning | Enforcement | Before | After |
|---------|---------|-----------|--------|-------|
| BLOCK | Deny | Immediate | ✓ | ✓ |
| PAUSE | Hold + wait | pause_requires, timeout | ✓ | ✓ |
| ALLOW | Permit | Immediate | ✓ | ✓ |
| OBSERVE | Track | Log only | ✓ | ✓ |

### Verdict Precedence (Unchanged)

```
Before:  BLOCK > PAUSE > ALLOW > OBSERVE
After:   BLOCK > PAUSE > ALLOW > OBSERVE
```

### Default Verdict (Unchanged)

```
Before:  No match → ALLOW
After:   No match → ALLOW
```

---

## Data Flow: Input → Output

### Request

```json
{
  "decision": {
    "decision_id": "dec-123",
    "organization_id": "org-456",
    "domain_name": "finance",
    "intent": "transfer_funds",
    "stage": "proposed",
    "actor": "agent-001",
    "target": "account-789",
    "context": {},
    "scope": {
      "organization_id": "org-456",
      "domain_name": "finance",
      "service": "billing"
    },
    "timestamp": "2025-01-12T10:00:00Z"
  },
  "unstructured_context": "Please transfer $5000 with high priority"
}
```

### After Observe Phase

```json
{
  "decision": {
    "...": "same as above",
    "context": {
      "amount": 5000,
      "priority": "high"
    },
    "spec_id": "spec-transfer-001",
    "spec_version": "1.0.0"
  }
}
```

### Evaluator Output

```json
{
  "verdict": "PAUSE",
  "matched_policy_ids": ["pol-high-value-transfer"]
}
```

### Final Response

```json
{
  "decision": { /* enriched decision */ },
  "verdict": { /* verdict event */ }
}
```

---

## Signal Declaration Example

### DecisionSpec with Signals

```json
{
  "spec_id": "spec-transfer-001",
  "version": "1.0.0",
  "organization_id": "org-456",
  "domain_name": "finance",
  "intent": "transfer_funds",
  "stage": "proposed",
  "signals": [
    {
      "name": "amount",
      "type": "number",
      "source": "context",
      "required": true
    },
    {
      "name": "priority",
      "type": "enum",
      "values": ["low", "normal", "high", "critical"],
      "source": "context",
      "required": false
    },
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "source": "context",
      "required": false
    },
    {
      "name": "service",
      "type": "string",
      "source": "scope",
      "required": false
    }
  ],
  "allowed_verdicts": ["ALLOW", "PAUSE", "BLOCK"],
  "enforcement": {
    "pause_requires": ["manager_approval"],
    "resolution_timeout_minutes": 60
  }
}
```

### Signals Flow

```
Unstructured: "Please transfer $5000 with high priority"
        ↓
    [Deterministic Extraction]
    - "amount": 5000 (from "$5000")
    - "has_monetary_value": true (from currency symbol)
        ↓
    [Optional LLM Parsing]
    - "priority": "high" (from "high priority")
        ↓
    [Population]
    decision.context = {
      amount: 5000,
      has_monetary_value: true,
      priority: 'high'
    }
        ↓
    [Evaluator]
    - Policy 1: amount > 3000? YES
    - Policy 2: priority == 'high'? YES
    - Verdict: PAUSE (both matched)
```

---

## Policy Binding to Extracted Signals

### Example Policies

```json
[
  {
    "id": "pol-high-value",
    "name": "High-Value Transfer Requires Approval",
    "conditions": [
      { "field": "amount", "operator": ">", "value": 3000 }
    ],
    "verdict": "PAUSE",
    "spec_id": "spec-transfer-001"
  },
  {
    "id": "pol-priority-critical",
    "name": "Critical Priority Requires Escalation",
    "conditions": [
      { "field": "priority", "operator": "==", "value": "critical" }
    ],
    "verdict": "PAUSE",
    "spec_id": "spec-transfer-001"
  },
  {
    "id": "pol-all-monetary",
    "name": "All Monetary Transactions Must Be Logged",
    "conditions": [
      { "field": "has_monetary_value", "operator": "==", "value": true }
    ],
    "verdict": "OBSERVE",
    "spec_id": "spec-transfer-001"
  }
]
```

---

## Testing Strategy

### Unit Tests: Evaluator

```typescript
describe('Evaluator', () => {
  it('should evaluate policies with populated signals', () => {
    const decision = {
      context: { amount: 5000 },  // Populated
      scope: { organization_id: 'org-1', domain_name: 'finance' }
    };
    const result = evaluateDecision(decision, spec, snapshot);
    expect(result.verdict).toBeDefined();
  });

  it('should be deterministic', () => {
    const result1 = evaluateDecision(d, s, p);
    const result2 = evaluateDecision(d, s, p);
    expect(result1).toEqual(result2);
  });
});
```

### Integration Tests: Observe → Evaluate

```typescript
describe('End-to-End', () => {
  it('should populate signals then evaluate', async () => {
    const enriched = await observePhase(decision, spec, "Transfer $5000");
    expect(enriched.context.amount).toBe(5000);

    const result = evaluateDecision(enriched, spec, snapshot);
    expect(result.verdict).toBe('PAUSE');
  });
});
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code review: Evaluator has no text parsing
- [ ] Code review: Evaluator has no LLM calls
- [ ] Code review: Evaluator has no async
- [ ] Security review: LLM isolation boundaries
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Determinism tests passing

### Deployment

- [ ] Observe phase integrated in decisions route
- [ ] Signal validation running before evaluator
- [ ] Signals being populated correctly
- [ ] Evaluator receiving populated signals
- [ ] Verdicts being issued correctly
- [ ] Audit trail contains only signals (not raw text)

### Post-Deployment

- [ ] Monitor evaluator latency (should be < 10ms)
- [ ] Monitor signal population success rate
- [ ] Monitor policy match rate
- [ ] Monitor verdict distribution
- [ ] Verify backward compatibility (requests without unstructured_context work)

---

## Common Scenarios

### Scenario 1: Request With Unstructured Context

```
POST /api/v1/decisions
{
  "decision": { "context": {}, ... },
  "unstructured_context": "Charge $500"
}
  ↓
Observe Phase: Extract amount = 500
  ↓
Evaluator: Evaluate policies
  ↓
Verdict issued
```

### Scenario 2: Request Without Unstructured Context

```
POST /api/v1/decisions
{
  "decision": { "context": { "amount": 500 }, ... }
  // No unstructured_context
}
  ↓
Observe Phase: Skipped
  ↓
Evaluator: Evaluate policies with provided signals
  ↓
Verdict issued
```

### Scenario 3: LLM Unavailable

```
Observe Phase:
  ├─ Deterministic: Succeeded (extracted some signals)
  ├─ LLM: Failed (timeout)
  └─ Result: Continue with deterministic
  ↓
Evaluator: Evaluate with deterministic signals
  ↓
Verdict issued (LLM was optional)
```

### Scenario 4: Required Signal Missing

```
Observe Phase: Completed
  ↓
Signal Validator: Required signal NOT found
  ↓
400 Error returned
  ↓
Evaluator: Not called
  ↓
No verdict issued
```

---

## Quick Reference: Boundaries

### What Can Cross Boundary → Evaluator?

✅ `decision.context` (populated signals)  
✅ `decision.scope` (pre-populated governance)  
✅ `decision.timestamp` (pre-populated)  
✅ `spec.signals` (signal definitions)  
✅ `spec.enforcement` (enforcement semantics)  

### What CANNOT Cross Boundary?

❌ `unstructured_context` (stays in Observe)  
❌ `raw_text` (stays in Observe)  
❌ `extraction_metadata` (not passed)  
❌ `llm_confidence` (not passed)  
❌ Parsing functions, regex patterns  
❌ LLM calls, neural networks  

---

## FAQ

**Q: Can evaluator re-extract signals if unhappy with values?**  
A: No. Evaluator is pure evaluation. Re-extraction happens in Observe phase only.

**Q: What if Observe phase didn't populate a signal evaluator needs?**  
A: Policy won't match. Verdict will be based on other policies. This is correct.

**Q: Can we modify evaluator to call Observe phase?**  
A: No. They're decoupled. All extraction before evaluation.

**Q: Is there a way to bypass signal validation?**  
A: No. Required signals are mandatory. Safe failure if missing.

**Q: What if enforcement semantics need to change based on signals?**  
A: No. Enforcement is defined once in spec. Independent of signal values.

---

## References

### Specification Documents

- RFC-002 Section 7: Signal Population from Unstructured Context
- RFC-001 Section 7: Policy Evaluation and Verdicts
- HIGH-RISK-SIGNAL-EXTRACTORS.md: Deterministic extractor patterns
- RFC-002-SECTION-7-LLM-ASSISTED-PARSING.md: LLM-assisted parsing spec

### Implementation Documents

- EVALUATOR-INPUT-CONTRACT.md: Evaluator input specification
- EVALUATOR-SEPARATION-OF-CONCERNS.md: Architecture overview
- ENFORCEMENT-SEMANTICS-VERIFICATION.md: Verification of unchanged semantics
- LLM-ASSISTED-PARSING-IMPLEMENTATION.md: Implementation guide

### Source Code

- packages/server/src/observe/signal-populator.ts: Signal extraction
- packages/server/src/evaluator/index.ts: Evaluator
- packages/server/src/evaluator/__internal__/condition-evaluator.ts: Condition logic
- packages/server/src/evaluator/__internal__/verdict-resolver.ts: Verdict resolution
- packages/server/src/routes/decisions.ts: API integration

---

**Version**: 1.0  
**Last Updated**: 2025-01-12  
**Status**: ✅ Complete & Ready for Deployment
