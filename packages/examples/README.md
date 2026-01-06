# Mandate Example Agents

This package contains example agents demonstrating proper integration with the Mandate AI Control Plane.

## Core Principles

All examples follow these critical rules:

1. **Never bypass verdicts** - Agents MUST respect the verdict returned by Mandate
2. **No enforcement assumptions** - Mandate expresses governance intent; agents decide how to respond
3. **No shortcuts** - Every action must go through the decision/verdict/outcome cycle

## Examples

### 1. Pre-Commit Agent (`pre-commit-agent.ts`)

Demonstrates requesting a decision BEFORE performing an action.

- Uses `pre_commit` stage
- Respects all four verdict types (ALLOW, BLOCK, PAUSE, OBSERVE)
- Reports outcome after action completion

```bash
pnpm run pre-commit-agent
```

### 2. Observe-Only Agent (`observe-agent.ts`)

Demonstrates using Mandate purely for audit/observability.

- Uses `executed` stage (reports after action)
- Creates audit trail for compliance
- Still respects verdict signals

```bash
pnpm run observe-agent
```

### 3. Pause Escalation Agent (`pause-escalation-agent.ts`)

Demonstrates proper handling of PAUSE verdicts requiring human approval.

- Recognizes PAUSE as "stop and wait"
- Polls for verdict resolution
- Never times out to proceed anyway
- Respects final verdict after escalation

```bash
pnpm run pause-escalation-agent
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MANDATE_URL` | Mandate server URL | `http://localhost:3000` |
| `MANDATE_API_KEY` | API key for authentication | (none) |

## Building

```bash
pnpm install
pnpm run build
```
