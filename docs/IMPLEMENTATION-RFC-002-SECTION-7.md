# RFC-002 Section 7: Signal Population from Unstructured Context - Implementation Guide

**Status**: ✅ Implemented  
**Version**: 1.0  
**Applies To**: Mandate Server v1.0+  
**Last Updated**: 2025-01-12

---

## 1. Overview

This document describes the implementation of **RFC-002 Section 7**, which defines how Mandate populates values for already-declared DecisionSpec signals from unstructured AI-generated response text.

### Key Features

- ✅ **Deterministic extraction first** - Pure, logic-based extraction for common patterns
- ✅ **Optional assisted parsing** - Non-authoritative LLM-based extraction as fallback
- ✅ **Signal declaration respect** - Never introduces new signals or modifies definitions
- ✅ **Phase ordering** - Executes BEFORE spec and scope resolution
- ✅ **Zero inference** - Never infers missing intent, domain, or stage
- ✅ **Immutable decision input** - Returns new decision without modifying original

---

## 2. Architecture

### Module Structure

```
packages/server/src/observe/
├── index.ts                    # Public API exports
├── signal-populator.ts         # Core signal extraction logic
├── signal-populator.test.ts    # Unit tests for extractors
├── observe-phase.ts            # Observe phase orchestration
└── observe-phase.test.ts       # Integration tests
```

### Public API

```typescript
// Observe phase main entry point
export async function executeObservePhase(
  decision: DecisionEvent,
  spec: DecisionSpec,
  unstructuredContext: string,
  config?: ObservePhaseConfig
): Promise<DecisionEvent>;

// Low-level signal population
export async function populateSignals(
  decision: DecisionEvent,
  signalDefs: readonly SignalDefinition[],
  unstructuredText: string,
  config?: SignalPopulationConfig
): Promise<Record<string, any>>;

// Helper to merge signals into decision context
export function mergeSignalsIntoDecision(
  decision: DecisionEvent,
  populatedSignals: Record<string, any>
): DecisionEvent;

// Executor factory with pre-configured settings
export function createObservePhaseExecutor(
  config: ObservePhaseConfig
): (decision: DecisionEvent, spec: DecisionSpec, context: string) => Promise<DecisionEvent>;
```

---

## 3. Signal Extraction Algorithm

### 3.1 Deterministic Extractors

Deterministic extractors run first and are **fully authoritative**. No confidence thresholds.

#### Numeric Extraction

Patterns matched (case-insensitive):
- `"field: 123"` or `"field: 123.45"`
- `"123 field"` or `"123 units"`
- `"$123"`, `"€123.45"`, `"£123"`, `"¥123"`

**Example**:
```
Input: "The transaction amount: 5000.50 USD"
Output: amount = 5000.5
```

#### Enum Extraction

Exact case-insensitive match against declared enum values.

**Example**:
```
Input: "This is a CRITICAL transaction"
Declared values: ['critical', 'high', 'medium', 'low']
Output: priority = 'critical'
```

#### Boolean Extraction

Pattern matching for common boolean expressions:
- True: `yes`, `true`, `enabled`, `allow`, `approved`, `ok`, `accept`
- False: `no`, `false`, `disabled`, `block`, `denied`, `reject`, `decline`

**Example**:
```
Input: "This transfer requires approval from a manager."
Output: requires_approval = true
```

#### String Qualifier Extraction

Matches declared allowed values or common qualifiers:
- `critical`, `high`, `medium`, `low`, `urgent`, `normal`, `routine`

**Example**:
```
Input: "Risk assessment shows this is a high risk transaction."
Output: risk_level = 'high'
```

### 3.2 Assisted Parsing (Optional)

Assisted parsing is **non-authoritative** and only used when:
1. `enableAssistedParsing` is `true`
2. Deterministic extraction **failed** for that signal
3. Result confidence **meets threshold** (default: 0.8)
4. Custom function is provided

**Constraints**:
- Must return `Record<string, { value: any; confidence: number }>`
- Below-threshold results are discarded
- Errors are non-fatal (logged, then continue)
- Never reduces risk classification or authorizes permissive outcomes

