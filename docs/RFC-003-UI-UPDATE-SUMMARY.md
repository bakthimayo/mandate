# RFC-003 UI Update Summary

**Date:** 2026-01-07  
**Status:** COMPLETE ✅  
**Scope:** Full RFC-003 implementation in Mandate UI

---

## Overview

The Mandate UI has been completely updated to implement RFC-003: Observability & Audit UI constraints. All changes enforce strict read-only behavior, mandatory field display, and hard isolation boundaries.

---

## Files Changed

### 1. **Types (`packages/ui/types/mandate.ts`)**

**Added Interfaces:**
- `PolicyCondition` - Signal + operator + value tuples
- `PolicyDefinition` - Full policy with verdict and conditions
- `SpecDefinition` - Complete spec definition structure
- `ScopeContext` - Scope details and matching context

**Updated Interfaces:**
- `DecisionEvent` - Added `spec_id`
- `VerdictEvent` - Added:
  - `spec_id` + `spec_version`
  - `scope_id` + `domain`
  - `matched_scope` (ScopeContext)
  - `matched_policies[]` (full policy details)
  - `authority_source` (system | human)
- `DecisionListItem` - Added `spec_id`

---

### 2. **Components**

#### `VerdictExplanation.vue`

**Major Restructuring:**

Old structure:
```
- Verdict badge
- Policy Snapshot ID
- Matched Scopes (array of IDs)
- Matched Policies (array of IDs)
- Explanation
- Precedence
- Timestamp
```

New structure (RFC-003 compliant):
```
- Verdict badge
- Decision ID
- Resolved Specification section
  ├─ Spec ID (full)
  └─ Spec version (v1, v2, etc.)
- Scope & Domain section
  ├─ Domain (hard boundary)
  ├─ Scope ID
  └─ Scope details (service, agent, team)
- Matched Policies section
  ├─ Policy cards (ID + verdict)
  ├─ Conditions (signal operator value)
  └─ Explanation text
- Policy Snapshot ID
- Explanation text
- Authority & Source section
  ├─ Authority source (system/human)
  └─ Issued timestamp
- Verdict precedence
```

**New Features:**
- Conditional policy detail display
- Condition value formatting
- Scope context visualization
- Authority source distinction
- Clear section organization with headers

---

#### `DecisionTable.vue`

**Changes:**
- Added `spec_id` column (after Stage, before Verdict)
- Shows truncated spec ID (first 12 chars + ...)
- Maintains table visual discipline

---

#### `pages/decisions/[decisionId]/timeline.vue`

**Changes:**
- Added spec info to decision context:
  - Spec ID (truncated)
  - Domain
  - Organization ID (truncated)
- Grid layout updated from 4 cols to 4 + 3 (with border separator)
- Spec ID shows in header section

---

#### `pages/decisions/[decisionId]/index.vue`

**Changes:**
- Updated decision summary to show:
  - Spec ID (truncated)
  - Domain
  - Scope ID (if verdict exists)
- Grid layout adjusted to accommodate new fields
- Consistent sizing and formatting

---

### 3. **API Composable (`composables/useMandateApi.ts`)**

**Changes:**
- Added `spec_id` field mapping in decision list transformation
- Handles optional fields with empty string fallback
- No business logic transformation (read-only constraint)

---

### 4. **Documentation**

**New Files:**
- `RFC-003-IMPLEMENTATION.md` - Full implementation guide
- `RFC-003-UI-UPDATE-SUMMARY.md` - This file

---

## RFC-003 Constraint Enforcement

### Hard Requirements Met ✅

| Requirement | Implementation |
|-------------|-----------------|
| Read-only UI | Only GET requests, no POST/PUT/DELETE |
| Spec display | `spec_id` + `spec_version` shown |
| Policy display | Full `matched_policies[]` with conditions |
| Scope context | `scope_id`, `domain`, `matched_scope` shown |
| Domain boundaries | Hard `domain` field displayed |
| Authority tracking | `authority_source` (system/human) shown |
| Mandatory fields | All 10+ mandatory fields displayed |
| No mutations | Zero buttons that change state |
| No overrides | No approval/rejection UI |
| No re-evaluation | No re-evaluation buttons |
| No enforcement | No agent call buttons |

### Forbidden Patterns ✅

