# Evaluator Input Contract: Structured Signal Data Only

**Status**: Specification  
**Version**: 1.0  
**Date**: 2025-01-12  
**Applies To**: Mandate Server v1.0+ Evaluator Module  

---

## 1. Overview

Evaluators consume **populated signal values only**. They never parse raw text, never call LLMs, and never access unstructured input. This separation of concerns ensures:

- ✅ **Determinism**: Evaluators are pure functions with predictable behavior
- ✅ **Auditability**: All input signals are explicitly populated and visible
- ✅ **Safety**: Missing required signals cause safe failures, not silent defaults
- ✅ **Clarity**: No hidden inference or multi-step parsing

**Design Rule**: Signal population (Observe phase) → Evaluator (policy evaluation) → Verdict issuance

---

## 2. Input Contract

### 2.1 What Evaluators Receive

Evaluators receive **three inputs**, all structured data:

```typescript
export function evaluateDecision(
  decision: DecisionEvent,      // Signal values + scope + timestamp
  spec: DecisionSpec,            // Declared signals + allowed verdicts
  snapshot: PolicySnapshotV1     // Policies to evaluate against
): EvaluationResult;             // Verdict + matched policy IDs
```

#### DecisionEvent (Signal Container)

```typescript
{
  decision_id: string,                    // Unique ID
  organization_id: string,                // Governance boundary
  domain_name: string,                    // Governance boundary
  intent: string,                         // What user tried to do
  stage: 'proposed' | 'pre_commit' | 'executed',
  actor: string,                          // Who tried it
  target: string,                         // What they targeted
  context: Record<string, unknown>,       // ← Populated signal values ONLY
  scope: {                                // ← Pre-populated scope fields
    organization_id: string,
    domain_name: string,
    service?: string,
    agent?: string,
    system?: string,
    environment?: string
  },
  timestamp: ISO8601 string,              // ← Pre-populated from request
  spec_id: string,                        // Set by spec resolution
  spec_version: string                    // Set by spec resolution
}
```

**What `context` contains**:
- ✅ Values populated by deterministic extraction
- ✅ Values populated by LLM-assisted parsing (confidence >= threshold)
- ✅ Manual values provided in original decision request
- ❌ Never raw text, never unstructured input, never parsing state

#### DecisionSpec (Signal Declaration)

```typescript
{
  spec_id: string,
  version: string,
  organization_id: string,
  domain_name: string,
  intent: string,
  stage: 'proposed' | 'pre_commit' | 'executed',
  allowed_verdicts: ['ALLOW', 'PAUSE', 'BLOCK', 'OBSERVE'],
  signals: [
    {
      name: string,                    // Signal identifier
      type: 'enum' | 'boolean' | 'string' | 'number',
      values?: string[],               // For enum type
      required: boolean,               // Is signal mandatory?
      source: 'scope' | 'context' | 'timestamp'
    },
    // ... more signals
  ],
  enforcement: { ... },
  status: 'draft' | 'active' | 'deprecated',
  created_at: ISO8601 string
}
```

#### PolicySnapshotV1 (Policy Set)

```typescript
{
  snapshot_id: string,
  version: 1,
  created_at: ISO8601 string,
  policies: [
    {
      id: string,
      organization_id: string,
      domain_name: string,
      name: string,
      description: string,
      scope: Scope,                        // Policy applies to this scope
      scope_id: string,
      conditions: [
        {
          field: string,                   // Signal name (e.g., "amount", "urgency")
          operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'in',
          value: string | number | boolean | array
        },
        // ... more conditions
      ],
      verdict: 'ALLOW' | 'PAUSE' | 'BLOCK' | 'OBSERVE',
      spec_id: string                      // Policy bound to this spec
    },
    // ... more policies
  ]
}
```

---

## 3. Evaluator Behavior: Pure & Deterministic

### 3.1 What Evaluators DO

✅ **Read decision context** (populated signals)
```typescript
const amount = decision.context['amount'];  // Populated by Observe phase
const approval = decision.context['requires_approval'];  // Populated signal
```

✅ **Read decision scope** (pre-populated)
```typescript
const service = decision.scope.service;  // From decision, not extracted
const org = decision.organization_id;    // Governance boundary
```

✅ **Read decision timestamp** (pre-populated)
```typescript
const ts = decision.timestamp;  // RFC-001: Always present
```

