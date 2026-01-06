# Mandate UI – Observability Build Plan v1.0
(Read-Only Audit & Decision Observatory)

**Status:** Approved  
**Version:** v1.0  
**Framework:** Nuxt 3 (Vue 3)  
**Styling:** Tailwind CSS  
**Aligned RFCs:** RFC-001, RFC-003  
**Last Updated:** 2026-01-06

---

## 1. Purpose

This document defines the **codegen-safe build plan** for the Mandate **Observability & Audit UI**.

The UI is:
- Strictly read-only
- Downstream of the AI Control Plane
- Focused on visibility, explanation, and audit

The UI is NOT:
- A control panel
- A workflow system
- An approval or enforcement interface

---

## 2. Core UI Principles (Hard Rules)

1. **Read-Only Always**
   - No POST / PUT / PATCH / DELETE calls
   - No mutations of Mandate state

2. **Evidence First**
   - UI renders persisted artifacts only
   - No recomputation of verdict logic

3. **No Enforcement Affordances**
   - No buttons like Approve / Reject / Retry / Resume
   - No overrides or edits

4. **Stateless Frontend**
   - No client-side governance logic
   - No caching of decisions that alters meaning

---

## 3. Technology Stack (Frozen v1)

| Layer | Choice |
|----|----|
| Framework | Nuxt 3 (Vue 3 Composition API) |
| Styling | Tailwind CSS |
| State | Minimal (URL + local component state) |
| Charts | Optional (simple SVG / lightweight lib) |
| Auth | Optional, read-only |
| Build | Vite (Nuxt default) |

---

## 4. Application Structure

```
ui/
├── app.vue
├── nuxt.config.ts
├── tailwind.config.ts
├── pages/
│   ├── index.vue                  # Decision List
│   └── decisions/
│       └── [decisionId].vue       # Timeline View
├── components/
│   ├── DecisionTable.vue
│   ├── DecisionFilters.vue
│   ├── Timeline.vue
│   ├── TimelineEntry.vue
│   ├── VerdictBadge.vue
│   ├── VerdictExplanation.vue
│   └── JsonViewer.vue
├── composables/
│   └── useMandateApi.ts
├── types/
│   └── mandate.ts                 # Read-only API response types
└── assets/
    └── styles.css
```

---

## 5. Pages & Views

### 5.1 Decision List Page (`/`)

**Purpose:** Discover and filter decisions.

**Data Sources:**
- GET `/api/v1/decisions`
- GET `/api/v1/verdicts`

**Features:**
- Table of decisions
- Filters:
  - Time range
  - Verdict
  - Intent
  - Agent / Service
  - Tenant (optional)

**Constraints:**
- No inline actions
- Row click navigates to timeline view only

---

### 5.2 Decision Timeline Page (`/decisions/:decisionId`)

**Purpose:** Reconstruct full decision lifecycle.

**Data Sources:**
- GET `/api/v1/decisions/:decisionId`
- GET `/api/v1/timeline/:decisionId`

**Layout:**
- Header: Decision summary
- Main: Vertical timeline
- Side panel: Verdict explanation

**Timeline Rules:**
- Strict chronological order
- Append-only rendering
- No hidden or collapsed entries

---

## 6. Core Components

### 6.1 `DecisionTable.vue`
- Pure presentation
- Emits selection events only

### 6.2 `Timeline.vue`
- Renders ordered timeline entries
- No inference or grouping logic

### 6.3 `TimelineEntry.vue`
Displays:
- Timestamp
- Entry type
- Source
- Authority level
- Summary
- Expandable JSON details

---

### 6.4 `VerdictExplanation.vue`
Displays:
- Verdict
- Policy snapshot ID
- Matched scopes
- Matched policy IDs
- Explanation text
- Precedence order

Must not recompute logic.

---

### 6.5 `JsonViewer.vue`
- Read-only JSON renderer
- No editing
- No copy-modify actions

---

## 7. Styling Guidelines (Tailwind)

- Neutral, audit-friendly palette
- Clear visual distinction for verdicts:
  - ALLOW: green
  - PAUSE: amber
  - BLOCK: red
  - OBSERVE: gray
- Avoid “action” colors for buttons
- No primary CTA patterns

---

## 8. API Composable (`useMandateApi`)

**Responsibilities:**
- GET requests only
- Error surfacing
- Loading states

**Forbidden:**
- Retries that alter semantics
- Silent fallbacks
- Client-side filtering that hides data

---

## 9. Authentication (Optional v1)

If enabled:
- Read-only roles only
- No write tokens
- UI must function without auth for internal use

---

## 10. Codegen Rules (Cursor / AI Tools)

When generating UI code:
- Generate one component at a time
- No speculative features
- No mock enforcement
- If unsure, render raw data instead of interpreting

---

## 11. Testing Strategy

### Manual
- Load known decision IDs
- Verify full timeline visibility
- Verify verdict explanation accuracy

### Automated (Optional)
- Snapshot tests for rendering
- No logic-heavy unit tests needed

---

## 12. Implementation Order

1. Project scaffold (Nuxt + Tailwind)
2. API composable
3. Decision list page
4. Timeline page
5. Explanation panel
6. Visual polish

---

## 13. Drift Detection Checklist

Before merging UI changes:
- [ ] Does this mutate state? (Must be NO)
- [ ] Does this enforce or override? (Must be NO)
- [ ] Does this recompute logic? (Must be NO)
- [ ] Is this still explain-only? (Must be YES)

---

## 14. Summary

This UI exists to **make governance visible**, not actionable.

If users ask:
> “What should I do next?”

The UI has done its job by answering:
> “Here is what happened, and why.”

---

**End of UI Build Plan v1.0**
