# Mandate Observability & Audit UI

> Read-only audit console for Mandate AI Control Plane decisions.

## 🎯 Purpose

This UI provides:
- **Visibility** into governance decisions
- **Auditability** through timeline reconstruction
- **Explainability** of verdicts

**It does NOT provide:**
- Decision mutations
- Enforcement or remediation
- Approval workflows
- Policy authoring

## ⚠️ RFC-003: Hard Constraints

This UI is strictly read-only. Violations:
- ❌ No POST/PUT/PATCH/DELETE calls
- ❌ No state mutations
- ❌ No overrides, retries, or approvals
- ❌ No client-side governance logic

See [RFC-003 Observability & Audit UI](../docs/RFC-003-observability-ui.md) and [UI Build Plan](../docs/UI-BUILD-PLAN-v1.0-nuxt-tailwind.md).

## 🏗️ Stack

- **Framework:** Nuxt 3 (Vue 3 Composition API)
- **Styling:** Tailwind CSS
- **State:** URL params + component local state only
- **API:** Read-only composables (GET only)

## 📁 Project Structure

```
ui/
├── app.vue                          # Root layout
├── pages/
│   ├── index.vue                    # Decision list
│   └── decisions/[decisionId].vue   # Timeline view
├── components/
│   ├── DecisionTable.vue            # Read-only table
│   ├── DecisionFilters.vue          # Filter controls
│   ├── TimelineEntry.vue            # Timeline node
│   ├── VerdictBadge.vue             # Verdict indicator
│   ├── VerdictExplanation.vue       # Verdict details
│   └── JsonViewer.vue               # JSON display
├── composables/
│   └── useMandateApi.ts             # API layer (GET only)
├── types/
│   └── mandate.ts                   # Response types
└── assets/
    └── styles.css                   # Tailwind + utilities
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
cd ui
pnpm install
```

### Environment

Create `.env.local`:
```env
NUXT_PUBLIC_API_BASE=http://localhost:3000/api/v1
```

### Development

```bash
pnpm dev
```

Open http://localhost:3000

### Build

```bash
pnpm build
pnpm preview
```

## 📖 Pages

### Decision List (`/`)

Lists all decisions with filters:
- Time range
- Verdict (ALLOW, PAUSE, BLOCK, OBSERVE)
- Intent
- Agent/Service
- Organization/Domain

Click a row to view the decision timeline.

### Decision Timeline (`/decisions/:decisionId`)

Shows the complete lifecycle:
- **Header:** Decision summary
- **Timeline:** Chronological entries (append-only)
- **Explanation:** Verdict details and policy matches

## 🧩 Components

All components are **read-only presentation** components:

- **DecisionTable:** Pure display, emits selection events
- **TimelineEntry:** Expandable timeline node, displays JSON
- **VerdictExplanation:** Shows explanation details (no recompute)
- **JsonViewer:** Read-only JSON renderer

## 🔌 API Composable

`useMandateApi.ts` provides:

```typescript
// Fetch decisions with optional filters
const { data, loading, error } = await fetchDecisions({
  timeRange: { start: '2024-01-01T00:00:00Z', end: '2024-12-31T23:59:59Z' },
  verdict: 'ALLOW',
  intent: 'create_user',
  agent: 'auth-service',
  organizationId: 'org-123',
  domain: 'api.example.com'
})

// Fetch full decision timeline
const { data, loading, error } = await fetchDecisionTimeline('decision-id-123')
```

**Constraint:** GET requests only. No mutations.

## 🎨 Styling

Tailwind CSS with custom audit utilities:

- `.audit-text-mono` — Monospace text for IDs
- `.audit-badge` — Inline status badges
- `.audit-panel` — Card container
- `.audit-section` — Grouped content
- `.verdict-{allow|pause|block|observe}` — Verdict colors

Verdict colors:
- **ALLOW** → Green
- **PAUSE** → Amber
- **BLOCK** → Red
- **OBSERVE** → Gray

## ✅ Drift Detection

Before merging any changes, ask:
- [ ] Does this mutate state? (Must be NO)
- [ ] Does this enforce or override? (Must be NO)
- [ ] Does this recompute governance logic? (Must be NO)
- [ ] Is this explanation-only? (Must be YES)

## 📝 Development Rules

When generating code:
1. No speculative features
2. One component at a time
3. If unsure, render raw data instead of interpreting
4. Never add action buttons or overrides
5. Always preserve audit trail accuracy

## 🔍 Testing

### Manual Testing

1. Load a known decision ID
2. Verify full timeline visibility
3. Verify verdict explanation accuracy
4. Check that all JSON details are expandable

### Automated Testing (Optional)

```bash
pnpm test
```

Snapshot tests for rendering (no logic tests needed).

## 📚 Related Documentation

- [RFC-001: Mandate AI Control Plane](../docs/RFC-001-mandate-control-plane.md)
- [RFC-003: Observability & Audit UI](../docs/RFC-003-observability-ui.md)
- [UI Build Plan v1.0](../docs/UI-BUILD-PLAN-v1.0-nuxt-tailwind.md)

## ⚖️ License

Part of Mandate AI Control Plane. See root LICENSE.
