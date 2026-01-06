# Mandate Build Plan

## Overview

Build an AI Control Plane MVP using **Node.js + Fastify** with **local PostgreSQL** for storage. The system evaluates DecisionEvents against policies and emits VerdictEvents in observe-only mode.

Includes a **Client SDK** demonstrating how AI agents integrate with the control plane.

---

## Architecture Decision (MVP)

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js + Fastify | Fast iteration, existing expertise |
| Database | Local PostgreSQL | Already installed, no Docker needed |
| Policy Engine | JSON-based rules | Simpler than OPA/Rego for MVP |
| Auth | None (trusted clients) | Simplify MVP scope |
| Structure | Monorepo | Shared types, co-located packages |

---

## Monorepo Structure

```
mandate/
├── packages/
│   ├── server/                    # Control Plane API Server
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── config/
│   │   │   │   └── index.ts       # Environment config (DB, port)
│   │   │   ├── db/
│   │   │   │   ├── connection.ts  # PostgreSQL connection
│   │   │   │   └── repositories/  # Data access layer
│   │   │   │       ├── decision-event.repo.ts
│   │   │   │       ├── verdict-event.repo.ts
│   │   │   │       └── timeline.repo.ts
│   │   │   ├── routes/
│   │   │   │   ├── decision.routes.ts
│   │   │   │   ├── verdict.routes.ts
│   │   │   │   ├── timeline.routes.ts
│   │   │   │   └── health.routes.ts
│   │   │   ├── services/
│   │   │   │   ├── ingestion.service.ts
│   │   │   │   ├── evaluator.service.ts
│   │   │   │   └── timeline.service.ts
│   │   │   └── evaluator/
│   │   │       ├── policy-loader.ts
│   │   │       ├── scope-matcher.ts      # Scope matching logic
│   │   │       ├── condition-evaluator.ts
│   │   │       └── verdict-resolver.ts
│   │   ├── policies/              # Policy snapshot JSON files
│   │   │   └── default.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk/                       # Client SDK for AI Agents
│   │   ├── src/
│   │   │   ├── index.ts           # SDK entry point
│   │   │   ├── client.ts          # HTTP client wrapper
│   │   │   ├── mandate.ts         # Main SDK class
│   │   │   ├── builders/
│   │   │   │   └── decision-event.builder.ts
│   │   │   └── types.ts           # Re-export shared types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/                    # Shared Types & Utilities
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types/
│   │   │   │   ├── decision-event.ts
│   │   │   │   ├── verdict-event.ts
│   │   │   │   ├── timeline.ts
│   │   │   │   ├── policy.ts
│   │   │   │   ├── scope.ts       # Scope model types
│   │   │   │   └── enums.ts       # Stage, Verdict, ActorType, etc.
│   │   │   └── schemas/
│   │   │       ├── decision-event.schema.ts
│   │   │       └── verdict-event.schema.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── examples/                  # Example AI Agent Integrations
│       ├── src/
│       │   ├── invoice-agent.ts   # Example: Invoice approval agent
│       │   ├── payment-agent.ts   # Example: Payment release agent
│       │   └── data-export-agent.ts
│       ├── package.json
│       └── tsconfig.json
│
├── migrations/                    # Database migrations
│   ├── 001_create_decision_events.sql
│   ├── 002_create_verdict_events.sql
│   ├── 003_create_audit_timeline.sql
│   └── 004_create_scopes.sql
│
├── requirements/                  # Requirement documents (existing)
│
├── scripts/
│   ├── migrate.ts                 # Run migrations
│   └── seed-policies.ts           # Load sample policies
│
├── package.json                   # Root package.json (workspaces)
├── pnpm-workspace.yaml            # pnpm workspace config
├── tsconfig.base.json             # Shared TypeScript config
└── README.md
```

---

## Package Dependencies

```
@mandate/shared     ← No dependencies
@mandate/sdk        ← Depends on @mandate/shared
@mandate/server     ← Depends on @mandate/shared
@mandate/examples   ← Depends on @mandate/sdk
```

---

## Client SDK Design

### Purpose

The SDK provides a simple, type-safe way for AI agents to:
1. Declare decisions before executing actions
2. Check verdicts before proceeding
3. Report outcomes after execution

### SDK API Surface

