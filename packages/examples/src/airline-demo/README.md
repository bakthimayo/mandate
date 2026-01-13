# Airline Chatbot Demo - Mandate Governance Example

## Overview

This demo showcases **Mandate governance in action**: intercepting an unverified pricing claim from a third-party chatbot and preventing it from reaching customers.

**Scenario:** Customer service chatbot claims a $500 refund without escalation. Mandate detects this as a high-risk claim, issues a PAUSE verdict, and sends a safe fallback response instead.

---

## Files in This Demo

| File | Purpose |
|------|---------|
| [`airline-chatbot-demo.md`](./airline-chatbot-demo.md) | Complete walkthrough of PAUSE policy scenario |
| [`airline-chatbot-demo.ts`](./airline-chatbot-demo.ts) | TypeScript code showing chatbot integration with Mandate |
| [`airline-spec-and-policy.json`](./airline-spec-and-policy.json) | PAUSE policy data: DecisionSpec v1.0.0, Policy, Requests, Responses |
| [`airline-block-policy-example.json`](./airline-block-policy-example.json) | BLOCK policy example: Fraudulent refund prevention |
| [`spec-migration-for-block.json`](./spec-migration-for-block.json) | Migration guide: Extending spec to v1.1.0 for BLOCK policy |
| [`BLOCK-vs-PAUSE-Guide.md`](./BLOCK-vs-PAUSE-Guide.md) | Comparison of PAUSE and BLOCK verdicts with examples |
| [`README.md`](./README.md) | This file |

---

## Quick Flow Summary

```
1. CHATBOT GENERATES DRAFT
   "You can get a full $500 refund processed immediately..."
   ↓
2. SUBMIT TO MANDATE (pre-delivery)
   Decision with unstructured_context
   ↓
3. OBSERVE PHASE (Signal Population)
   Pattern match: "$500" → monetary_amount = 500
   Pattern match: "refund" → policy_keyword = "refund"
   ↓
4. SIGNAL VALIDATION
   ✓ All required signals populated
   ↓
5. POLICY EVALUATION
   Policy matches on: has_monetary_value=true + policy_keyword="refund" + amount>=100
   Verdict: PAUSE
   ↓
6. VERDICT ISSUED
   Return PAUSE to chatbot
   ↓
7. SAFE RESPONSE
   Send fallback instead of draft:
   "Your request requires review by our compliance team..."
   ↓
8. AUDIT TRAIL
   Decision and verdict recorded (immutable, append-only)
```

---

## Spec Migration: PAUSE → BLOCK

This demo includes two example policies:

1. **PAUSE Policy** (spec-refund-v1 v1.0.0)
   - File: [`airline-spec-and-policy.json`](./airline-spec-and-policy.json)
   - Scenario: $500 refund claim for future flight
   - Signals: `has_monetary_value`, `policy_keyword`, `monetary_amount`
   - Verdict: **PAUSE** (escalate for verification)

2. **BLOCK Policy** (spec-refund-v1 v1.1.0 - requires migration)
   - File: [`airline-block-policy-example.json`](./airline-block-policy-example.json)
   - Scenario: $375 refund for completed flight
   - New Signal: `flight_status` (added in v1.1.0)
   - Verdict: **BLOCK** (no escalation, invalid claim prevented)

**Migration Steps:**
1. Add `flight_status` signal to DecisionSpec (v1.0.0 → v1.1.0)
2. Create new BLOCK policy (pol-refund-002)
3. Create new policy snapshot (snap-20260112-v2)
4. Old decisions use old snapshot, new decisions use new snapshot

See [`spec-migration-for-block.json`](./spec-migration-for-block.json) for full migration guide with SQL examples.

---

## Key Concepts Demonstrated

### 1. **Third-Party Agent Integration**
- Chatbot is NOT aware of Mandate
- No SDK integration needed
- Pre-delivery interception via API call

### 2. **Unstructured Input Handling**
- Raw chatbot text is NOT used directly
- Signals extracted via deterministic patterns
- No LLM decision-making in evaluator