✅ **Match policies** (deterministic filtering)
```typescript
// Step 1: Org/domain matching (enforced by RFC-002)
if (policy.scope.organization_id !== decision.organization_id) skip;

// Step 2: Scope matching (optional fields act as wildcards)
if (policy.scope.service && policy.scope.service !== decision.scope.service) skip;

// Step 3: Condition evaluation (signal-based logic)
if (decision.context['amount'] > 5000) verdict = 'PAUSE';
```

✅ **Resolve verdicts** (deterministic precedence)
```typescript
// Precedence: BLOCK > PAUSE > ALLOW > OBSERVE
// Multiple matched policies → highest precedence wins
const verdict = resolveVerdict(matches);  // Always same result for same input
```

✅ **Return evaluation result** (structured data)
```typescript
{
  verdict: 'BLOCK' | 'PAUSE' | 'ALLOW' | 'OBSERVE',
  matched_policy_ids: ['policy-1', 'policy-2']
}
```

### 3.2 What Evaluators MUST NOT Do

❌ **Never parse unstructured text**
```typescript
// FORBIDDEN: Evaluator receives raw text
const rawText = request.body.unstructured_context;  // Not available to evaluator
const signal = extractViaRegex(rawText);  // ✗ Evaluator cannot do this

// ✓ Correct: Signal already populated in context
const signal = decision.context['extracted_signal'];  // Pre-populated by Observe phase
```

❌ **Never call LLM services**
```typescript
// FORBIDDEN
const llmResult = await openai.extract(decision.context);  // ✗ No LLM calls

// ✓ Correct: Use only populated signals
if (decision.context['urgency'] === 'critical') {
  verdict = 'PAUSE';
}
```

❌ **Never access Date, Math.random, or randomization**
```typescript
// FORBIDDEN
const randomVerdict = Math.random() > 0.5 ? 'ALLOW' : 'BLOCK';  // ✗ Non-deterministic
const now = new Date();  // ✗ Time-dependent

// ✓ Correct: Deterministic logic based on signals
if (decision.context['amount'] > 5000) {
  verdict = 'PAUSE';  // Same input → always PAUSE
}
```

❌ **Never modify decision, spec, or snapshot**
```typescript
// FORBIDDEN
decision.context['status'] = 'processed';  // ✗ Mutation
spec.signals.push({ ... });  // ✗ Modification

// ✓ Correct: Return new result without modifying inputs
return { verdict: 'BLOCK', matched_policy_ids: [...] };
```

❌ **Never call database or external services**
```typescript
// FORBIDDEN
const user = await db.query('SELECT * FROM users WHERE id = ?', [actor]);  // ✗ DB access
const riskScore = await riskService.calculate(decision);  // ✗ External call

// ✓ Correct: Use only populated context signals
if (decision.context['user_risk_level'] === 'high') {
  verdict = 'PAUSE';
}
```

❌ **Never ignore required signals**
```typescript
// FORBIDDEN
const amount = decision.context['amount'] ?? 0;  // ✗ Silent default
const verdict = amount > 5000 ? 'PAUSE' : 'ALLOW';

// ✓ Correct: Fail if required signal missing
if (decision.context['amount'] === undefined) {
  return { verdict: 'BLOCK', matched_policy_ids: [] };  // Safe failure
}
```

❌ **Never infer intent, domain, or stage**
```typescript
// FORBIDDEN
const inferred_intent = analyzeContext(decision.context);  // ✗ Inference
const intent = decision.context['action_type'] ?? 'unknown';  // ✗ Default fallback

// ✓ Correct: Use explicit decision fields
const intent = decision.intent;  // Explicit, immutable
```

---

## 4. Signal Resolution Logic

### 4.1 Where Signals Come From

Evaluators resolve signals from **two sources only**:

```typescript
function resolveSignal(fieldName: string, decision: DecisionEvent): unknown {
  // Source 1: Context (populated signals)
  if (fieldName in decision.context) {
    return decision.context[fieldName];  // ✓ Populated value
  }

  // Source 2: Scope (pre-populated governance fields)
  if (fieldName in decision.scope) {
    return decision.scope[fieldName];  // ✓ Pre-populated
  }

  // No other sources
  return undefined;  // Signal not found → condition fails
}
```

