# BLOCK vs PAUSE Policies: Airline Demo Guide

## Overview

This guide explains the difference between `BLOCK` and `PAUSE` verdicts in the airline chatbot demo, using two concrete examples.

---

## Quick Comparison

| Aspect | PAUSE | BLOCK |
|--------|-------|-------|
| **Verdict** | `PAUSE` | `BLOCK` |
| **Meaning** | Decision paused for human review | Decision blocked, no approval path |
| **Response Sent** | Safe holding message | Safe generic fallback |
| **Escalation** | Yes, to compliance team | No, customer directed to support |
| **Approval Possible** | Yes, human can approve | No, not allowed under policy |
| **Risk Level** | Medium (needs verification) | High (never allowed) |

---

## Scenario 1: PAUSE - High-Risk Refund Claim

### Situation
Customer asks for a refund for a flight they booked but haven't used yet. Chatbot offers a $500 refund.

### Chatbot Draft Response
```
"Yes, you can receive a full refund of $500 for your cancelled flight. 
This will be processed immediately to your original payment method 
without any deduction or fee."
```

### Risk Assessment
❓ **Uncertain:** The refund amount might be valid, but needs verification:
- Is the customer entitled to a full refund?
- Are there cancellation fees that should apply?
- Does our system show the correct booking?

### Matching Policy
**"High-Risk Refund Claims Require Escalation"**
```json
{
  "conditions": [
    { "field": "has_monetary_value", "operator": "==", "value": true },
    { "field": "policy_keyword", "operator": "==", "value": "refund" },
    { "field": "monetary_amount", "operator": ">=", "value": 100 }
  ],
  "verdict": "PAUSE"
}
```

### Verdict Issued: PAUSE ✋
The decision is **paused** because the claim needs human verification.

### Chatbot Behavior
```
Original draft (BLOCKED):
"Yes, you can receive a full refund of $500..."

Safe fallback sent instead:
"Thank you for your question about refunds. Your request requires review 
by our compliance team to ensure we provide you with the correct information 
about your specific refund eligibility.

A specialist will reach out to you within 1 business day with a confirmed 
answer. Your booking reference is BK789."
```

### What Happens Next
1. **Chatbot** sends safe fallback message to customer
2. **System** escalates decision to compliance team
3. **Compliance team** reviews booking details
4. **Decision:** 
   - ✅ Approve refund (if customer is eligible)
   - ❌ Deny refund (if non-refundable ticket)
   - 🔄 Offer partial refund (if some fees apply)
5. **Team** contacts customer with final decision

### Why PAUSE?
- The claim **could be valid**
- But it **needs verification** before promising the money
- A human can make the right decision after reviewing the booking

---

## Scenario 2: BLOCK - Fraudulent/Ineligible Refund Claim

### Situation
Customer asks for a refund for a flight that **already departed yesterday**. Chatbot offers a $375 refund.

### Chatbot Draft Response
```
"I understand your situation. You should be eligible for a refund of $375. 
We can process that for you right away."
```

### Risk Assessment
❌ **Invalid:** The refund is **never allowed** under policy:
- Flight already completed (departed yesterday)
- Company policy: No refunds for completed flights
- This is a hard rule, not a judgment call

### Matching Policy
**"Block Refunds for Completed Flights"**
```json
{
  "conditions": [
    { "field": "policy_keyword", "operator": "==", "value": "refund" },
    { "field": "flight_status", "operator": "==", "value": "completed" }
  ],
  "verdict": "BLOCK"
}
```

### Verdict Issued: BLOCK 🚫
The decision is **blocked** entirely. No escalation. No approval path.

### Chatbot Behavior
```
Original draft (BLOCKED):
"I understand your situation. You should be eligible for a refund of $375..."

Safe fallback sent instead:
"Thank you for contacting us. I'm unable to process refund requests for flights 
that have already departed. Please contact our customer service team at 
support@acme-airlines.com or call 1-800-AIRLINES for assistance with your 
specific situation."
```

### What Happens Next
1. **Chatbot** sends safe fallback message
2. **System** records the BLOCK verdict in audit trail
3. **No escalation** - this doesn't need human review
4. **Customer** must contact support team if they want to dispute

### Why BLOCK?
- The claim is **never valid** (flight already completed)
- **No circumstances** allow a refund for completed flights
- There's **nothing to escalate** - it's against policy
- The chatbot should not offer false hope

---

## Verdict Precedence

If multiple policies match, verdict precedence determines the final result:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

### Example: Both Policies Match

**Scenario:** Customer asks for $500 refund for a completed flight.

**Policies matching:**
1. PAUSE policy: "High-Risk Refund Claims" (amount >= $100)
2. BLOCK policy: "Block Refunds for Completed Flights"

**Result:** **BLOCK wins**

The more restrictive verdict takes precedence, so the response is blocked entirely.

---

## Signal Extraction Differences

### PAUSE Policy (Scenario 1)
```
Input text: "You should be eligible for a refund of $500..."

Signal extraction:
- has_monetary_value: true (found: $500)
- policy_keyword: "refund" (found: word "refund")
- monetary_amount: 500 (extracted: $500)
- flight_status: ??? (not mentioned in response text)

Decision context provides missing signals:
- flight_status: "scheduled" (from flight lookup)

Policy conditions evaluate:
- has_monetary_value == true ✓
- policy_keyword == "refund" ✓
- monetary_amount >= 100 ✓
→ All match: PAUSE verdict
```