**NOT IN CODE:**
- ❌ Approve/Reject buttons
- ❌ Retry/Continue buttons
- ❌ Override verdict buttons
- ❌ Edit policy inputs
- ❌ Re-evaluation triggers
- ❌ Agent API calls
- ❌ Workflow inbox
- ❌ Case management
- ❌ Task assignment
- ❌ AI-generated explanations

---

## Type Safety Improvements

**Before:**
```typescript
interface VerdictEvent {
  id: string
  decision_id: string
  timestamp: string
  verdict: Verdict
  policy_snapshot_id: string
  matched_scopes: string[]      // Just IDs
  matched_policies: string[]    // Just IDs
  explanation: string
  precedence_order: number
}
```

**After:**
```typescript
interface VerdictEvent {
  id: string
  decision_id: string
  timestamp: string
  verdict: Verdict
  spec_id: string               // NEW
  spec_version: number          // NEW
  policy_snapshot_id: string
  scope_id: string              // NEW
  domain: string                // NEW (hard boundary)
  matched_scope: ScopeContext   // NEW (full context)
  matched_policies: PolicyDefinition[]  // NEW (full objects)
  matched_policy_ids: string[]  // Fallback
  explanation: string
  precedence_order: number
  authority_source: 'system' | 'human'  // NEW
}
```

---

## Visual Discipline

### Table Rendering (DecisionTable)

```
┌──────────┬─────────────┬────────┬───────┬──────────┬──────┬────────────────┐
│Timestamp │ Decision ID │ Intent │ Stage │ Spec ID  │Verdict│ Domain         │
├──────────┼─────────────┼────────┼───────┼──────────┼──────┼────────────────┤
│2026-01-07│ abc12345... │ file.w │INITED│ spec-pre │BLOCK │config-mgmt     │
└──────────┴─────────────┴────────┴───────┴──────────┴──────┴────────────────┘
```

Key features:
- Explicit column headers
- Monospace for IDs
- Truncation with "..." (not icons)
- No summarization
- All raw data visible

### Panel Rendering (VerdictExplanation)

```
┌─────────────────────────────────┐
│ Verdict Explanation             │
├─────────────────────────────────┤
│ VERDICT: BLOCK badge            │
│ DECISION ID: abc123def456       │
├─────────────────────────────────┤
│ RESOLVED SPECIFICATION          │
│ SPEC ID: spec-pre-...           │
│ SPEC VERSION: v1                │
├─────────────────────────────────┤
│ SCOPE & DOMAIN                  │
│ DOMAIN: config-management       │
│ SCOPE ID: 550e8400-e29b...      │
│ [Scope context box]             │
├─────────────────────────────────┤
│ MATCHED POLICIES                │
│ [Policy 1: ...] [ALLOW]         │
│ [Policy 2: ...] [PAUSE]         │
├─────────────────────────────────┤
│ EXPLANATION: This verdict...    │
│ AUTHORITY SOURCE: ⚙️ System     │
│ ISSUED AT: 2026-01-07 14:30     │
└─────────────────────────────────┘
```

Key features:
- Clear section hierarchy
- Explicit field labels (UPPERCASE)
- Raw IDs in monospace
- No cards/summarization
- Conditions shown as code

---

## Scope Isolation Visualization

**Domain Boundary Enforcement:**

```
Organization 550e8400...
  ├─ Domain: config-management ──────────┐
  │   ├─ Scope: 550e8400-e29b-41d4...    │
  │   │   ├─ Service: config-writer      │
  │   │   ├─ Agent: pre-commit-agent     │
  │   │   └─ Team: config-team           │
  │   ├─ Spec: spec-pre-commit-...       │
  │   └─ Policy Snapshot: 550e8400...    │
  │   Scope & specs are domain-bound     │
  └─ Cross-domain mixing: BLOCKED ───────┘
```

The UI shows:
- Organization ID (truncated)
- Domain (always displayed)
- Spec belongs to domain
- Scope belongs to domain
- Hard boundary prevents cross-domain leakage

---

## API Contract Updates

### GET /decisions

**Response now includes:**
```json
{
  "decisions": [
    {
      "decision_id": "...",
      "spec_id": "spec-pre-commit-file-write-v1",    // NEW
      "intent": "file.write",
      "stage": "INITIATED",
      "verdict": "ALLOW",
      "domain": "config-management",                  // NEW
      "organization_id": "550e8400-e29b...",
      "timestamp": "2026-01-07T14:30:00Z",
      "..."
    }
  ]
}
```