### 4.2 Signal Lookup Order

1. **Context first** (most common): `decision.context['amount']`
2. **Scope second** (governance): `decision.scope['service']`
3. **Not found**: Condition fails, policy skipped

**Example**:
```json
{
  "decision": {
    "context": {
      "amount": 5000,
      "urgency": "critical"
    },
    "scope": {
      "organization_id": "org-123",
      "service": "billing"
    }
  },
  "policy": {
    "conditions": [
      { "field": "amount", "operator": ">", "value": 3000 },
      { "field": "service", "operator": "==", "value": "billing" }
    ]
  }
}
```

**Resolution**:
- `amount` → found in context → value: 5000
- `service` → found in scope → value: "billing"
- Both conditions match → policy matched

---

## 5. Missing Required Signals: Fail Safe

### 5.1 Definition

A signal is **required** if `spec.signals[].required === true`.

```typescript
{
  "signals": [
    { "name": "amount", "type": "number", "required": true },    // ← Must be populated
    { "name": "priority", "type": "string", "required": false }   // ← Optional
  ]
}
```

### 5.2 Missing Signal Handling

**During Evaluate Phase**:

```typescript
// Signal validator runs BEFORE evaluator
// Checks all required signals are populated in decision.context

if (spec.signals.some(s => s.required && !decision.context[s.name])) {
  throw new Error('Required signal missing');
  // ✓ Safe failure; decision is not evaluated
}
```

**If Required Signal is Missing**:

```
Decision received
  ├─ Observe phase: Attempted extraction
  ├─ Signal validation: Required signal NOT found in context
  └─ Error: 400 Bad Request
     └─ Decision NOT evaluated
     └─ Verdict NOT issued
     └─ Caller must handle missing signal
```

### 5.3 Optional Signals

If signal is optional and not populated:

```typescript
// Condition references optional signal
{
  "field": "audit_notes",
  "operator": "==",
  "value": "suspicious"
}

// Signal not in context
if (decision.context['audit_notes'] === undefined) {
  // Condition fails (no signal → condition false)
  // Policy skipped
}
```

---

## 6. Condition Evaluation Rules

### 6.1 Operators

| Operator | Type | Example | Behavior |
|----------|------|---------|----------|
| `==` | Any | `{ field: "status", operator: "==", value: "active" }` | Exact match (strict equality) |
| `!=` | Any | `{ field: "status", operator: "!=", value: "blocked" }` | Not equal |
| `>` | Number | `{ field: "amount", operator: ">", value: 1000 }` | Greater than (numeric) |
| `<` | Number | `{ field: "amount", operator: "<", value: 5000 }` | Less than (numeric) |
| `>=` | Number | `{ field: "amount", operator: ">=", value: 1000 }` | Greater or equal |
| `<=` | Number | `{ field: "amount", operator: "<=", value: 5000 }` | Less or equal |
| `in` | Array | `{ field: "status", operator: "in", value: ["active", "pending"] }` | Array membership |

### 6.2 Type Safety

Evaluator enforces type safety **during evaluation**:

```typescript
// Type mismatch → condition fails (returns false)
{
  "field": "amount",           // Number signal
  "operator": ">",
  "value": "1000"              // String value → type mismatch
}

// Evaluation: typeof decision.context['amount'] === 'number'
//             && typeof condition.value === 'number'
// Result: false (numeric comparison requires both to be numbers)
```

---

## 7. Verdict Resolution (Unchanged)

### 7.1 Precedence

Verdict resolution **does NOT change** with Observe phase:

```
BLOCK > PAUSE > ALLOW > OBSERVE
```

**Rules**:
- Multiple matched policies → highest precedence wins
- No policies matched → default `ALLOW`
- Precedence is deterministic (always same input = always same output)

### 7.2 Examples

```
Matched policies:
- Policy A: verdict = ALLOW
- Policy B: verdict = PAUSE
- Policy C: verdict = OBSERVE

Result: PAUSE (highest precedence)
Matched IDs: [A, B, C]
```

```
Matched policies:
- Policy X: verdict = BLOCK
- Policy Y: verdict = PAUSE

Result: BLOCK (highest precedence)
Matched IDs: [X, Y]
```

```
Matched policies: (none)

Result: ALLOW (default)
Matched IDs: []
```