```typescript
// Initialize client
const mandate = new MandateClient({
  baseUrl: 'http://localhost:3000',
  actor: { type: 'ai_agent', id: 'invoice-bot-v2' }
});

// Before irreversible action: request permission
const verdict = await mandate.requestDecision({
  intent: 'approve_invoice',
  stage: 'pre_commit',
  target: { type: 'invoice', id: 'INV-2026-00123' },
  context: {
    numeric: { amount: 125000, confidence: 0.81 },
    categorical: { currency: 'EUR', region: 'EU' }
  },
  evidence: { ocr_used: true, risk_check: 'performed' }
});

// Check verdict
if (verdict.verdict === 'ALLOW') {
  // Proceed with action
  await approveInvoice(invoiceId);
  
  // Report outcome
  await mandate.reportOutcome({
    decisionId: verdict.decision_id,
    stage: 'executed',
    intent: 'approve_invoice'
  });
} else if (verdict.verdict === 'PAUSE') {
  // Escalate to human
  await escalateToHuman(verdict.explanation);
} else if (verdict.verdict === 'BLOCK') {
  // Abort action
  log.warn('Action blocked:', verdict.explanation);
}
```

### SDK Classes & Methods

```typescript
class MandateClient {
  constructor(config: MandateConfig)
  
  // Core methods
  requestDecision(event: DecisionEventInput): Promise<VerdictResponse>
  reportOutcome(outcome: OutcomeInput): Promise<void>
  
  // Query methods
  getDecision(decisionId: string): Promise<DecisionEvent>
  getVerdict(decisionId: string): Promise<VerdictEvent>
  getTimeline(decisionId: string): Promise<TimelineEntry[]>
}

// Builder pattern for complex events
class DecisionEventBuilder {
  setIntent(intent: string): this
  setStage(stage: Stage): this
  setTarget(type: string, id: string): this
  addNumericContext(key: string, value: number): this
  addCategoricalContext(key: string, value: string): this
  addFlag(key: string, value: boolean): this
  addEvidence(key: string, value: any): this
  build(): DecisionEventInput
}
```

### Integration Patterns

#### Pattern 1: Synchronous Check (Blocking)

```typescript
// Agent pauses and waits for verdict before acting
const verdict = await mandate.requestDecision({ ... });
if (verdict.verdict !== 'ALLOW') {
  throw new ActionBlockedError(verdict);
}
await performAction();
```

#### Pattern 2: Observe-Only (Non-Blocking)

```typescript
// Agent logs decision but doesn't wait
mandate.requestDecision({ ...event, stage: 'executed' })
  .catch(err => log.error('Failed to log decision', err));

await performAction(); // Proceeds regardless
```

#### Pattern 3: Two-Phase (Proposed → Pre-Commit)

```typescript
// Phase 1: Check if action is likely to be allowed
const proposed = await mandate.requestDecision({
  intent: 'release_payment',
  stage: 'proposed',
  ...
});

if (proposed.verdict === 'BLOCK') {
  return; // Don't even attempt
}

// Phase 2: Final check before execution
const preCommit = await mandate.requestDecision({
  intent: 'release_payment',
  stage: 'pre_commit',
  decisionId: proposed.decision_id, // Same decision lifecycle
  ...
});

if (preCommit.verdict === 'ALLOW') {
  await releasePayment();
}
```

---

## Phase 1: Project Setup

### Tasks
1. Initialize pnpm workspace monorepo
2. Create root package.json with workspaces
3. Set up shared TypeScript configuration (tsconfig.base.json)
4. Create package scaffolding for: server, sdk, shared, examples
5. Configure ESLint + Prettier at root level
6. Set up local PostgreSQL database connection
   - Database name: `mandate_dev`
   - Create database manually or via script

---

## Phase 2: Shared Package

### Tasks
1. Define TypeScript types for all domain objects:
   - DecisionEvent, VerdictEvent, TimelineEntry
   - Policy, PolicyCondition
   - Scope, ScopeSelector, ScopeDimension
   - Enums: Stage, Verdict, ActorType, Mode, Severity
2. Create JSON Schema definitions for validation
3. Export all types from package entry point

---

## Phase 3: Server - Data Layer

### 3.1 Database Schema

Create migrations for:

1. **decision_events** table
   - id (UUID, PK)
   - decision_id (UUID, indexed)
   - intent (TEXT)
   - stage (TEXT)
   - actor_type, actor_id (TEXT)
   - target_type, target_id (TEXT)
   - context (JSONB)
   - evidence (JSONB)
   - occurred_at (TIMESTAMPTZ)
   - schema_version (TEXT)
   - created_at (TIMESTAMPTZ)

2. **verdict_events** table
   - id (UUID, PK)
   - decision_id (UUID, indexed)
   - intent, stage (TEXT)
   - verdict (TEXT)
   - policy_refs (TEXT[])
   - requirements (JSONB)
   - explanation (TEXT)
   - mode (TEXT)
   - issued_at (TIMESTAMPTZ)
   - expires_at (TIMESTAMPTZ)
   - schema_version (TEXT)
   - created_at (TIMESTAMPTZ)

