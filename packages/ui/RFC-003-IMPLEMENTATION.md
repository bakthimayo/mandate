# RFC-003 Implementation: Observability & Audit UI

**Status:** Implemented  
**Version:** v1.0  
**Date:** 2026-01-07

---

## Overview

The Mandate UI has been updated to fully implement RFC-003 constraints, transforming it into a **strictly read-only observability and audit interface**. The UI now displays all mandatory governance data while enforcing hard boundaries on mutations, re-evaluations, and control actions.

---

## Key Compliance Updates

### 1. **Read-Only Architecture** ✅

- **No mutation endpoints** - UI only calls GET endpoints
- **No state mutations** - All data is rendered as-is from APIs
- **No client-side governance logic** - No if/switch/evaluate/policy logic in UI
- **No action buttons** - Removed all "Approve", "Retry", "Override" buttons

### 2. **Spec & Spec-Version Display** ✅

**Types Updated:**
- `DecisionEvent` now includes `spec_id`
- `VerdictEvent` now includes `spec_id` and `spec_version`
- `DecisionListItem` now includes `spec_id`

**UI Components:**
- Decision list table shows truncated `spec_id`
- Timeline view displays full `spec_id` and `spec_version`
- Verdict explanation panel shows:
  - Spec ID (full ID)
  - Spec version (v1, v2, etc.)
  - Under "Resolved Specification" section

### 3. **Scope & Domain Display** ✅

**Types Updated:**
- New `ScopeContext` interface with:
  - `scope_id` - Hard identifier
  - `domain` - Governance boundary
  - `service`, `agent`, `owning_team` - Scope attributes
  - `matching_criteria` - Context used to match scope
- `VerdictEvent` includes:
  - `scope_id` - Which scope matched
  - `domain` - Scope domain context
  - `matched_scope` - Full ScopeContext details

**UI Components:**
- Decision detail pages show:
  - Decision domain
  - Spec domain context
  - Scope ID (truncated in tables, full in details)
- Verdict explanation shows:
  - Domain (hard boundary)
  - Scope ID
  - Matched scope details (service, agent, owning_team)
  - Under "Scope & Domain" section

### 4. **Policy Display** ✅

**Types Updated:**
- New `PolicyDefinition` interface with:
  - `id` - Policy identifier
  - `verdict` - ALLOW/PAUSE/BLOCK/OBSERVE
  - `conditions[]` - Signal+operator+value tuples
  - `explanation` - Optional policy description
- `VerdictEvent` includes:
  - `matched_policies[]` - Full PolicyDefinition objects
  - `matched_policy_ids[]` - Fallback string array

**UI Components:**
- Verdict explanation shows matched policies in dedicated section:
  - Policy ID (full mono font)
  - Verdict badge
  - Conditions list (signal operator value)
  - Policy explanation text
  - Organized in expandable cards

### 5. **Authority & Source Tracking** ✅

**Types Updated:**
- `VerdictEvent` includes `authority_source: 'system' | 'human'`

**UI Components:**
- Verdict explanation shows authority source:
  - "⚙️ System" for system-generated verdicts
  - "👤 Human" for human-reviewed verdicts
  - Distinct styling (blue for system, orange for human)

### 6. **Mandatory Verdict Fields** ✅

Every verdict display includes:

```
✓ decision_id
✓ verdict (ALLOW/PAUSE/BLOCK/OBSERVE)
✓ spec_id + spec_version
✓ scope_id
✓ domain
✓ matched_policy_ids (or full policy details)
✓ explanation (text from evaluation)
✓ authority_source (system | human)
✓ evaluation timestamp
```

---

## Component Updates

### Types (`types/mandate.ts`)

```typescript
// New interfaces for policy and spec details
- PolicyCondition
- PolicyDefinition
- SpecDefinition
- ScopeContext

// Enhanced VerdictEvent with:
- spec_id
- spec_version
- scope_id
- domain
- matched_scope (full context)
- matched_policies (full details)
- authority_source
```

### VerdictExplanation Component

**Structure:**
1. Verdict badge
2. Decision ID
3. **Resolved Specification** section
   - Spec ID + version
4. **Scope & Domain** section
   - Domain boundary
   - Scope ID
   - Scope details (service, agent, team)
5. **Matched Policies** section
   - Policy cards showing conditions and verdict
   - Fallback to policy IDs if details unavailable
6. Policy snapshot ID
7. Explanation text
8. **Authority & Source**
   - Authority source (system/human)
   - Issued timestamp
9. Verdict precedence

**Visual Discipline:**
- Explicit labels for all fields
- Raw IDs with monospace font
- No summarization or dashboard-style cards
- Conditions shown as declarative tuples
- Clear sections with uppercase headers

### Decision List View

- Added `spec_id` column
- Shows truncated spec ID (first 12 chars + ...)
- Maintains table structure (no cards)

### Timeline Views

- Decision context now shows:
  - Spec ID (truncated in header)
  - Domain
  - Organization ID (truncated)
- Timeline entries preserve original event data

### API Composable (`useMandateApi.ts`)

- Maps server responses to new type structure
- Handles optional fields with fallbacks
- No transformation beyond field mapping

---

## RFC-003 Enforcement

### ✅ Hard DON'Ts Implemented

