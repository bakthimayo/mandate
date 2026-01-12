# High-Risk Signal Extractors

**Version**: 1.0  
**Date**: 2025-01-12  
**Status**: Specification (Ready for Implementation)

---

## 1. Overview

High-risk signal extractors detect structural indicators in unstructured text that suggest elevated governance risk. These extractors run during the **Observe phase** as deterministic operations within the signal population pipeline.

### Core Principles

- **No semantic understanding**: Regex patterns and structural matching only
- **No domain knowledge**: Agnostic to business rules, policies, or risk frameworks
- **No factual correctness checks**: Accept any syntactically valid occurrence
- **Pure and auditable**: Every pattern is reversible and explainable
- **Maps to DecisionSpec**: Results must bind to declared signals (never infer new ones)

### Design Rationale

High-risk extractors are **structural indicators**, not risk assessments. Examples:
- A currency symbol presence **indicates** monetary context, not monetary value
- The word "all" **indicates** universal scope, not risk magnitude
- A percentage symbol **indicates** proportional context, not percentage value

These are auditable facts that policies can reference without semantic overhead.

---

## 2. Extractor Definitions

### 2.1 Monetary Presence Indicator

**Name**: `hasMonetaryValue`  
**Signal Type**: `boolean`  
**Description**: Detects presence of currency symbols or monetary keywords

#### Patterns (Any Match = True)

1. **Currency symbols**: `$`, `€`, `£`, `¥`, `₹`, `₽`
2. **Numeric + currency keyword**: e.g., `"1000 USD"`, `"5000 EUR"`, `"$5000"`, `"100 pounds"`
3. **Monetary verbs**: `"charge"`, `"pay"`, `"transfer"`, `"refund"`, `"debit"`, `"credit"`

#### Examples

```
Input:  "This transaction requires a $5000 transfer"
Output: true

Input:  "Please charge the customer €150 per month"
Output: true

Input:  "This policy will refund overpayments"
Output: true

Input:  "This is a data access decision"
Output: false
```

#### Regex Patterns

```typescript
[
  /[$€£¥₹₽]/,                                    // Currency symbols
  /\d+\s*(USD|EUR|GBP|JPY|INR|RUB|CAD|AUD)/i,   // ISO codes
  /\b(charge|pay|transfer|refund|debit|credit)\b/i // Monetary verbs
]
```

#### Auditable Claim

"This signal is true if the text contains currency symbols, ISO currency codes, or monetary action verbs. It is a **structural indicator of monetary context**, not a risk verdict."

---

### 2.2 Percentage/Proportion Indicator

**Name**: `hasPercentageOrProportion`  
**Signal Type**: `boolean`  
**Description**: Detects percentage symbols, fractional language, or proportional keywords

#### Patterns (Any Match = True)

1. **Percentage symbol**: `%`
2. **Numeric + proportion keywords**: e.g., `"25% of"`, `"0.5 of the total"`, `"half of"`
3. **Proportional language**: `"portion"`, `"fraction"`, `"ratio"`, `"split"`, `"share"`
4. **Quantifier keywords**: `"all"`, `"every"`, `"each"`, `"entire"`, `"full"`, `"whole"`

#### Examples

```
Input:  "Apply a 15% fee to all transactions"
Output: true

Input:  "Refund 50% of the amount to each customer"
Output: true

Input:  "This affects every user in the system"
Output: true

Input:  "Process this single transaction"
Output: false
```

#### Regex Patterns

```typescript
[
  /%/,                                                    // Percentage symbol
  /\d+(?:\.\d+)?\s*%/,                                   // Numeric percentage
  /\b(portion|fraction|ratio|split|share|half)\b/i,      // Proportion language
  /\b(all|every|each|entire|full|whole|universal)\b/i    // Universal quantifiers
]
```

#### Auditable Claim

"This signal is true if the text contains percentage symbols, proportional language (portion, fraction, ratio), or universal quantifiers (all, every, entire). It is a **structural indicator of proportional or universal scope**, not a quantitative assessment."

---

### 2.3 Universal Scope Indicator

**Name**: `hasUniversalScope`  
**Signal Type**: `boolean`  
**Description**: Detects absolute, unbounded, or universal language

#### Patterns (Any Match = True)