### 3.3 Source-Based Pre-Population

Signals with non-context sources are pre-populated:

- **`scope`**: Populated from `decision.scope` fields
- **`timestamp`**: Populated from `decision.timestamp`
- **`context`**: Extracted via deterministic or assisted methods

**Example**:

```typescript
const signal: SignalDefinition = {
  name: 'service',
  type: 'string',
  source: 'scope',  // Pre-populated from decision.scope.service
  required: false
};
```

---

## 4. Integration with Decisions API

### 4.1 Request Flow

```
POST /api/v1/decisions
  │
  ├─→ Validate schema
  ├─→ Verify organization/domain
  ├─→ Resolve DecisionSpec
  │
  ├─→ [NEW] Execute Observe Phase
  │   ├─→ Extract signals from unstructured_context
  │   ├─→ Merge populated signals into decision.context
  │   └─→ Return enriched decision
  │
  ├─→ Validate signals against spec
  ├─→ Enrich with spec reference
  ├─→ Evaluate against policies
  ├─→ Persist verdict
  └─→ Return result
```

### 4.2 Request Body

The Observe phase supports an optional `unstructured_context` field:

```typescript
interface DecisionRequest {
  decision: Omit<DecisionEvent, 'spec_id' | 'spec_version'>;
  unstructured_context?: string;  // AI response or other unstructured input
}
```

**Example Request**:

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
  "unstructured_context": "The requested transfer amount is $5000 with high priority. This is a critical payment."
}
```

**Result**:

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
    "context": {
      "amount": 5000,
      "priority": "high"
    },
    "scope": {
      "organization_id": "org-456",
      "domain_name": "finance"
    },
    "timestamp": "2025-01-12T10:00:00Z",
    "spec_id": "spec-transfer-001",
    "spec_version": "1.0.0"
  },
  "verdict": { ... }
}
```

---

## 5. Configuration

### Observe Phase Configuration

```typescript
interface ObservePhaseConfig {
  /**
   * Enable assisted (LLM-based) signal population.
   * Default: false (deterministic extraction only)
   */
  enableAssistedParsing?: boolean;

  /**
   * Minimum confidence threshold for assisted parsing results.
   * Default: 0.8 (80% confidence required)
   * Results below this threshold are discarded.
   */
  assistedParsingConfidenceThreshold?: number;

  /**
   * Custom assisted parsing function (e.g., LLM call).
   * If not provided and enableAssistedParsing is true, uses a stub.
   */
  assistedParsingFn?: (
    text: string,
    signalDefs: readonly SignalDefinition[],
    contextSignals: readonly SignalDefinition[]
  ) => Promise<Record<string, { value: any; confidence: number }>>;
}
```

### Default Configuration

```typescript
{
  enableAssistedParsing: false,        // Deterministic only by default
  assistedParsingConfidenceThreshold: 0.8,
  assistedParsingFn: undefined         // Uses stub
}
```

---

## 6. Implementation Details

### 6.1 Determinism Guarantee

The signal population is **fully deterministic**:

- ✅ No random number generation
- ✅ No Date/time operations
- ✅ No network calls
- ✅ No database access
- ✅ No side effects

Deterministic extractors are pure functions that produce the same output given the same input.

### 6.2 Immutability

The original decision is never modified:

```typescript
const enrichedDecision = mergeSignalsIntoDecision(decision, populatedSignals);
// decision remains unchanged
// enrichedDecision is a new object with merged context
```

### 6.3 Non-Inference Constraint

The Observe phase strictly avoids inference:

```typescript
// ❌ FORBIDDEN: Inferring missing intent
const intent = unstructuredText.includes('transfer') ? 'transfer_funds' : null;

// ❌ FORBIDDEN: Inferring missing domain
const domain = 'finance'; // hardcoded, not inferred from text

// ❌ FORBIDDEN: Inferring missing stage
const stage = unstructuredText.includes('propose') ? 'proposed' : 'executed';

// ✅ ALLOWED: Only populating already-declared signal values
const amount = extractNumber(unstructuredText, 'amount');
```

### 6.4 Signal Declaration Respect

Only signals declared in the DecisionSpec are populated:

```typescript
// DecisionSpec declares these signals:
const signals = [
  { name: 'amount', type: 'number', source: 'context' },
  { name: 'priority', type: 'enum', source: 'context' }
];

// Unstructured text contains: "amount: 5000, risk: high, priority: critical"
// After population:
// ✅ amount = 5000 (declared)
// ✅ priority = 'critical' (declared)
// ❌ risk is ignored (not declared)
```

---

## 7. Error Handling

### Observe Phase Errors

| Error Type | Behavior | Recovery |
|-----------|----------|----------|
| Empty/invalid spec | Returns unmodified decision | Continue to validation |
| Empty unstructured context | Returns unmodified decision | Continue to validation |
| Deterministic extraction failure | Skips signal, continues | Try assisted parsing or skip |
| Assisted parsing failure | Logs warning, continues | Skip assisted parsing results |
| Parsing result below threshold | Discards result | Treat as not populated |

### Route Handler Error Response

```json
{
  "error": "Observe phase failed",
  "details": "Error message here"
}
```

Status Code: **500**

---

## 8. Testing

### Test Coverage

- ✅ Unit tests for deterministic extractors (20+ cases)
- ✅ Integration tests for observe phase (15+ cases)
- ✅ Edge case handling (zero values, decimals, whitespace)
- ✅ Error handling (graceful degradation)

### Running Tests

```bash
# All observe phase tests
pnpm test -- packages/server/src/observe

# Specific test file
pnpm test -- signal-populator.test.ts

# Watch mode
pnpm test -- --watch observe
```

### Test Examples

```typescript
// Test: Extract numeric values
it('should extract numeric values from unstructured text', async () => {
  const result = await populateSignals(
    decision,
    [{ name: 'amount', type: 'number', source: 'context', required: false }],
    'The transaction amount: 5000.50 USD'
  );
  expect(result.amount).toBe(5000.5);
});

// Test: Respect signal declarations
it('should not populate signals not declared in spec', async () => {
  const result = await populateSignals(decision, [
    { name: 'declared_signal', type: 'number', source: 'context', required: false }
  ], 'Amount: 5000, undeclared: 9999');
  
  expect(result).toHaveProperty('declared_signal');
  expect(result).not.toHaveProperty('undeclared');
});

// Test: Preserve immutability
it('should not modify original decision', () => {
  const originalContext = { ...decision.context };
  mergeSignalsIntoDecision(decision, { amount: 5000 });
  expect(decision.context).toEqual(originalContext);
});
```

---

## 9. RFC Compliance Checklist

### RFC-002 Section 7 Requirements

- ✅ **Signal population only for declared signals**: Extractors validate against DecisionSpec
- ✅ **Pre-resolution execution**: Observe phase runs before spec/scope resolution
- ✅ **No schema modifications**: No new signals or definitions introduced
- ✅ **Deterministic extraction**: Pure functions, no side effects
- ✅ **Optional assisted parsing**: Non-authoritative, non-fatal fallback
- ✅ **No semantic understanding**: Regex and pattern matching only
- ✅ **No policy interpretation**: Zero verdict inference
- ✅ **Zero LLM output leakage**: Unstructured text not persisted in audit
- ✅ **No intent/domain/stage inference**: Attribution remains explicit
- ✅ **Context-sourced signals only**: Assisted parsing limited to `source: 'context'`

---

## 10. Usage Examples

### Example 1: Basic Signal Population

```typescript
import { executeObservePhase } from '@mandate/server/observe';

const decision = { /* decision event */ };
const spec = { /* decision spec with signals */ };
const aiResponse = "Transfer amount: 5000 USD with high priority";

const enrichedDecision = await executeObservePhase(
  decision,
  spec,
  aiResponse,
  { enableAssistedParsing: false }
);

// enrichedDecision.context now contains: { amount: 5000, priority: 'high' }
```

### Example 2: With Assisted Parsing

```typescript
const enrichedDecision = await executeObservePhase(
  decision,
  spec,
  unstructuredText,
  {
    enableAssistedParsing: true,
    assistedParsingConfidenceThreshold: 0.85,
    assistedParsingFn: async (text, signalDefs, contextSignals) => {
      // Call your LLM or extraction service
      const result = await myLLMService.extractSignals(text, contextSignals);
      return result;
    }
  }
);
```

