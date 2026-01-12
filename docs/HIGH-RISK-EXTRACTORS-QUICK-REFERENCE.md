# High-Risk Signal Extractors - Quick Reference

**For**: Policy authors, signal declaration, auditing  
**Source**: `docs/HIGH-RISK-SIGNAL-EXTRACTORS.md`

---

## Extractor Summary Table

| Extractor | Signal Type | Signal Name | Matches | Returns | Use Case |
|-----------|------------|-------------|---------|---------|----------|
| **Monetary Presence** | `boolean` | `has_monetary_value` | Currency symbols (`$€£¥`), ISO codes (`USD`, `EUR`), monetary verbs (`charge`, `pay`, `transfer`, `refund`) | `true` / `undefined` | Detect financial transaction context |
| **Proportion** | `boolean` | `has_proportion` | Percentage (`%`), proportional language (`portion`, `fraction`, `ratio`), universal quantifiers (`all`, `every`, `each`, `entire`) | `true` / `undefined` | Detect proportional or system-wide scope |
| **Universal Scope** | `boolean` | `has_universal_scope` | Universal quantifiers (`all`, `always`, `never`), unbounded language (`without exception`, `regardless`), absolute modifiers (`must`, `cannot`) | `true` / `undefined` | Detect absolute or unbounded policy language |
| **Policy Keywords** | `enum` | `policy_keyword` | Policy-related keywords: `fee`, `refund`, `penalty`, `entitled`, `restriction`, `limit`, `threshold`, `escalate` | enum value / `undefined` | Classify policy-relevant contexts |

---

## Signal Declarations

Add these to your `DecisionSpec.signals`:

```json
{
  "signals": [
    {
      "name": "has_monetary_value",
      "type": "boolean",
      "source": "context",
      "required": false
    },
    {
      "name": "has_proportion",
      "type": "boolean",
      "source": "context",
      "required": false
    },
    {
      "name": "has_universal_scope",
      "type": "boolean",
      "source": "context",
      "required": false
    },
    {
      "name": "policy_keyword",
      "type": "enum",
      "values": ["fee", "refund", "penalty", "entitled", "restriction", "limit", "threshold", "escalate"],
      "source": "context",
      "required": false
    }
  ]
}
```

---

## Policy Binding Examples

### Detect Financial Context
```json
{
  "conditions": [
    { "field": "has_monetary_value", "operator": "==", "value": true }
  ],
  "verdict": "PAUSE"
}
```

### Detect System-Wide Impact
```json
{
  "conditions": [
    { "field": "has_universal_scope", "operator": "==", "value": true }
  ],
  "verdict": "PAUSE"
}
```

### Detect Specific Keyword
```json
{
  "conditions": [
    { "field": "policy_keyword", "operator": "==", "value": "refund" }
  ],
  "verdict": "PAUSE"
}
```

### Combine Multiple Signals
```json
{
  "conditions": [
    { "field": "has_monetary_value", "operator": "==", "value": true },
    { "field": "has_proportion", "operator": "==", "value": true },
    { "field": "policy_keyword", "operator": "==", "value": "refund" }
  ],
  "verdict": "BLOCK"
}
```

---

## Structural vs. Semantic

| Aspect | This System | NOT This System |
|--------|----------|----------|
| **Detects presence of** patterns (structural) | ✅ `"$5000"` → `has_monetary_value = true` | ❌ `"$5000"` → `"is expensive"` |
| **Keyword matching** (word boundary) | ✅ `"fee"` exact match in text | ❌ `"coffee"` contains `"fee"` |
| **Pattern auditing** (show all regex) | ✅ All patterns in spec | ❌ Hidden ML model |
| **False positives allowed** | ✅ Hotel WiFi → `has_monetary_value` | ❌ Filters by domain context |
| **Reversible & explainable** | ✅ Point to exact pattern match | ❌ Black box scoring |

---

## Audit Trail

**Populated signals appear in**: `decision.context`  
**Source text stored**: NO (only extracted values)  
**Extractor failures**: Logged at WARN level, non-fatal  
**Signal source**: Visible via `DecisionSpec.signals[].source`

---

## Pattern Reference

### Monetary Presence
```
$100 | €50 | £75 | ¥1000
5000 USD | 100 EUR | transfer | charge | refund
```

### Proportion/Percentage
```
15% | 50.5% | all users | every transaction
each order | entire system | half the amount | portion of
```

### Universal Scope
```
all | every | always | never | entire | total | universal
across all | system-wide | global | without exception | regardless
must | cannot | will not | absolutely | definitely
```

### Policy Keywords
```
fee | refund | penalty | entitled | restriction | limit | threshold | escalate
```

---

## Performance

| Extractor | Time | Complexity |
|-----------|------|-----------|
| Monetary | < 0.1ms | O(patterns × text length) |
| Proportion | < 0.1ms | O(patterns × text length) |
| Universal Scope | < 0.1ms | O(patterns × text length) |
| Policy Keywords | < 0.1ms | O(keywords × text length) |

**Total**: < 0.5ms for typical 10KB unstructured input

---

## Troubleshooting

**Q: Signal not populating even though text contains the word?**  
A: Check for word boundaries. `"coffee"` won't match `"fee"` extractor.

**Q: Want to add more keywords?**  
A: Update `DecisionSpec.signals[].values` for `policy_keyword`. Code change required for new extractors.

**Q: Multiple keywords detected?**  
A: Extractor returns **first match** (in priority order). Use separate signals or custom extractor for multiple detection.

**Q: Is false positive acceptable?**  
A: Yes. Extractors are structural. Policies make governance decisions. If you want to exclude contexts, add conditions to your policies.

---

## Related Files

- **Specification**: `docs/HIGH-RISK-SIGNAL-EXTRACTORS.md`
- **Implementation Guide**: `docs/IMPLEMENTATION-RFC-002-SECTION-7.md`
- **Source Code**: `packages/server/src/observe/signal-populator.ts`
- **Types**: `packages/shared/src/schemas.ts` (SignalDefinition, DecisionSpec)

---

**Last Updated**: 2025-01-12