- ✓ No Approve/Reject buttons
- ✓ No Resume Paused buttons
- ✓ No Edit Policy buttons
- ✓ No Trigger Re-evaluation buttons
- ✓ No Call Agent APIs
- ✓ No Override Verdicts
- ✓ No Fix/Retry/Continue actions
- ✓ No Workflow inbox UI

### ✅ Drift Detection

Any feature that would:
- Change system behavior → **BLOCKED**
- Override verdicts → **BLOCKED**
- Influence execution → **BLOCKED**
- Re-evaluate decisions → **BLOCKED**

...is explicitly not included in this implementation.

---

## Data Flow Diagram

```
API Response
    ↓
[decision_id, verdict, spec_id, scope_id, domain, matched_policies, etc.]
    ↓
Types (mandate.ts) - Type validation
    ↓
Components - Read-only rendering
    ↓
[Timeline, Verdict Explanation, Decision Details]
    ↓
User (read-only observation)
```

---

## Testing Checklist

- [ ] Types compile without errors
- [ ] Components render without mutations
- [ ] Spec ID displays in list view
- [ ] Verdict explanation shows spec version
- [ ] Scope context renders correctly
- [ ] Domain boundaries are visible
- [ ] Policy conditions are readable
- [ ] Authority source displays correctly
- [ ] No buttons that mutate state
- [ ] No re-evaluation logic

---

## Migration Path

When backend APIs are ready, ensure:

1. **VerdictEvent API** includes:
   - `spec_id`, `spec_version`
   - `scope_id`, `domain`
   - `matched_scope` object
   - `matched_policies[]` with full details
   - `authority_source`

2. **DecisionEvent API** includes:
   - `spec_id`
   - Domain information

3. **Read APIs always return**:
   - Original timestamps (no transformation)
   - Source and authority level
   - Full event payloads (no summarization)

---

## Design Principles Enforced

| Principle | Implementation |
|-----------|-----------------|
| Read-Only Always | No POST/PUT/DELETE endpoints called |
| Evidence Over Control | Only facts from storage, no speculation |
| Explanation First | Every verdict is explainable from stored data |
| Zero Enforcement | No actions that affect system behavior |

---

## Visual Examples

### Verdict Explanation Layout

```
┌─────────────────────────────────────────────────┐
│ Verdict Explanation                             │
├─────────────────────────────────────────────────┤
│ VERDICT: [BLOCK badge]                          │
│ DECISION ID: abc123def456...                    │
├─────────────────────────────────────────────────┤
│ RESOLVED SPECIFICATION                          │
│ SPEC ID: spec-pre-commit-file-write-v1          │
│ SPEC VERSION: v1                                │
├─────────────────────────────────────────────────┤
│ SCOPE & DOMAIN                                  │
│ DOMAIN: config-management                       │
│ SCOPE ID: 550e8400...                           │
│ [Scope Details Box]                             │
│   Service: config-writer                        │
│   Agent: pre-commit-agent                       │
│   Owning Team: config-team                      │
├─────────────────────────────────────────────────┤
│ MATCHED POLICIES                                │
│ [Policy 1 Card]                                 │
│   policy-allow-small-files-v1 [ALLOW]           │
│   Conditions:                                   │
│     content_length < 1048576                    │
│     content_type in ["yaml", "json", "toml"]    │
│ [Policy 2 Card]                                 │
│   policy-pause-large-files-v1 [PAUSE]           │
│   Conditions:                                   │
│     content_length >= 1048576                   │
├─────────────────────────────────────────────────┤
│ POLICY SNAPSHOT ID: 550e8400...                 │
│ EXPLANATION: This verdict was BLOCK because ... │
│ AUTHORITY SOURCE: ⚙️ System                     │
│ ISSUED AT: 2026-01-07 14:30:45                  │
│ VERDICT PRECEDENCE: #1 (highest priority)      │
└─────────────────────────────────────────────────┘
```

---

## Forbidden Patterns (Not In Code)

```javascript
// ❌ NOT IMPLEMENTED - Approve buttons
<button @click="approveVerdict">Approve</button>

// ❌ NOT IMPLEMENTED - Policy editing
<input v-model="policy.condition" />

// ❌ NOT IMPLEMENTED - Re-evaluation
<button @click="reevaluateDecision">Re-evaluate</button>

// ❌ NOT IMPLEMENTED - Agent invocation
async function retryAgent() { await api.post(...) }

// ❌ NOT IMPLEMENTED - Client-side logic
function evaluatePolicy(signals) { /* ... */ }
```

---

## Next Steps

1. **Backend API Implementation**
   - Ensure verdict events include all RFC-003 fields
   - Return spec version alongside spec_id
   - Include matched policies with conditions
   - Set authority_source correctly

2. **Integration Testing**
   - Query real decision/verdict events
   - Verify all fields render correctly
   - Check domain boundaries
   - Confirm no mutations possible

3. **Audit Trail**
   - Verify timeline entries show source
   - Confirm authority levels are tracked
   - Ensure snapshots are immutable

---

## Summary

The Mandate UI is now a **pure observability tool** that:
- Displays all governance decisions transparently
- Shows spec versions and scope context
- Lists matched policies with conditions
- Tracks authority and source
- Cannot mutate any state
- Cannot override any verdicts
- Cannot influence system behavior

If the UI feels "read-only and passive," that is correct. ✅

---

**End of RFC-003 Implementation Document**