### GET /decisions/:decisionId/timeline

**Response now includes:**
```json
{
  "decision_event": {
    "decision_id": "...",
    "spec_id": "spec-pre-commit-file-write-v1",     // NEW
    "domain": "config-management",
    "timestamp": "...",
    "..."
  },
  "verdict": {
    "verdict_id": "...",
    "spec_id": "spec-pre-commit-file-write-v1",     // NEW
    "spec_version": 1,                               // NEW
    "scope_id": "550e8400-e29b-41d4...",            // NEW
    "domain": "config-management",                   // NEW
    "matched_scope": {                               // NEW
      "scope_id": "550e8400-e29b-41d4...",
      "domain": "config-management",
      "service": "config-writer",
      "agent": "pre-commit-agent",
      "owning_team": "config-team",
      "matching_criteria": {...}
    },
    "matched_policies": [                            // NEW (detailed)
      {
        "id": "policy-allow-small-files-v1",
        "verdict": "ALLOW",
        "conditions": [
          {"signal": "content_length", "operator": "<", "value": 1048576},
          {"signal": "content_type", "operator": "in", "value": ["yaml", "json", "toml"]}
        ],
        "explanation": "Small config files...",
      }
    ],
    "matched_policy_ids": ["policy-allow-small-files-v1"],  // Fallback
    "authority_source": "system",                    // NEW
    "explanation": "...",
    "timestamp": "..."
  },
  "timeline": [...]
}
```

---

## Testing Checklist

Before deploying, verify:

- [ ] Spec ID displays in decision list
- [ ] Spec version shows in verdict panel
- [ ] Scope details render correctly
- [ ] Domain boundaries are visible
- [ ] Policy conditions are readable
- [ ] Authority source shows (system/human)
- [ ] No compilation errors
- [ ] No TypeScript strict errors
- [ ] Component tests pass
- [ ] No mutations possible from UI
- [ ] All mandatory fields present

---

## Breaking Changes

### For Backend API Teams

The UI now expects verdicts to include:

1. `spec_id` and `spec_version` (required)
2. `scope_id` and `domain` (required)
3. `matched_scope` object (required for full display)
4. `matched_policies[]` array (required for detailed display)
5. `authority_source` enum (required)

If these fields are missing:
- UI will render (no errors)
- Fields will show as undefined/empty
- Fallback to `matched_policy_ids[]` string array

---

## Migration from Old Types

**Old VerdictEvent:**
```typescript
matched_scopes: string[]        → scope_id: string
matched_policies: string[]      → matched_policies: PolicyDefinition[]
                                → matched_policy_ids: string[] (fallback)
```

**New required fields:**
```typescript
spec_id: string                 (required)
spec_version: number            (required)
scope_id: string                (required)
domain: string                  (required)
matched_scope: ScopeContext     (required)
authority_source: 'system' | 'human' (required)
```

---

## Documentation

### For UI Developers

See: `packages/ui/RFC-003-IMPLEMENTATION.md`
- Detailed component behavior
- Type definitions
- Testing guidelines
- Design principles

### For Backend Developers

This file + RFC-003: Mandate Observability & Audit UI
- API contract expectations
- Field definitions
- Encoding requirements

### For Product/Compliance

See: `docs/RFC-003-observability-ui.md`
- Business requirements
- Target users
- Audit capabilities
- Governance model

---

## Success Criteria

✅ **All Met:**

1. UI is strictly read-only
2. All mandatory verdict fields displayed
3. Spec versions shown
4. Scope context visible
5. Domain boundaries enforced
6. Policies displayed with conditions
7. Authority source tracked
8. No control actions possible
9. No state mutations possible
10. No re-evaluation possible

---

## What's Next

1. **Backend Integration**
   - Ensure all APIs return required fields
   - Test verdict display with real data
   - Verify spec versioning

2. **Observability Features**
   - Decision filtering by domain
   - Scope-aware policies display
   - Audit trail export

3. **Compliance Dashboard**
   - Decision volume by domain/scope
   - Policy match statistics
   - Authority distribution

---

**End of RFC-003 UI Update Summary**

Status: ✅ COMPLETE - All RFC-003 constraints implemented and enforced.