---

## 8. Enforcement Semantics (Unchanged)

Enforcement semantics are **NOT modified** by the Observe phase:

```typescript
// Enforcement semantics from spec (example)
{
  "enforcement": {
    "pause_requires": ["manager_approval"],
    "resolution_timeout_minutes": 60
  }
}

// Verdict PAUSE means: escalate and wait for approval
// Verdict BLOCK means: deny immediately
// Verdict ALLOW means: permit immediately
// These meanings do NOT change based on signal source

// Whether signals come from deterministic extraction or LLM,
// the verdict logic remains identical
```

---

## 9. Data Flow & Isolation

### 9.1 Complete Flow

```
┌──────────────────────────────────────────────────────────────┐
│ DECISIONS API REQUEST                                        │
└──────────────────────────────────────────────────────────────┘
  │
  ├─→ Schema Validation (decision structure)
  │
  ├─→ Org/Domain Resolution
  │
  ├─→ Spec Resolution (find matching DecisionSpec)
  │
  ├─→ ╔════════════════════════════════════════╗
  │   ║ OBSERVE PHASE (Signal Population)      ║
  │   ║ - Deterministic extraction from text   ║
  │   ║ - Optional LLM-assisted parsing        ║
  │   ║ → Populated signals in decision.context║
  │   ╚════════════════════════════════════════╝
  │
  ├─→ Signal Validation (all required signals present?)
  │
  ├─→ Insert decision to audit trail
  │
  ├─→ ╔════════════════════════════════════════╗
  │   ║ EVALUATOR (Policy Evaluation)          ║
  │   ║ - Receives: decision + spec + snapshot║
  │   ║ - Reads: context signals + scope      ║
  │   ║ - No text parsing, no LLM calls       ║
  │   ║ → Deterministic verdict               ║
  │   ╚════════════════════════════════════════╝
  │
  ├─→ Insert verdict to audit trail
  │
  └─→ Return decision + verdict
```

### 9.2 Key Boundaries

```
UNSTRUCTURED INPUT
       ↓
  Observe Phase (RF C-002 Section 7)
       ├─ Extract signals
       └─ Populate decision.context
             ↓
    POPULATED SIGNALS
       ↓
  Evaluator (RFC-001 Section 7)
       ├─ Read decision.context
       ├─ Match policies
       └─ Resolve verdict
             ↓
    VERDICT (ALLOW|PAUSE|BLOCK|OBSERVE)
```

**Evaluator boundary**: "Evaluators never see unstructured input"

---

## 10. RFC Compliance

### RFC-001 Constraints (Unchanged)

- ✅ Evaluators are deterministic (no Date, no Math.random, no async)
- ✅ Evaluators are pure functions (no side effects)
- ✅ Evaluators read decision and spec only
- ✅ Verdict logic is auditable (policies are assertions, not programs)
- ✅ Enforcement semantics unchanged

### RFC-002 Constraints (Enforced)

- ✅ Evaluators verify organization_id and domain_name alignment
- ✅ Evaluators filter policies by spec_id
- ✅ Evaluators enforce scope matching
- ✅ Unstructured input never reaches evaluator
- ✅ Signal population happens before evaluation

### Observe Phase (RFC-002 Section 7)

- ✅ Observe phase populates signals **before** evaluator runs
- ✅ Evaluator receives only populated signals
- ✅ No multi-stage extraction; one clean handoff

---

## 11. Test Examples

### Test 1: Evaluator Only Reads Populated Signals

```typescript
it('should evaluate policy based on populated signals only', () => {
  const decision = {
    decision_id: 'dec-1',
    organization_id: 'org-1',
    domain_name: 'finance',
    intent: 'transfer',
    stage: 'proposed',
    actor: 'agent-1',
    target: 'account-2',
    context: {
      amount: 5000,           // Populated by Observe phase
      urgency: 'critical'     // Populated by Observe phase
    },
    scope: { organization_id: 'org-1', domain_name: 'finance' },
    timestamp: '2025-01-12T10:00:00Z',
    spec_id: 'spec-transfer',
    spec_version: '1.0'
  };

  const spec = {
    spec_id: 'spec-transfer',
    version: '1.0',
    signals: [
      { name: 'amount', type: 'number', source: 'context', required: true },
      { name: 'urgency', type: 'string', source: 'context', required: false }
    ]
    // ...
  };

  const policy = {
    id: 'pol-1',
    conditions: [
      { field: 'amount', operator: '>', value: 3000 },
      { field: 'urgency', operator: '==', value: 'critical' }
    ],
    verdict: 'PAUSE'
    // ...
  };

  const result = evaluateDecision(decision, spec, snapshot);

  // Both conditions matched because signals were populated
  expect(result.verdict).toBe('PAUSE');
  expect(result.matched_policy_ids).toContain('pol-1');
});
```