3. **audit_timeline_entries** table
   - id (UUID, PK)
   - decision_id (UUID, indexed)
   - entry_type (TEXT)
   - intent, stage (TEXT)
   - actor_type, actor_id (TEXT)
   - target_type, target_id (TEXT)
   - summary (TEXT)
   - details (JSONB)
   - severity (TEXT)
   - occurred_at (TIMESTAMPTZ)
   - created_at (TIMESTAMPTZ)

4. **scopes** table
   - id (UUID, PK)
   - scope_id (TEXT, unique, indexed)
   - selector (JSONB) - contains dimension filters
   - description (TEXT)
   - owner_team (TEXT)
   - owner_contact (TEXT)
   - schema_version (TEXT)
   - created_at (TIMESTAMPTZ)

5. **policies** table (optional, for DB-backed policies)
   - id (UUID, PK)
   - policy_id (TEXT, unique)
   - scope_id (TEXT, FK to scopes, indexed)
   - intent (TEXT)
   - stage (TEXT)
   - conditions (JSONB)
   - verdict (TEXT)
   - explanation (TEXT)
   - enabled (BOOLEAN)
   - schema_version (TEXT)
   - created_at (TIMESTAMPTZ)

### 3.2 Data Access Layer

- Create repository pattern for each table
- Implement idempotent insert (ON CONFLICT DO NOTHING)
- Build query helpers for correlation by decision_id

---

## Phase 4: Server - Event Ingestion API

### 4.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/decisions` | Ingest DecisionEvent, return Verdict |
| GET | `/api/v1/decisions/:decision_id` | Get all events for a decision |
| GET | `/api/v1/decisions/:decision_id/verdict` | Get latest verdict |

### 4.2 Implementation Tasks

1. Validate incoming DecisionEvent against JSON schema
2. Store event in database
3. Trigger policy evaluation (sync)
4. Generate and store VerdictEvent
5. Return verdict in response

---

## Phase 5: Server - Policy Evaluator with Scope Matching

### 5.1 Scope Model

Scopes define **where a policy applies** using dimension selectors:

| Dimension     | Description              | Example                |
|---------------|--------------------------|------------------------|
| `domain`      | Business domain          | `logistics`, `finance` |
| `service`     | Executing service        | `invoice-service`      |
| `agent`       | AI agent identifier      | `rfq_agent_v3`         |
| `system`      | External/internal system | `SAP`, `Oracle`        |
| `environment` | Runtime environment      | `prod`, `staging`      |
| `tenant`      | Organization boundary    | `tenant_42`            |

### 5.2 Scope Schema

```json
{
  "scope_id": "scope-logistics-prod",
  "selector": {
    "domain": "logistics",
    "service": "invoice-service",
    "environment": "prod"
  },
  "description": "Production invoice approvals in logistics domain",
  "owner": {
    "team": "finance-ops",
    "contact": "finance-ops@company.com"
  }
}
```

### 5.3 Policy Format (with Scope)

```json
{
  "snapshot_id": "2026-01-06T00:00:00Z",
  "scopes": [
    {
      "scope_id": "scope-logistics-prod",
      "selector": { "domain": "logistics", "environment": "prod" }
    }
  ],
  "policies": [
    {
      "policy_id": "INV-042",
      "scope_id": "scope-logistics-prod",
      "intent": "approve_invoice",
      "stage": "pre_commit",
      "conditions": [
        { "field": "context.numeric.amount", "op": ">", "value": 100000 },
        { "field": "context.categorical.region", "op": "==", "value": "EU" }
      ],
      "verdict": "PAUSE",
      "explanation": "High-value EU invoice requires manual approval"
    },
    {
      "policy_id": "GLOBAL-001",
      "scope_id": null,
      "intent": "export_data",
      "stage": "executed",
      "conditions": [],
      "verdict": "OBSERVE",
      "explanation": "Observe all data exports globally"
    }
  ]
}
```

### 5.4 Scope Matching Semantics

A DecisionEvent **matches a scope** when:
- All fields in `scope.selector` match corresponding fields in event metadata
- Empty selector (`{}`) = global scope, matches all events
- Missing dimensions in selector = wildcard (match any)

**Matching sources from DecisionEvent:**
- `context.metadata.system` → matches `selector.service`
- `context.metadata.tenant` → matches `selector.tenant`
- `actor.id` → matches `selector.agent`
- `context.categorical.domain` → matches `selector.domain`
- `context.metadata.env` → matches `selector.environment`

