import { z } from 'zod';

/**
 * Decision lifecycle stages.
 * @see RFC-001 Section 5.3
 */
export const StageSchema = z.enum(['proposed', 'pre_commit', 'executed']);
export type Stage = z.infer<typeof StageSchema>;

/**
 * Verdict outcomes from policy evaluation.
 * Resolution precedence: BLOCK > PAUSE > ALLOW > OBSERVE
 * @see RFC-001 Section 5.2, Section 10
 */
export const VerdictSchema = z.enum(['ALLOW', 'PAUSE', 'BLOCK', 'OBSERVE']);
export type Verdict = z.infer<typeof VerdictSchema>;

/**
 * Authority level for audit timeline entries.
 * @see RFC-001 Section 12
 */
export const AuthorityLevelSchema = z.enum(['system', 'agent', 'human']);
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;

/**
 * Source of audit timeline entries.
 * @see RFC-001 Section 12
 */
export const SourceSchema = z.enum(['system', 'agent', 'human']);
export type Source = z.infer<typeof SourceSchema>;

/**
 * Scope defines where policies apply.
 * organization_id and domain are required governance boundaries.
 * Other selector fields must match; missing fields act as wildcards.
 * @see RFC-001 Section 8, RFC-002
 */
export const ScopeSchema = z.object({
  organization_id: z.string(),
  domain: z.string(),
  service: z.string().optional(),
  agent: z.string().optional(),
  system: z.string().optional(),
  environment: z.string().optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;

/**
 * A DecisionEvent declares intent to perform an action.
 * Immutable, append-only, contextual (not executable).
 * @see RFC-001 Section 5.1, RFC-002
 */
export const DecisionEventSchema = z.object({
  decision_id: z.string(),
  organization_id: z.string(),
  intent: z.string(),
  stage: StageSchema,
  actor: z.string(),
  target: z.string(),
  context: z.record(z.unknown()),
  scope: ScopeSchema,
  timestamp: z.string().datetime(),
});
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

/**
 * A VerdictEvent is Mandate's authoritative response to a DecisionEvent.
 * Verdicts express governance intent only.
 * @see RFC-001 Section 5.2
 */
export const VerdictEventSchema = z.object({
  verdict_id: z.string(),
  decision_id: z.string(),
  snapshot_id: z.string(),
  verdict: VerdictSchema,
  matched_policy_ids: z.array(z.string()).readonly(),
  timestamp: z.string().datetime(),
});
export type VerdictEvent = z.infer<typeof VerdictEventSchema>;

/**
 * An entry in the append-only audit timeline.
 * Primary compliance artifact.
 * @see RFC-001 Section 12
 */
export const TimelineEntrySchema = z.object({
  entry_id: z.string(),
  decision_id: z.string(),
  intent: z.string(),
  stage: StageSchema,
  actor: z.string(),
  target: z.string(),
  summary: z.string(),
  details: z.record(z.unknown()),
  severity: z.string(),
  source: SourceSchema,
  authority_level: AuthorityLevelSchema,
  timestamp: z.string().datetime(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

/**
 * Policy condition operators.
 * @see BUILD-PLAN Section 6
 */
export const PolicyOperatorSchema = z.enum(['==', '!=', '>', '<', '>=', '<=', 'in']);
export type PolicyOperator = z.infer<typeof PolicyOperatorSchema>;

/**
 * A single condition within a policy.
 * Policies are assertions, not programs.
 * @see RFC-001 Section 9, BUILD-PLAN Section 6
 */
export const PolicyConditionSchema = z.object({
  field: z.string(),
  operator: PolicyOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])).readonly(),
  ]),
});
export type PolicyCondition = z.infer<typeof PolicyConditionSchema>;

/**
 * A policy expressing a governance constraint.
 * Must be single-event, deterministic, stateless, and explainable.
 * @see RFC-001 Section 9, RFC-002
 */
export const PolicySchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  name: z.string(),
  description: z.string(),
  scope: ScopeSchema,
  conditions: z.array(PolicyConditionSchema).readonly(),
  verdict: VerdictSchema,
});
export type Policy = z.infer<typeof PolicySchema>;

/**
 * Immutable policy snapshot.
 * Policies are grouped into immutable snapshots.
 * Snapshots are never edited; historical verdicts are never re-evaluated.
 * @see RFC-001 Section 11
 */
export const PolicySnapshotV1Schema = z.object({
  snapshot_id: z.string(),
  version: z.literal(1),
  created_at: z.string().datetime(),
  policies: z.array(PolicySchema).readonly(),
});
export type PolicySnapshotV1 = z.infer<typeof PolicySnapshotV1Schema>;