### Test 2: Evaluator Fails If Required Signal Missing

```typescript
it('should reject evaluation if required signal is missing', () => {
  const decision = {
    // ...
    context: {
      urgency: 'high'
      // ✗ amount is missing (required)
    }
  };

  const spec = {
    signals: [
      { name: 'amount', type: 'number', source: 'context', required: true }
    ]
    // ...
  };

  expect(() => SignalValidator.validate(spec, decision)).toThrow(
    'Required signal "amount" not found in context'
  );

  // ✓ Evaluation never happens; safe failure
});
```

### Test 3: Evaluator Never Parses Text

```typescript
it('should never attempt to parse unstructured text', () => {
  const decision = {
    // ...
    context: {
      // Signals only; no unstructured text
      amount: 5000
    }
  };

  // Verify decision has no raw text field
  expect(decision).not.toHaveProperty('raw_input');
  expect(decision).not.toHaveProperty('unstructured_text');
  expect(decision).not.toHaveProperty('ai_response');

  // Evaluator operates on structured signals only
  const result = evaluateDecision(decision, spec, snapshot);
  expect(result.verdict).toBeDefined();
});
```

### Test 4: Evaluator is Deterministic

```typescript
it('should be deterministic: same input = same output', () => {
  const decision = { /* fixed */ };
  const spec = { /* fixed */ };
  const snapshot = { /* fixed */ };

  const result1 = evaluateDecision(decision, spec, snapshot);
  const result2 = evaluateDecision(decision, spec, snapshot);
  const result3 = evaluateDecision(decision, spec, snapshot);

  expect(result1).toEqual(result2);
  expect(result2).toEqual(result3);
  // Always BLOCK, never random or time-dependent
});
```

---

## 12. Transition: Pre-Observe to Post-Observe

### Before (Without Observe Phase)

```
Request with context signals
  → Evaluator (must handle both provided and inferred)
  → Verdict
```

**Problem**: Evaluator had to handle signal inference, LLM calls, text parsing

### After (With Observe Phase)

```
Request with unstructured context
  → Observe Phase (signal population)
  → Decision with populated context
  → Evaluator (only handles structured signals)
  → Verdict
```

**Benefit**: Evaluator is simpler, purer, more deterministic

---

## 13. FAQ

**Q: Can evaluator access the original unstructured text?**  
A: No. The unstructured text is never passed to the evaluator. Only populated signals are available.

**Q: What if a signal value is wrong/inaccurate?**  
A: That's a signal population issue (Observe phase), not an evaluator issue. Evaluators consume whatever signals are populated; they don't validate signal accuracy.

**Q: Can evaluator decide to re-extract signals?**  
A: No. Evaluator receives already-populated signals. If signals need re-extraction, that's a higher-level concern.

**Q: What if a required signal is missing?**  
A: Signal validation (before evaluator) will fail. The decision is not evaluated; caller must resolve the missing signal.

**Q: Can evaluator call other services?**  
A: No. Evaluators are pure functions. All input must come from decision, spec, and snapshot. No external calls.

**Q: Is verdict resolution logic changing?**  
A: No. Precedence (BLOCK > PAUSE > ALLOW > OBSERVE) is unchanged. Signal source doesn't affect verdict logic.

**Q: Can evaluator be async?**  
A: No. Evaluators must be synchronous, deterministic pure functions.

---

## 14. References

- **RFC-001**: Decision Specification and Policy Evaluation
- **RFC-002 Section 7**: Signal Population from Unstructured Context
- **IMPLEMENTATION-RFC-002-SECTION-7.md**: Observe phase implementation
- **packages/server/src/evaluator/index.ts**: Evaluator source code
- **packages/server/src/routes/decisions.ts**: API integration

---

**End of Specification**