1. **Universal quantifiers**: `"all"`, `"every"`, `"any"`, `"always"`, `"never"`, `"entire"`, `"total"`
2. **Unbounded language**: `"without exception"`, `"no matter what"`, `"regardless"`, `"unconditional"`
3. **Absolute modifiers**: `"absolutely"`, `"definitely"`, `"must"`, `"cannot"`, `"will not"`
4. **Scope wideners**: `"across all"`, `"system-wide"`, `"global"`, `"organization-wide"`

#### Examples

```
Input:  "This policy applies to all users without exception"
Output: true

Input:  "Every transaction must be reviewed"
Output: true

Input:  "This applies system-wide regardless of user role"
Output: true

Input:  "Apply this policy to premium tier customers"
Output: false
```

#### Regex Patterns

```typescript
[
  /\b(all|every|any|always|never|entire|total|universal)\b/i,           // Universal quantifiers
  /\b(without exception|no matter what|regardless|unconditional)\b/i,     // Unbounded language
  /\b(absolutely|definitely|must|cannot|will not|cannot be)\b/i,         // Absolute modifiers
  /\b(across all|system.?wide|global|organization.?wide)\b/i             // Scope wideners
]
```

#### Auditable Claim

"This signal is true if the text contains universal quantifiers (all, every, always), unbounded language (without exception, regardless), or absolute modifiers (must, cannot). It is a **structural indicator of absolute or unbounded scope**, not a risk magnitude."

---

### 2.4 Policy-Related Keyword Presence

**Name**: `hasPolicyKeywords`  
**Signal Type**: `enum` (values: `['fee', 'refund', 'penalty', 'entitled', 'restriction', 'limit', 'threshold', 'escalate']`)  
**Description**: Detects specific governance-related keywords that often appear in policy contexts

#### Keyword Set

| Keyword | Context | Example |
|---------|---------|---------|
| `fee` | Cost/charge | "Apply a 2% fee per transaction" |
| `refund` | Reversal/reimbursement | "Refund the original amount within 30 days" |
| `penalty` | Punitive action | "Penalty of $100 for late payment" |
| `entitled` | Rights/permissions | "User is entitled to three escalations per month" |
| `restriction` | Constraint | "Restriction on concurrent access" |
| `limit` | Boundary | "Limit of 10 API calls per second" |
| `threshold` | Trigger point | "Threshold of $5000 requires additional approval" |
| `escalate` | Elevation | "Escalate to manager if amount exceeds limit" |

#### Matching Rule

**Case-insensitive exact word boundary match**. Returns the **first matched keyword** (in priority order), or `undefined` if no match.

#### Examples

```
Input:  "Charge a 5% fee on all refunds"
Matches: 'fee' (first match)
Output: 'fee'

Input:  "Users are entitled to view their own data"
Matches: 'entitled'
Output: 'entitled'

Input:  "Escalate high-value transactions to compliance"
Matches: 'escalate'
Output: 'escalate'

Input:  "This is a normal data access decision"
Output: undefined
```

#### Regex Pattern

```typescript
const keywords = ['fee', 'refund', 'penalty', 'entitled', 'restriction', 'limit', 'threshold', 'escalate'];
for (const keyword of keywords) {
  const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
  if (pattern.test(text)) {
    return keyword;
  }
}
return undefined;
```

#### Auditable Claim

"This signal extracts the first occurrence of a specific governance keyword (fee, refund, penalty, entitled, restriction, limit, threshold, escalate). It is a **structural indicator of policy-relevant context**, not an interpretation of the policy itself."

---

## 3. Implementation Location

These extractors extend the `DeterministicExtractors` object in:

```
packages/server/src/observe/signal-populator.ts
```

### Addition Pattern

```typescript
const DeterministicExtractors = {
  // ... existing extractors ...

  /**
   * HIGH-RISK EXTRACTORS (RFC-002 Section 7 Extension)
   */

  extractMonetaryPresence: (text: string): boolean | undefined => {
    // See section 2.1
  },

  extractProportionPresence: (text: string): boolean | undefined => {
    // See section 2.2
  },

  extractUniversalScope: (text: string): boolean | undefined => {
    // See section 2.3
  },

  extractPolicyKeyword: (text: string): string | undefined => {
    // See section 2.4
  },
};
```

### Signal Declaration (DecisionSpec)

Signals using these extractors must be declared in DecisionSpec:

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

## 4. Extraction Algorithm

All high-risk extractors follow the same deterministic pattern used in the existing pipeline:

```
For each signal definition in DecisionSpec:
  If signal.source === 'context':
    For each regex pattern in extractor:
      If pattern.test(unstructuredText):
        Return { populated: true, value: <extracted value> }
    If no pattern matched:
      Return { populated: false }
```

**No confidence scoring, no side effects, no external calls.**

---

## 5. Audibility & Verification

### Explainability

Each extractor provides:

1. **Pattern inventory**: List of all regex patterns checked
2. **Matching examples**: Concrete text samples with expected output
3. **Structural claim**: What the signal **indicates**, not what it **means**
4. **Counter-examples**: Text that does NOT match

### Test Coverage

Each extractor requires:

- ✅ **Positive cases**: Text that should match
- ✅ **Negative cases**: Text that should NOT match
- ✅ **Edge cases**: Boundary conditions (capitalization, punctuation, multi-word phrases)
- ✅ **Immutability test**: Original decision unchanged after extraction

### Audit Trail

- Populated signals appear in `decision.context`
- No separate audit entries for extraction
- Unstructured input **not persisted** (only extracted values)

---

## 6. Examples: Binding to Policies

### Example 1: Fee Policy

```json
{
  "id": "policy-fee-cap",
  "name": "Fee Amount Cap",
  "description": "If a fee keyword is detected, require approval",
  "conditions": [
    {
      "field": "policy_keyword",
      "operator": "==",
      "value": "fee"
    }
  ],
  "verdict": "PAUSE"
}
```

### Example 2: Universal Scope Alert

```json
{
  "id": "policy-universal-scope",
  "name": "Universal Scope Review",
  "description": "If decision affects all users, require escalation",
  "conditions": [
    {
      "field": "has_universal_scope",
      "operator": "==",
      "value": true
    }
  ],
  "verdict": "PAUSE"
}
```

### Example 3: Monetary + Proportion

```json
{
  "id": "policy-refund-limit",
  "name": "Refund Proportion Limit",
  "description": "If refund with proportion detected, require risk assessment",
  "conditions": [
    {
      "field": "policy_keyword",
      "operator": "==",
      "value": "refund"
    },
    {
      "field": "has_proportion",
      "operator": "==",
      "value": true
    }
  ],
  "verdict": "PAUSE"
}
```

---

## 7. Migration & Adoption

### Phase 1: Specification (Current)

- ✅ Define extractor patterns and claims
- ✅ Document auditable characteristics
- ✅ Specify signal bindings

### Phase 2: Implementation

- [ ] Add extractors to `DeterministicExtractors`
- [ ] Write unit tests (positive, negative, edge cases)
- [ ] Update integration tests
- [ ] Verify no regressions in existing pipeline

### Phase 3: Deployment

- [ ] Create DecisionSpec with signals using these extractors
- [ ] Create test policies binding to extracted signals
- [ ] Verify audit trail
- [ ] Monitor extraction performance

---

## 8. Related Documentation

- **RFC-002 Section 7**: Signal Population from Unstructured Context
- **IMPLEMENTATION-RFC-002-SECTION-7.md**: Implementation guide for Observe phase
- **packages/shared/src/schemas.ts**: SignalDefinition and DecisionSpec types
- **packages/server/src/observe/signal-populator.ts**: Core extractor module

---

## 9. FAQ

**Q: Are these extractors running policies?**  
A: No. Extractors populate signal values. Policies reference those values. Extractors have zero business logic.

**Q: What if the text contains "fee" but it's not governance-related (e.g., "WiFi fee at the hotel")?**  
A: The extractor returns `true` anyway. Context is up to policies. This is a **structural indicator**, not a semantic judgment. Policies can further constrain using other signals.

**Q: Why is `policy_keyword` enum, not boolean?**  
A: Policies benefit from knowing *which* keyword was detected (fee vs. refund vs. penalty). This enables fine-grained decision rules without nested conditionals.

**Q: Can I add more keywords to `policy_keyword`?**  
A: Yes, by updating the DecisionSpec signal definition. Updating the extractor code requires a new migration.

**Q: Are these extractors sufficient for risk classification?**  
A: No. They are **indicators only**. Real risk classification requires policies that combine multiple signals and domain logic.

**Q: What if multiple keywords are present?**  
A: The extractor returns the **first match** (in priority order). Policies can reference only one `policy_keyword` value at a time. Multiple keyword detection requires multiple invocations or a custom signal.

---

**End of Specification**