### BLOCK Policy (Scenario 2)
```
Input text: "You should be eligible for a refund of $375..."

Signal extraction:
- has_monetary_value: true (found: $375)
- policy_keyword: "refund" (found: word "refund")
- monetary_amount: 375 (extracted: $375)
- flight_status: ??? (not mentioned in response text)

Decision context provides missing signals:
- flight_status: "completed" (from flight lookup)

Policy conditions evaluate:
- policy_keyword == "refund" ✓
- flight_status == "completed" ✓
→ All match: BLOCK verdict
```

---

## Customer Experience Comparison

### With PAUSE Verdict

```
Customer question: "Can I get a refund?"

Without Mandate:
Customer sees: "Yes, you can receive a full $500 refund processed immediately"
→ Customer expects refund, but never receives it
→ Customer service complaint

With Mandate:
Customer sees: "Your request requires review by our compliance team..."
→ Customer knows it's pending
→ Compliance team verifies and contacts customer
→ Trust maintained
```

### With BLOCK Verdict

```
Customer question: "Flight left yesterday, can I still refund?"

Without Mandate:
Customer sees: "You're eligible for a $375 refund"
→ Customer expects refund
→ Customer discovers flight can't be refunded
→ Major complaint and escalation

With Mandate:
Customer sees: "Unable to process. Please contact support..."
→ Customer knows it's not available
→ Realistic expectations
→ Compliance protected
```

---

## Implementation: Handling Verdicts

### TypeScript Code Pattern

```typescript
// Receive verdict from Mandate
const result = await mandateClient.submitDecision(decisionRequest);

// Handle different verdicts
switch (result.verdict.verdict) {
  case 'ALLOW':
    // Send original draft response
    await sendToCustomer(draftResponse);
    console.log('Decision allowed');
    break;

  case 'PAUSE':
    // Send safe holding response + escalate
    await sendToCustomer(PAUSE_FALLBACK);
    await escalateToTeam(result.verdict.owning_team, result.decision);
    console.log(`Paused. Escalating to ${result.verdict.owning_team}`);
    break;

  case 'BLOCK':
    // Send safe generic response, NO escalation
    await sendToCustomer(BLOCK_FALLBACK);
    console.log('Decision blocked by policy');
    // Record in audit but no escalation needed
    break;

  case 'OBSERVE':
    // Send response but mark for observational monitoring
    await sendToCustomer(draftResponse);
    console.log('Sent with observation markers');
    break;
}
```

---

## Audit Trail: PAUSE vs BLOCK

### PAUSE Decision Timeline
```json
[
  {
    "event": "Decision received",
    "details": "Refund claim for $500, booking BK789"
  },
  {
    "event": "Signal extraction",
    "details": "has_monetary_value=true, policy_keyword='refund', amount=500"
  },
  {
    "event": "Policy evaluation",
    "details": "Matched: pol-refund-001 (High-Risk Refund Claims)"
  },
  {
    "event": "Verdict issued",
    "details": "PAUSE - awaiting human review"
  },
  {
    "event": "Escalation",
    "details": "Escalated to compliance-team for verification"
  }
]
```

### BLOCK Decision Timeline
```json
[
  {
    "event": "Decision received",
    "details": "Refund claim for $375, booking BK456, flight completed"
  },
  {
    "event": "Signal extraction",
    "details": "has_monetary_value=true, policy_keyword='refund', flight_status='completed'"
  },
  {
    "event": "Policy evaluation",
    "details": "Matched: pol-refund-002 (Block Completed Flights)"
  },
  {
    "event": "Verdict issued",
    "details": "BLOCK - no refunds allowed for completed flights"
  }
]
```

Notice: PAUSE has an escalation step. BLOCK does not.

---

## Testing Both Policies

### Test PAUSE Policy
```bash
# File: airline-spec-and-policy.json
# Scenario: $500 refund for future/scheduled flight
# Expected verdict: PAUSE

curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "decision": {
      "intent": "issue_refund",
      "context": {
        "flight_status": "scheduled",
        "monetary_amount": 500
      },
      ...
    },
    "unstructured_context": "You should be eligible for a full $500 refund..."
  }'
```

### Test BLOCK Policy
```bash
# File: airline-block-policy-example.json
# Scenario: $375 refund for completed flight
# Expected verdict: BLOCK

curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "decision": {
      "intent": "issue_refund",
      "context": {
        "flight_status": "completed",
        "monetary_amount": 375
      },
      ...
    },
    "unstructured_context": "You should be eligible for a $375 refund..."
  }'
```

---

## Key Takeaways

1. **PAUSE**: "This looks risky, get human approval before proceeding"
   - Used for decisions that **could be valid but need verification**
   - Escalation workflow: human reviews → approves/denies
   - Safe fallback holds customer while decision is made

2. **BLOCK**: "This is not allowed under policy, period"
   - Used for decisions that **violate hard rules**
   - No escalation: the policy is non-negotiable
   - Safe fallback directs customer to support

3. **Precedence**: If both match, BLOCK wins (more restrictive)

4. **Safety**: In both cases, the unsafe chatbot draft is never sent
   - PAUSE: Safe holding response
   - BLOCK: Safe generic response

5. **Compliance**: All decisions recorded in immutable audit trail

---

## Files in This Demo

- **[airline-spec-and-policy.json](./airline-spec-and-policy.json)** – PAUSE policy example
- **[airline-block-policy-example.json](./airline-block-policy-example.json)** – BLOCK policy example
- **[BLOCK-vs-PAUSE-Guide.md](./BLOCK-vs-PAUSE-Guide.md)** – This file

---

## Summary

The airline chatbot demo shows how Mandate uses two types of policies to protect customer trust and compliance:

- **PAUSE policies** pause risky decisions for human verification
- **BLOCK policies** prevent unsafe decisions entirely

Both ensure the chatbot never sends unverified or invalid claims to customers.
