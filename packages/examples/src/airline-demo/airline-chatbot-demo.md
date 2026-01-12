# Airline Chatbot Demo: Mandate Governance in Action

## Scenario: Unverified Pricing Claim Interception

A customer service chatbot responds to a customer question about refunds. The chatbot's draft response contains an unverified claim about a $500 refund without escalation. Mandate intercepts this response and prevents it from being delivered, issuing a safe verdict instead.

## Demo Setup

### Organization & Domain
```
organization_id: "acme-airlines"
domain_name: "customer-support"
intent: "issue_refund"
stage: "pre_commit"
```

---

## Step 0: Chatbot Produces Draft Response (Unstructured)

**Third-party chatbot (no Mandate SDK):**

```
Customer: "I booked a flight but need to cancel. Can I get a refund?"

Chatbot Draft Response:
"Yes, you can receive a full refund of $500 for your cancelled flight. 
This will be processed immediately to your original payment method 
without any deduction or fee."
```

**Observations:**
- Response claims a specific refund amount ($500)
- Response claims automatic processing without escalation
- Response makes policy assertions without verification
- **Risk:** This claim may violate company refund policies

---

## Step 1: Mandate Intercepts (Pre-Delivery)

The chatbot is integrated with Mandate. Before sending the response, the system submits it for governance:

### Request to Mandate API

```json
{
  "decision": {
    "decision_id": "dec-airline-001",
    "organization_id": "acme-airlines",
    "domain_name": "customer-support",
    "intent": "issue_refund",
    "stage": "pre_commit",
    "actor": "chatbot-v3",
    "target": "customer:C123456",
    "scope": {
      "organization_id": "acme-airlines",
      "domain_name": "customer-support",
      "agent": "chatbot-v3",
      "service": "chat-api",
      "environment": "production"
    },
    "context": {
      "customer_id": "C123456",
      "booking_id": "BK789",
      "cancellation_reason": "customer_request"
    },
    "timestamp": "2026-01-12T14:30:00Z"
  },
  "unstructured_context": "Yes, you can receive a full refund of $500 for your cancelled flight. This will be processed immediately to your original payment method without any deduction or fee."
}
```

---

## Step 2: Observe Phase - Signal Population

### DecisionSpec Definition (Already Active in Mandate)

```json
{
  "spec_id": "spec-refund-v1",
  "version": "1.0.0",
  "organization_id": "acme-airlines",
  "domain_name": "customer-support",
  "intent": "issue_refund",
  "stage": "pre_commit",
  "allowed_verdicts": ["ALLOW", "PAUSE", "BLOCK"],
  "signals": [
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "required": true,
      "source": "context"
    },
    {
      "name": "policy_keyword",
      "type": "enum",
      "values": ["refund", "charge", "fee", "escalate"],
      "required": true,
      "source": "context"
    },
    {
      "name": "monetary_amount",
      "type": "number",
      "required": false,
      "source": "context"
    },
    {
      "name": "requires_escalation",
      "type": "boolean",
      "required": false,
      "source": "context"
    }
  ],
  "enforcement": {
    "pause_requires": ["compliance-team"],
    "resolution_timeout_minutes": 60
  },
  "status": "active",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Deterministic Extraction (Signal Populator)

The Observe phase runs **deterministic extractors first** on the unstructured text:

```typescript
// Signal: has_monetary_value (boolean)
// Pattern: looks for currency symbols ($, €, £) and numeric values
Text match: "$500"
→ has_monetary_value = true ✓

// Signal: policy_keyword (enum)
// Pattern: looks for exact word boundaries
Text match: "refund"
→ policy_keyword = "refund" ✓

// Signal: monetary_amount (number)
// Pattern: extracts numeric value associated with currency
Text match: "$500" → parseFloat(500)
→ monetary_amount = 500 ✓

// Signal: requires_escalation (boolean)
// Pattern: looks for words like "immediately", "automatic", "without exception"
Text match: "immediately" (indicates no escalation)
→ requires_escalation = false ✓
```

### Populated Signals in Decision Context

After the Observe phase, the decision's context is enriched:

```json
{
  "context": {
    "customer_id": "C123456",
    "booking_id": "BK789",
    "cancellation_reason": "customer_request",
    "has_monetary_value": true,
    "policy_keyword": "refund",
    "monetary_amount": 500,
    "requires_escalation": false
  }
}
```

**Key Point:** All signals are populated from **deterministic extraction only** (no LLM). The system never calls an LLM and never modifies unstructured input.

---

## Step 3: Signal Validation

The API validates that all **required** signals are populated:

```
✓ has_monetary_value: populated (true)
✓ policy_keyword: populated ("refund")
✓ monetary_amount: populated (500)
  requires_escalation: populated (false) [optional]