### Example 3: Pre-Configured Executor

```typescript
const observeExecutor = createObservePhaseExecutor({
  enableAssistedParsing: false,
  assistedParsingConfidenceThreshold: 0.8
});

// Reuse for multiple decisions
const enriched1 = await observeExecutor(decision1, spec1, context1);
const enriched2 = await observeExecutor(decision2, spec2, context2);
```

---

## 11. Performance Considerations

### Deterministic Extraction

- **Time Complexity**: O(n * m) where n = signal count, m = regex patterns
- **Space Complexity**: O(k) where k = populated signals count
- **Typical Performance**: < 1ms for 10 signals and 10KB unstructured text

### Assisted Parsing

- **Depends on implementation**: User-provided function
- **Default stub**: O(1), immediate return
- **LLM-based**: Network latency + model inference (100-1000ms typical)

### Recommendations

- Use deterministic extraction by default (< 1ms overhead)
- Enable assisted parsing only if required for your use case
- Consider batching LLM calls if processing multiple decisions

---

## 12. Audit & Observability

### Audit Trail

The Observe phase does not modify audit requirements:

- ✅ All populated signals appear in decision.context
- ✅ Timeline entries record decision reception and verdict issuance
- ✅ No separate audit entries for signal population
- ✅ VerdictEvent references spec/scope/domain for full auditability

### Logging

Signal population failures are logged at WARN level:

```
[SIGNAL_POPULATOR] Assisted parsing failed: Error message
```

### Observability Best Practices

```typescript
// Recommended: Track population metrics
const startTime = Date.now();
const enriched = await executeObservePhase(decision, spec, context);
const duration = Date.now() - startTime;
metrics.recordSignalPopulationDuration(duration);
```

---

## 13. Migration Notes

### For Existing Systems

1. **Backward compatible**: `unstructured_context` is optional
2. **No schema changes**: Uses existing `context` field
3. **Gradual adoption**: Enable Observe phase per domain
4. **Zero disruption**: Signals already in context remain unchanged

### Deployment

```typescript
// In decisions route initialization
const observeConfig = {
  enableAssistedParsing: false,  // Start with deterministic only
  assistedParsingConfidenceThreshold: 0.8
};

// Later, enable for specific domains or rollout gradually
```

---

## 14. FAQ

**Q: Can I modify the decision in the Observe phase?**  
A: No. Signal population only populates declared signal values in `context`. Intent, domain, stage, scope remain unchanged.

**Q: What if deterministic extraction finds nothing?**  
A: The signal is not populated. If `required: true` in the spec, signal validation will fail downstream.

**Q: Can assisted parsing infer missing intent/domain?**  
A: No. Assisted parsing is limited to context-sourced signals only. Intent/domain/stage cannot be inferred.

**Q: How are populated signals different from provided signals?**  
A: There's no difference after population. Both appear in `decision.context`. Source is not tracked in the persisted decision.

**Q: Is the unstructured context stored in audit logs?**  
A: No. The Observe phase returns only the extracted signal values. Unstructured text is not persisted.

**Q: Can I use Observe phase for non-AI generated text?**  
A: Yes. It works with any unstructured text (logs, messages, descriptions, etc.).

---

## 15. Related RFCs

- **RFC-001**: Decision Spec and signal definitions
- **RFC-002**: Organizational scope and governance isolation
- **RFC-003**: Observability and audit UI (read-only, no state mutation)

---

## Appendix: Complete API Reference

See `packages/server/src/observe/index.ts` for exported types and functions.

```typescript
export { 
  executeObservePhase, 
  createObservePhaseExecutor 
} from './observe-phase.js';
export type { ObservePhaseConfig } from './observe-phase.js';

export { 
  populateSignals, 
  mergeSignalsIntoDecision 
} from './signal-populator.js';
export type { 
  SignalPopulationResult, 
  SignalPopulationConfig 
} from './signal-populator.js';
```

---

**End of Implementation Guide**
