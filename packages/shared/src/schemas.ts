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
 * organization_id and domain_name are required governance boundaries.
 * Other selector fields must match; missing fields act as wildcards.
 * @see RFC-001 Section 8, RFC-002
 */
export const ScopeSchema = z.object({
  organization_id: z.string(),
  domain_name: z.string(),
  service: z.string().optional(),
  agent: z.string().optional(),
  system: z.string().optional(),
  environment: z.string().optional(),
});
export type Scope = z.infer<typeof ScopeSchema>;

/**
 * A DecisionEvent declares intent to perform an action.
 * Immutable, append-only, contextual (not executable).
 * MUST resolve to a DecisionSpec and include proper organizational attribution.
 * RFC-002: Must include organization_id and domain_name for scope resolution.
 * @see RFC-001 Section 5.1, RFC-002 Section 9, Section 12
 */
export const DecisionEventSchema = z.object({
  decision_id: z.string(),
  organization_id: z.string(),
  domain_name: z.string(),
  intent: z.string(),
  stage: StageSchema,
  actor: z.string(),
  target: z.string(),
  context: z.record(z.unknown()),
  scope: ScopeSchema,
  timestamp: z.string().datetime(),
  spec_id: z.string().optional(), // Post-resolution: set after spec lookup (RFC-002)
  spec_version: z.string().optional(), // Post-resolution: set after spec lookup (RFC-002)
});
export type DecisionEvent = z.infer<typeof DecisionEventSchema>;

/**
 * A VerdictEvent is Mandate's authoritative response to a DecisionEvent.
 * Verdicts express governance intent only.
 * RFC-002: MUST reference the spec and scope that governed the decision.
 * @see RFC-001 Section 5.2, RFC-002 Section 9, Section 12
 */
export const VerdictEventSchema = z.object({
  verdict_id: z.string(),
  organization_id: z.string(),
  decision_id: z.string(),
  snapshot_id: z.string(),
  verdict: VerdictSchema,
  matched_policy_ids: z.array(z.string()).readonly(),
  timestamp: z.string().datetime(),
  spec_id: z.string(), // REQUIRED: Reference to DecisionSpec (RFC-002)
  spec_version: z.string(), // REQUIRED: Version of DecisionSpec (RFC-002)
  scope_id: z.string().optional(), // REQUIRED: Scope used for evaluation (RFC-002)
  domain_name: z.string(), // REQUIRED: Domain for auditability (RFC-002)
  owning_team: z.string().optional(), // Scope ownership (RFC-002)
});
export type VerdictEvent = z.infer<typeof VerdictEventSchema>;

/**
 * An entry in the append-only audit timeline.
 * Primary compliance artifact.
 * RFC-002: MUST include spec_id and scope_id for complete auditability.
 * @see RFC-001 Section 12, RFC-002 Section 9
 */
export const TimelineEntrySchema = z.object({
  entry_id: z.string(),
  organization_id: z.string(),
  domain_name: z.string(),
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
  spec_id: z.string().optional(), // REQUIRED for evaluated decisions (RFC-002)
  scope_id: z.string().optional(), // REQUIRED for evaluated decisions (RFC-002)
  owning_team: z.string().optional(), // Scope ownership for escalation (RFC-002)
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
 * RFC-002: Every policy MUST be bound to exactly one spec and one scope.
 * @see RFC-001 Section 9, RFC-002 Section 5
 */
export const PolicySchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  domain_name: z.string(),
  name: z.string(),
  description: z.string(),
  scope: ScopeSchema,
  scope_id: z.string(), // REQUIRED: RFC-002 scope binding
  conditions: z.array(PolicyConditionSchema).readonly(),
  verdict: VerdictSchema,
  spec_id: z.string(), // REQUIRED: RFC-002 spec binding
});
export type Policy = z.infer<typeof PolicySchema>;

/**
 * Signal type declarations.
 * Allowed types: enum, boolean, string, number
 * @see RFC-001 Section 6
 */
export const SignalTypeSchema = z.enum(['enum', 'boolean', 'string', 'number']);
export type SignalType = z.infer<typeof SignalTypeSchema>;

/**
 * Signal source: where the signal comes from.
 * @see RFC-001 Section 6.2
 */
export const SignalSourceSchema = z.enum(['scope', 'context', 'timestamp']);
export type SignalSource = z.infer<typeof SignalSourceSchema>;

/**
 * A signal definition declares a typed input that policies are allowed to reference.
 * Policies MAY ONLY reference declared signals.
 * @see RFC-001 Section 6
 */
export const SignalDefinitionSchema = z.object({
  name: z.string(),
  type: SignalTypeSchema,
  values: z.array(z.string()).optional(), // For enum type
  required: z.boolean(),
  source: SignalSourceSchema,
});
export type SignalDefinition = z.infer<typeof SignalDefinitionSchema>;

/**
 * Enforcement semantics define what verdicts mean operationally.
 * @see RFC-001 Section 7
 */
export const EnforcementSemanticsSchema = z.object({
  pause_requires: z.array(z.string()).optional(),
  resolution_timeout_minutes: z.number().optional(),
});
export type EnforcementSemantics = z.infer<typeof EnforcementSemanticsSchema>;

/**
 * Status of a decision spec.
 * @see RFC-001 Section 4.2
 */
export const SpecStatusSchema = z.enum(['draft', 'active', 'deprecated']);
export type SpecStatus = z.infer<typeof SpecStatusSchema>;

/**
 * A DecisionSpec defines the contract for a governed decision.
 * Immutable once active.
 * @see RFC-001 Section 3, Section 4, Section 5
 */
export const DecisionSpecSchema = z.object({
  spec_id: z.string(),
  version: z.string(),
  organization_id: z.string(),
  domain_name: z.string(),
  intent: z.string(),
  stage: StageSchema,
  allowed_verdicts: z.array(VerdictSchema).readonly(),
  signals: z.array(SignalDefinitionSchema).readonly(),
  enforcement: EnforcementSemanticsSchema,
  status: SpecStatusSchema,
  replaced_by: z.string().optional(),
  created_at: z.string().datetime(),
});
export type DecisionSpec = z.infer<typeof DecisionSpecSchema>;

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