```

**Validation Result:** ✅ PASS (all required signals present)

If any required signal was missing, the API would return a 400 error before evaluation.

---

## Step 4: Policy Evaluation

Mandate evaluates the enriched decision against applicable policies:

### Policy #1: "High-Risk Refund Claims Require Escalation"

```json
{
  "id": "pol-refund-001",
  "spec_id": "spec-refund-v1",
  "scope_id": "customer-support.chatbot-v3",
  "organization_id": "acme-airlines",
  "domain_name": "customer-support",
  "name": "High-Risk Refund Claims Require Escalation",
  "description": "When a refund is claimed with a specific monetary amount, escalation to compliance team is mandatory",
  "scope": {
    "organization_id": "acme-airlines",
    "domain_name": "customer-support",
    "agent": "chatbot-v3"
  },
  "conditions": [
    {
      "field": "has_monetary_value",
      "operator": "==",
      "value": true
    },
    {
      "field": "policy_keyword",
      "operator": "==",
      "value": "refund"
    },
    {
      "field": "monetary_amount",
      "operator": ">=",
      "value": 100
    }
  ],
  "verdict": "PAUSE"
}
```

### Evaluation Steps

```
1. Scope Match?
   - Decision agent: "chatbot-v3" ✓ matches policy scope
   - Decision domain: "customer-support" ✓ matches policy scope
   → SCOPE MATCHES

2. Condition Evaluation:
   - has_monetary_value == true?  ✓ YES (from signal: true)
   - policy_keyword == "refund"?  ✓ YES (from signal: "refund")
   - monetary_amount >= 100?       ✓ YES (from signal: 500)
   → ALL CONDITIONS MATCH

3. Policy Matched!
   - matched_policy_ids: ["pol-refund-001"]
   - verdict: "PAUSE"
```

---

## Step 5: Verdict Resolution

**Matched verdicts:** ["PAUSE"]

**Precedence algorithm:** BLOCK > PAUSE > ALLOW > OBSERVE

**Final verdict:** **PAUSE**

```
Precedence: BLOCK > PAUSE > ALLOW > OBSERVE
Matched: [PAUSE]
→ Final verdict: PAUSE ✓
```

---

## Step 6: Verdict Issued - Safe Response

The API returns the verdict to the chatbot integration layer:

### Verdict Event

```json
{
  "verdict_id": "verd-airline-001",
  "organization_id": "acme-airlines",
  "decision_id": "dec-airline-001",
  "snapshot_id": "snap-20260112-v1",
  "verdict": "PAUSE",
  "matched_policy_ids": ["pol-refund-001"],
  "timestamp": "2026-01-12T14:30:05Z",
  "spec_id": "spec-refund-v1",
  "spec_version": "1.0.0",
  "scope_id": "customer-support.chatbot-v3.production",
  "domain_name": "customer-support",
  "owning_team": "compliance-team"
}
```

### Safe Fallback Response (Instead of Draft)

**Chatbot receives verdict: PAUSE**

Since the verdict is **PAUSE**, the chatbot does NOT send the original draft response. Instead, it sends a safe fallback:

```
Customer: "I booked a flight but need to cancel. Can I get a refund?"

Chatbot Safe Response (Instead of Draft):
"Thank you for your question about refunds. Your request requires review 
by our compliance team to ensure we provide you with the correct information 
about your specific refund eligibility.

A specialist will reach out to you within 1 business day with a confirmed 
answer. Your booking reference is BK789.