### 5.5 Evaluation Flow

```
DecisionEvent arrives
    ↓
Extract scope dimensions from event
    ↓
Find all scopes that match
    ↓
Find all policies in matched scopes
    ↓
Filter by intent + stage
    ↓
Evaluate conditions
    ↓
Resolve verdict (BLOCK > PAUSE > ALLOW > OBSERVE)
    ↓
Emit VerdictEvent with all matched policy_refs
```

### 5.6 Evaluator Components

1. **Policy Loader** - Load scopes + policies from JSON file at startup
2. **Scope Matcher** - Match event dimensions against scope selectors
3. **Condition Evaluator** - Evaluate predicates against context
4. **Verdict Resolver** - Apply precedence, collect policy refs from all matched policies

---

## Phase 6: Server - Additional APIs

### Verdict API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/verdicts` | Query verdicts with filters |

### Scope API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/scopes` | List all scopes |
| GET | `/api/v1/scopes/:scope_id` | Get scope by ID |
| GET | `/api/v1/scopes/:scope_id/policies` | Get policies for scope |

### Timeline API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/timeline/:decision_id` | Get timeline for decision |
| GET | `/api/v1/timeline` | Query timelines |

### Health API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/ready` | Database connectivity |

---

## Phase 7: Client SDK

### Tasks
1. Create HTTP client wrapper with error handling
2. Implement MandateClient class with core methods
3. Create DecisionEventBuilder for fluent API
4. Add TypeScript types (re-export from shared)
5. Handle network errors, timeouts, retries
6. Add request/response logging option

---

## Phase 8: Example Agents

### Invoice Approval Agent
- Demonstrates pre_commit check before approving invoice
- Shows handling of PAUSE verdict (escalation)

### Payment Release Agent  
- Demonstrates two-phase pattern (proposed → pre_commit)
- Shows handling of BLOCK verdict

### Data Export Agent
- Demonstrates observe-only pattern
- Logs executed stage after action

---

## Phase 9: Testing

### Unit Tests (per package)
- shared: Type validation, schema tests
- server: Scope matching, policy evaluation, verdict resolution
- sdk: Request building, error handling

### Integration Tests
- Full flow: SDK → Server → Database → Response
- Multiple agents scenario

### Test Scenarios
1. ALLOW verdict → agent proceeds
2. PAUSE verdict → agent escalates
3. BLOCK verdict → agent aborts
4. Network error → SDK handles gracefully
5. Invalid event → 400 error
6. Scoped policy match → only matching scope policies apply
7. Global policy (empty selector) → applies to all events
8. Multiple scope matches → all matching policies evaluated, highest verdict wins

---

## Implementation Order

| Order | Component | Package | Effort |
|-------|-----------|---------|--------|
| 1 | Monorepo setup | root | 0.5 day |
| 2 | Shared types & schemas (incl. Scope) | shared | 0.5 day |
| 3 | Database migrations (incl. scopes table) | server | 0.5 day |
| 4 | Data access layer | server | 0.5 day |
| 5 | Decision ingestion API | server | 1 day |
| 6 | Scope matcher + Policy evaluator | server | 1.5 days |
| 7 | Verdict, Scope & Timeline APIs | server | 0.5 day |
| 8 | Client SDK core | sdk | 1 day |
| 9 | Example agents | examples | 0.5 day |
| 10 | Testing | all | 1 day |
| 11 | Documentation | root | 0.5 day |

**Total: ~8 days**

---

## Configuration

### Environment Variables (Server)

```env
# Database (local PostgreSQL)
DATABASE_URL=postgresql://postgres:password@localhost:5432/mandate_dev

# Server
PORT=3000
NODE_ENV=development

# Policies
POLICY_SNAPSHOT_PATH=./policies/default.json
```

### SDK Configuration

```typescript
{
  baseUrl: string;           // Control plane URL
  actor: Actor;              // Default actor for requests
  timeout?: number;          // Request timeout (ms)
  retries?: number;          // Retry count on failure
  logger?: Logger;           // Optional logger
}
```

---

## Success Criteria

MVP is complete when:

- [ ] Monorepo builds successfully (all packages)
- [ ] Server accepts DecisionEvents via REST API
- [ ] Scope matching correctly filters applicable policies
- [ ] Policy evaluator produces VerdictEvents
- [ ] SDK can request decisions and receive verdicts
- [ ] Example agent demonstrates full integration
- [ ] Timeline shows decision lifecycle
- [ ] All events are append-only and immutable

---

*End of Build Plan*