### 3. **Deterministic Signal Extraction**
- Currency pattern: `$500` → `monetary_amount = 500`
- Keyword pattern: `refund` → `policy_keyword = "refund"`
- Boolean pattern: `immediately` → `requires_escalation = false`
- Fully auditable, reproducible

### 4. **Policy-Based Governance**
- Single policy: "High-Risk Refund Claims Require Escalation"
- Conditions: `has_monetary_value=true AND policy_keyword="refund" AND monetary_amount>=100`
- Verdict: `PAUSE` (escalate to human)

### 5. **Safe Fallback Response**
- Original unverified draft is **blocked**
- Safe template sent instead
- Customer receives guidance without false claims

### 6. **Complete Audit Trail**
- Decision recorded with extracted signals
- Verdict recorded with matched policies
- Immutable timeline (append-only)

---

## What Mandate Prevents

### Without Mandate ❌
```
Customer: "Can I get a refund?"
Chatbot: "Yes, you can receive a full $500 refund processed immediately..."
Problems:
- Unverified refund amount
- No escalation to compliance
- No audit trail
- Potential policy violation
```

### With Mandate ✅
```
Customer: "Can I get a refund?"
Chatbot: "Your request requires review by our compliance team..."
Benefits:
- Signals extracted deterministically
- Policy matches on detected risk indicators
- Human escalation triggered
- Complete audit trail
- Compliance protected
```

---

## Integration Points

### API Request (POST `/api/v1/decisions`)

```typescript
{
  "decision": {
    "decision_id": "dec-airline-001",
    "organization_id": "acme-airlines",
    "domain_name": "customer-support",
    "intent": "issue_refund",
    "stage": "pre_commit",
    "actor": "chatbot-v3",
    "target": "customer:C123456",
    "scope": { /* organization, domain, agent, service, environment */ },
    "context": { /* customer_id, booking_id, etc. */ },
    "timestamp": "2026-01-12T14:30:00Z"
  },
  "unstructured_context": "Yes, you can receive a full refund of $500..."
}
```

### API Response

```typescript
{
  "decision": {
    /* Original decision + spec reference + populated signals */
    "context": {
      "customer_id": "C123456",
      "booking_id": "BK789",
      "has_monetary_value": true,
      "policy_keyword": "refund",
      "monetary_amount": 500,
      "requires_escalation": false
    },
    "spec_id": "spec-refund-v1",
    "spec_version": "1.0.0"
  },
  "verdict": {
    "verdict_id": "verd-airline-001",
    "verdict": "PAUSE",
    "matched_policy_ids": ["pol-refund-001"],
    "scope_id": "customer-support.chatbot-v3.production",
    "owning_team": "compliance-team"
  }
}
```

---

## Implementation Files

These files implement the demo scenario:

### Signal Extraction
- **Signal Population:** `packages/server/src/observe/signal-populator.ts`
  - `DeterministicExtractors` object with pattern-based extraction
  - `extractDeterministic()` function
  - `populateSignals()` main entry point

### Policy Evaluation
- **Evaluator Logic:** `packages/server/src/evaluator/index.ts`
  - `evaluateDecision()` function
  - Scope matching
  - Condition evaluation
  - Verdict resolution

### Condition Matching
- **Condition Evaluator:** `packages/server/src/evaluator/__internal__/condition-evaluator.ts`
  - Evaluates conditions against signal values
  - Operators: `==`, `!=`, `>`, `<`, `>=`, `<=`, `in`

### Verdict Precedence
- **Verdict Resolver:** `packages/server/src/evaluator/__internal__/verdict-resolver.ts`
  - Resolves multiple verdicts
  - Precedence: `BLOCK > PAUSE > ALLOW > OBSERVE`

### API Integration
- **Decisions API:** `packages/server/src/routes/decisions.ts`
  - `POST /api/v1/decisions` endpoint
  - Spec resolution
  - Observe phase invocation
  - Signal validation
  - Evaluator invocation
  - Audit timeline recording

### Type Definitions
- **Schemas:** `packages/shared/src/schemas.ts`
  - `DecisionEvent`, `VerdictEvent`, `TimelineEntry`
  - `DecisionSpec`, `SignalDefinition`
  - `Policy`, `PolicyCondition`

