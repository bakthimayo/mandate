# Observe Phase - Quick Start Guide

**RFC-002 Section 7 Implementation**

---

## 30-Second Overview

The **Observe phase** populates DecisionSpec signal values from unstructured AI responses.

```typescript
// Before: decision.context = {}
// Unstructured: "Transfer $5000 with high priority"

const enrichedDecision = await executeObservePhase(
  decision,
  spec,
  "Transfer $5000 with high priority"
);

// After: decision.context = { amount: 5000, priority: 'high' }
```

---

## What Gets Populated

### ✅ YES - These are populated

- **Numeric values**: `amount: 5000`, `$5000`, `5000.50 USD`
- **Enum values**: `priority: high`, `status: approved` (declared in spec)
- **Booleans**: `requires_approval: yes`, `is_urgent: true`
- **Qualifiers**: `risk_level: critical` (from common or declared values)

### ❌ NO - These are never populated

- Intent, domain_name, stage (these must be explicit)
- Signals not declared in DecisionSpec
- Any new signals (only declared ones)

---

## How to Use

### 1. In Decision Request

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
      "domain_name": "finance"
    },
    "timestamp": "2025-01-12T10:00:00Z"
  },
  "unstructured_context": "Transfer $5000 to account with high priority"
}
```

### 2. Result

```json
{
  "decision": {
    "...": "same as input...",
    "context": {
      "amount": 5000,
      "priority": "high"
    }
  },
  "verdict": { ... }
}
```

---

## Configuration

### Default (Deterministic Only)

```typescript
{
  enableAssistedParsing: false,
  assistedParsingConfidenceThreshold: 0.8
}
```

✅ **Recommended for most cases** - fast, deterministic, reliable.

### With LLM Assistance

```typescript
{
  enableAssistedParsing: true,
  assistedParsingConfidenceThreshold: 0.85,
  assistedParsingFn: async (text, signalDefs, contextSignals) => {
    const result = await yourLLMService.extract(text, contextSignals);
    return result; // { signalName: { value: any, confidence: 0-1 } }
  }
}
```

⚠️ **Only for signals deterministic extraction can't find**.

---

## DecisionSpec Setup

For signal population to work, declare signals in your DecisionSpec:

```typescript
const spec = {
  signals: [
    {
      name: 'amount',
      type: 'number',
      source: 'context',  // ← Key: must be 'context' for AI text extraction
      required: true      // Can be required or optional
    },
    {
      name: 'priority',
      type: 'enum',
      values: ['low', 'medium', 'high', 'critical'],
      source: 'context',
      required: false
    },
    {
      name: 'requires_approval',
      type: 'boolean',
      source: 'context',
      required: false
    }
  ]
};
```

---

## API Integration

The Observe phase is **automatically integrated** in the decisions route.

Just pass `unstructured_context`:

```bash
POST /api/v1/decisions

{
  "decision": { ... },
  "unstructured_context": "AI response text here"  # Optional
}
```

No code changes needed.

---

## Testing

```bash
# Run tests
pnpm test -- packages/server/src/observe

# Test patterns detected automatically
```

**Coverage**: 20+ extraction tests, 15+ integration tests.

---

## Constraints (Do's and Don'ts)

### ✅ DO

- ✅ Extract values from AI-generated text
- ✅ Use deterministic extraction by default
- ✅ Add LLM extraction for complex cases
- ✅ Respect signal declarations in spec
- ✅ Let missing signals fail at validation (expected)

### ❌ DON'T

- ❌ Infer intent, domain, or stage from text
- ❌ Create new signals beyond what's declared
- ❌ Use LLM for high-confidence signals (deterministic is faster)
- ❌ Treat assisted parsing as authoritative
- ❌ Mutate the original decision

---

## Common Patterns

### Pattern 1: Amount Extraction

```
Text: "Transfer $5000 to the account"
↓
Signal: amount = 5000
```

Patterns matched:
- `amount: 5000`
- `$5000`
- `5000 USD`
- `5000.50`

### Pattern 2: Status/Priority

```
Text: "This is a critical transaction"
↓
Signal: priority = 'critical'
```

Patterns matched:
- Exact enum value match (case-insensitive)
- Declared in spec.signals[].values

### Pattern 3: Yes/No Questions

```
Text: "Requires manager approval"
↓
Signal: requires_approval = true
```

Patterns matched:
- `yes`, `true`, `enabled`, `allow`
- `no`, `false`, `disabled`, `block`

---

## Troubleshooting

### Signal Not Populated

**Problem**: Expected signal in decision.context, but it's missing.

**Solutions**:
1. Check signal is declared in spec: `spec.signals[].name`
2. Check source is `'context'`: `spec.signals[].source`
3. Check text contains recognizable pattern
4. If pattern unusual, enable assisted parsing

### Error: "Signal validation failed"

**Problem**: Required signal not populated.

**Solutions**:
1. Verify required signals have unstructured_context
2. Add explicit value to decision.context if needed
3. Make signal optional if it can't be extracted

### Low LLM Confidence

**Problem**: Assisted parsing returning low confidence results.

**Solutions**:
1. Lower confidence threshold (0.7 → 0.6)
2. Make signal optional (not required)
3. Improve text clarity in AI prompt

---

## Performance

| Scenario | Time |
|----------|------|
| No unstructured_context | 0ms (skipped) |
| Deterministic extraction | <1ms |
| + Assisted parsing (LLM) | 100-1000ms |

👉 Use deterministic by default, add LLM only if needed.

---

## RFC Compliance

Observe phase enforces:
- ✅ Signal declaration respect
- ✅ No schema modifications
- ✅ Pre-resolution execution
- ✅ Deterministic extraction first
- ✅ Non-authoritative assisted parsing
- ✅ Zero intent/domain/stage inference
- ✅ No LLM output leakage

See [RFC-002 Section 7](./docs/RFC-002-v1.2-Organizational-Scope-and-Domain-Identity.md#7-signal-population-from-unstructured-context-normative) for details.

---

## Files

- 📁 **Implementation**: `packages/server/src/observe/`
- 📄 **Full Guide**: `IMPLEMENTATION-RFC-002-SECTION-7.md`
- 📄 **Delivery**: `RFC-002-SECTION-7-DELIVERY.md`
- 📄 **RFC**: `docs/RFC-002-v1.2-...md`

---

## One More Thing

Observe phase is **optional** - don't provide `unstructured_context` if you don't need it.

Existing signals in decision.context are preserved.

---

**Ready to use! 🚀**
