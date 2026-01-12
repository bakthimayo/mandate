# Interactive Airline Chatbot Agent

An **interactive demo** that showcases Mandate's governance capabilities through multi-turn conversations. Every response is evaluated by Mandate before reaching the customer.

## What This Demonstrates

### ✅ Verdict Types (All Showcased)

| Verdict | Policy | Scenario | Behavior |
|---------|--------|----------|----------|
| **PAUSE** | `pol-refund-001` | Refund amount ≥ $100 | Safe fallback, escalates to compliance team |
| **ALLOW** | `pol-refund-002` | Refund amount < $100 | Original response sent directly |
| **OBSERVE** | `pol-refund-003` | All requests | Audit-logged, original response sent |
| **BLOCK** | (optional) | Fraud signals | Request rejected entirely |

### ✅ Core Capabilities

1. **Multi-turn Conversation**: Interactive chat session with persistent context
2. **Signal Extraction**: Deterministic signal population from unstructured responses
3. **Policy Matching**: Real-time policy evaluation against Mandate database
4. **Verdict Handling**: Different actions per verdict type
5. **Audit Trail**: All decisions persisted in database with full lineage
6. **Outcome Reporting**: Each response delivery logged back to Mandate

## Running the Agent

### Prerequisites

1. Mandate server running on `http://localhost:3001`
2. Database migrations applied (esp. `010_airline_demo_spec_and_policy.sql`)
3. Environment setup:
   ```bash
   export MANDATE_URL=http://localhost:3001
   export MANDATE_API_KEY=<your-api-key>
   ```

### Start the Interactive Agent

```bash
cd packages/examples
pnpm ts-node src/airline-demo/interactive-chatbot-agent.ts
```

### Try These Scenarios

**Trigger PAUSE (High-Risk Refund):**
```
You: I want a refund for my $500 ticket
→ Agent generates: "Yes, we can issue a full refund of $500..."
→ Mandate detects: has_monetary_value=true, monetary_amount=500
→ Policy matched: pol-refund-001 (≥$100)
→ Verdict: PAUSE
→ Response: Safe fallback requesting compliance review
```

**Trigger ALLOW (Low-Risk Refund):**
```
You: Can I get my $50 back?
→ Agent generates: "You're eligible for a $50 refund..."
→ Mandate detects: monetary_amount=50
→ Policy matched: pol-refund-002 (<$100)
→ Verdict: ALLOW
→ Response: Original response sent directly
```

**Trigger OBSERVE (Audit-Only):**
```
You: What's my booking status?
→ Agent generates: "Your booking BK789 is confirmed..."
→ Mandate detects: no monetary signals, no refund keyword
→ Policy matched: pol-refund-003 (catch-all)
→ Verdict: OBSERVE
→ Response: Original response sent, audit logged
```

**Non-Governance Query:**
```
You: Tell me about your airline
→ Agent generates: Generic greeting
→ No signals matched
→ No policy triggers
→ Verdict: OBSERVE (default catch-all)
→ Response: Original response sent
```

## Session Output

The agent logs:

```
═══════════════════════════════════════════════════════════════════════════════
MESSAGE #1
═══════════════════════════════════════════════════════════════════════════════

[AGENT] Generating draft response...
[AGENT] Intent: issue_refund
[AGENT] Draft: "Yes, I can help you with your refund. For your booking BK1234,
we can issue a full refund of $500 to your original payment method..."

[OBSERVE] Extracting signals from draft...
[OBSERVE] Signals: {
  "has_monetary_value": true,
  "monetary_amount": 500,
  "policy_keyword": "refund",
  "requires_escalation": true
}

[MANDATE] Submitting to Mandate...

[VERDICT] Result:
  Verdict: PAUSE
  Policies: pol-refund-001
  Escalation: compliance-team

[ACTION] Verdict PAUSE → Escalating to compliance team
[OUTCOME] Logged in audit trail (Decision ID: dec-xxx-yyy-zzz)

[RESPONSE] Agent: "Thank you for reaching out. Your request requires review
by our compliance team to ensure accuracy. A specialist will contact you
within 1 business day with a confirmed answer..."
```

## Session Summary

After you type `exit`, the agent prints:

```
═══════════════════════════════════════════════════════════════════════════════
SESSION SUMMARY
═══════════════════════════════════════════════════════════════════════════════
Total Messages: 3

Decision History:
  1. ⏸ issue_refund → PAUSE (pol-refund-001)
  2. ✅ issue_refund → ALLOW (pol-refund-002)
  3. 👁 check_booking → OBSERVE (pol-refund-003)

Verdict Distribution:
  PAUSE: 1
  ALLOW: 1
  OBSERVE: 1

✅ Conversation ended. All decisions governed by Mandate.
```

## Architecture

```
User Message
    ↓
[AGENT] Draft Response Generation (LLM-independent)
    ↓
[OBSERVE] Signal Extraction (deterministic regex)
    ↓
[MANDATE] Submit to requestDecision()
    ↓
[EVALUATOR] Scope match + Policy evaluation (pure function)
    ↓
[VERDICT] Issue PAUSE | ALLOW | BLOCK | OBSERVE
    ↓
[RESPONSE] Send to customer (adapted per verdict)
    ↓
[OUTCOME] reportOutcome() → Audit trail
```

## Key Design Principles

1. **Agent is Governance-Agnostic**: The chatbot has no policy logic—it just generates responses
2. **Pre-Delivery Governance**: All responses checked BEFORE reaching customer
3. **Deterministic Extraction**: Signals populated via regex, not LLM
4. **Immutable Audit Trail**: Every decision + verdict persisted in database
5. **Multi-Verdict Support**: PAUSE (escalation), ALLOW (approval), OBSERVE (audit), BLOCK (denial)

## Configuration

Edit `interactive-chatbot-agent.ts` to customize:

- `ORGANIZATION_ID`: Organization identifier
- `DOMAIN`: Governance domain (e.g., `customer-support`)
- `SPEC_ID`: DecisionSpec to use
- `FALLBACK_RESPONSES`: Safe responses per verdict type
- `generateDraftResponse()`: Agent response logic
- `extractSignals()`: Signal extraction patterns

## Files

- `interactive-chatbot-agent.ts` - Main agent implementation
- `airline-spec-and-policy.json` - Policy definitions (reference)
- `airline-chatbot-demo.ts` - Non-interactive single-scenario demo

## Next Steps

- Add **custom LLM** response generation instead of keyword-based
- Implement **real human review UI** for PAUSE verdicts
- Add **policy versioning** to allow policy updates mid-conversation
- Integrate **dynamic signal extraction** using LLM for unstructured text