---

## Demo-Only Scope

This example demonstrates a **single, specific governance flow**:
- Single organization: `acme-airlines`
- Single domain: `customer-support`
- Single intent/stage: `issue_refund` / `pre_commit`
- Single DecisionSpec: `spec-refund-v1`
- Single policy: `pol-refund-001`
- Single verdict: `PAUSE`

**This is NOT:**
- A generalizable multi-organization platform
- A multi-policy routing system
- A workflow engine or orchestrator
- An execution or control system

**This IS:**
- A demonstration of governance interception
- A proof of signal extraction + policy matching
- An example of safe response fallback
- A complete audit trail

---

## Key Constraints Verified

### Control Plane Only ✓
- No execute/perform/orchestrate patterns
- System evaluates, issues verdicts, records audit
- Caller (chatbot) decides what to do with verdict

### Evaluator Purity ✓
- No async code in evaluator
- No database access from evaluator
- No Date, Math.random, setTimeout
- Pure deterministic function: `evaluateDecision(decision, spec, snapshot) → EvaluationResult`

### Shared = Types Only ✓
- No functions or control flow in `@mandate/shared`
- Only type definitions and schemas

### Append-Only Database ✓
- Decisions and verdicts recorded, never updated
- Timeline is immutable

### Policies ≠ Code ✓
- Policy is JSON with conditions, not expressions
- No JavaScript/Python in policy definitions

---

## Running the Demo

To run the TypeScript example:

```bash
# Ensure Mandate server is running
npm run start:server

# Run the demo
npx ts-node packages/examples/src/airline-demo/airline-chatbot-demo.ts
```

Expected output:
```
================================================================================
AIRLINE CHATBOT DEMO
================================================================================

[CHATBOT] Step 1: Generating draft response...
[CHATBOT] Draft response: Yes, you can receive a full refund of $500...

[CHATBOT] Step 2: Submitting to Mandate for governance...
[MANDATE_CLIENT] Submitting decision...

[MANDATE_SIMULATOR] Extracted signals: {
  has_monetary_value: true,
  policy_keyword: 'refund',
  monetary_amount: 500,
  requires_escalation: false
}

[MANDATE_SIMULATOR] Policy "High-Risk Refund Claims Require Escalation" matched

[CHATBOT] Step 3: Observe phase results...
[OBSERVE] Populated signals in decision context: {...}

[CHATBOT] Step 4: Handling verdict...
[VERDICT] Verdict: PAUSE, Matched policies: pol-refund-001

[CHATBOT] Verdict is PAUSE - sending safe fallback response

================================================================================
FINAL RESPONSE SENT TO CUSTOMER
================================================================================

Chatbot: "Thank you for your question about refunds. Your request requires
review by our compliance team..."

================================================================================
SUMMARY
================================================================================

✅ Unstructured chatbot response was intercepted
✅ Signals extracted deterministically ($500, refund, etc.)
✅ Policy evaluation matched high-risk refund claim
✅ Verdict issued: PAUSE (requires human escalation)
✅ Safe fallback response sent instead of unverified claim
✅ Decision and verdict recorded in audit timeline
```

---

## Testing the JSON Example

Manually test the API using the JSON example data:

```bash
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d @packages/examples/src/airline-demo/airline-spec-and-policy.json
```

Or use the request from the JSON file:

```bash
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "decision": { /* from exampleDecisionRequest.decision */ },
    "unstructured_context": "Yes, you can receive a full refund of $500..."
  }'
```

Expected response: `{"decision": {...}, "verdict": {"verdict": "PAUSE", ...}}`

---

## Summary

This demo proves that Mandate can safely govern third-party agent output by:

1. **Intercepting** unstructured text before delivery
2. **Extracting** signals deterministically (no LLM decision-making)
3. **Validating** required signals are present
4. **Evaluating** against policies (scope + conditions → verdict)
5. **Issuing** safe verdicts (ALLOW/PAUSE/BLOCK/OBSERVE)
6. **Recording** complete audit trail (immutable, append-only)

The chatbot sends a safe response, the customer is protected, and the organization has full audit evidence.