We appreciate your patience!"
```

---

## Step 7: Audit Timeline

The decision and verdict are recorded for compliance audit:

### Timeline Entries (Append-Only)

```json
[
  {
    "entry_id": "tl-001",
    "organization_id": "acme-airlines",
    "domain_name": "customer-support",
    "decision_id": "dec-airline-001",
    "intent": "issue_refund",
    "stage": "pre_commit",
    "summary": "Decision received: issue_refund",
    "details": {
      "context": {
        "customer_id": "C123456",
        "booking_id": "BK789",
        "cancellation_reason": "customer_request",
        "has_monetary_value": true,
        "policy_keyword": "refund",
        "monetary_amount": 500,
        "requires_escalation": false
      }
    },
    "source": "system",
    "authority_level": "system",
    "timestamp": "2026-01-12T14:30:00Z"
  },
  {
    "entry_id": "tl-002",
    "organization_id": "acme-airlines",
    "domain_name": "customer-support",
    "decision_id": "dec-airline-001",
    "intent": "issue_refund",
    "stage": "pre_commit",
    "summary": "Verdict issued: PAUSE",
    "details": {
      "verdict": "PAUSE",
      "matched_policy_ids": ["pol-refund-001"],
      "snapshot_id": "snap-20260112-v1",
      "spec_id": "spec-refund-v1",
      "spec_version": "1.0.0",
      "scope_id": "customer-support.chatbot-v3.production"
    },
    "source": "system",
    "authority_level": "system",
    "timestamp": "2026-01-12T14:30:05Z",
    "spec_id": "spec-refund-v1",
    "scope_id": "customer-support.chatbot-v3.production"
  }
]
```

---

## Key Concepts Demonstrated

### 1. **Unstructured Input Handling**
- Chatbot produces natural language response
- No structured data initially
- Mandate extracts and validates before use

### 2. **Deterministic Signal Extraction**
- Pattern-based extraction (currency symbols, keywords)
- No AI/LLM involvement
- Purely rules-based and auditable

### 3. **Signal Validation**
- Required signals must be populated
- Missing signals cause safe 400 failures
- Prevents silent defaults

### 4. **Policy Matching**
- Scope matching (domain + agent)
- Condition evaluation (boolean logic on signals)
- Verdict precedence (BLOCK > PAUSE > ALLOW > OBSERVE)

### 5. **Safe Fallback**
- Original unverified draft is NOT sent
- PAUSE verdict triggers human review workflow
- Customer receives safe, verified response

### 6. **Audit Trail**
- All decisions and verdicts recorded
- Immutable timeline (append-only)
- Spec and scope references for compliance

---

## What Mandate Prevents

Without Mandate, the chatbot would have sent:

```
"Yes, you can receive a full refund of $500 for your cancelled flight. 
This will be processed immediately..."
```

**Risks:**
- ❌ Unverified refund amount
- ❌ Policy claim without verification
- ❌ Immediate processing without escalation
- ❌ No audit trail
- ❌ Potential compliance violation

**With Mandate:**
- ✅ Signals extracted deterministically
- ✅ Policy evaluation against declared spec
- ✅ Safe fallback issued (PAUSE)
- ✅ Escalation to compliance team triggered
- ✅ Complete audit trail maintained

---

## Integration Points

### Chatbot Code (Simplified)

```typescript
// Chatbot generates draft response
const draftResponse = await llm.generateResponse(userMessage);

// Submit to Mandate for governance BEFORE sending to customer
const result = await mandateClient.post('/api/v1/decisions', {
  decision: {
    decision_id: generateId(),
    organization_id: 'acme-airlines',
    domain_name: 'customer-support',
    intent: 'issue_refund',
    stage: 'pre_commit',
    actor: 'chatbot-v3',
    target: `customer:${customerId}`,
    scope: {
      organization_id: 'acme-airlines',
      domain_name: 'customer-support',
      agent: 'chatbot-v3',
      service: 'chat-api',
      environment: 'production',
    },
    context: {
      customer_id: customerId,
      booking_id: bookingId,
      cancellation_reason: cancellationReason,
    },
    timestamp: new Date().toISOString(),
  },
  unstructured_context: draftResponse, // Draft response text
});

// Handle verdict
if (result.verdict.verdict === 'PAUSE') {
  // Send safe fallback, NOT the original draft
  await sendToCustomer(SAFE_FALLBACK_RESPONSE);
  console.log(`Decision paused. Policy matches: ${result.verdict.matched_policy_ids}`);
} else if (result.verdict.verdict === 'BLOCK') {
  // Do not send response at all
  await sendToCustomer('Unable to process request at this time.');
} else {
  // result.verdict.verdict === 'ALLOW'
  // Send original draft response
  await sendToCustomer(draftResponse);
}
```

---

## Files Referenced in Implementation

- **Signal population:** `packages/server/src/observe/signal-populator.ts`
- **Evaluator logic:** `packages/server/src/evaluator/index.ts`
- **Condition evaluation:** `packages/server/src/evaluator/__internal__/condition-evaluator.ts`
- **Verdict resolution:** `packages/server/src/evaluator/__internal__/verdict-resolver.ts`
- **API integration:** `packages/server/src/routes/decisions.ts`
- **Type definitions:** `packages/shared/src/schemas.ts`

---

## Demo-Only Scope

This example demonstrates a single governance flow:
- One organization, one domain
- One DecisionSpec (refund)
- One policy (escalation rule)
- One verdict (PAUSE)

This is **NOT** a generalizable framework. Mandate's core value is enforcing organizational governance policy on agent-produced output before delivery, not building a routing or orchestration system.
