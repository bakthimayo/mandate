/**
 * Mandate UI - Read-only Type Definitions
 * RFC-003: These types represent persisted API responses only.
 * No client-side mutations or transformations.
 */

export type Verdict = "ALLOW" | "PAUSE" | "BLOCK" | "OBSERVE";
export type DecisionStage = "INITIATED" | "EVALUATED" | "RESOLVED";
export type EventSource = "control_plane" | "agent" | "human";

export interface DecisionEvent {
  id: string;
  timestamp: string;
  organization_id: string;
  domain_name: string;
  intent: string;
  stage: DecisionStage;
  spec_id: string;
  context: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface PolicyCondition {
  signal: string;
  operator: string;
  value: unknown;
}

export interface PolicyDefinition {
  id: string;
  verdict: Verdict;
  conditions: PolicyCondition[];
  explanation?: string;
}

export interface SignalDefinition {
  name: string;
  type: string;
  source: string;
  required: boolean;
  description: string;
  values?: string[];
}

export interface SpecDefinition {
  spec_id: string;
  intent: string;
  stage: DecisionStage;
  version: string;
  domain_name: string;
  allowed_verdicts: string | Verdict[];
  signals?: SignalDefinition[];
  signals_declared?: Record<string, string>;
}

export interface ScopeContext {
  scope_id: string;
  domain_name: string;
  service?: string;
  agent?: string;
  environment?: string;
  matching_criteria?: Record<string, unknown>;
}

export interface VerdictEvent {
  id: string;
  decision_id: string;
  timestamp: string;
  verdict: Verdict;
  spec_id: string;
  spec_version: number;
  snapshot_id: string;
  scope_id: string;
  domain_name: string;
  organization_id: string;
  matched_scope: ScopeContext;
  matched_policies: PolicyDefinition[];
  matched_policy_ids: string[];
  explanation: string;
  precedence_order: number;
  authority_source: "system" | "human";
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  source: EventSource;
  authority_level: string;
  summary: string;
  type: "decision" | "verdict" | "audit";
  details: Record<string, unknown>;
}

export interface DecisionTimeline {
  decision_id: string;
  decision_event: DecisionEvent;
  timeline: TimelineEntry[];
  verdict: VerdictEvent | null;
}

export interface DecisionListItem {
  id: string;
  timestamp: string;
  intent: string;
  stage: DecisionStage;
  verdict: Verdict;
  agent: string;
  target: string;
  spec_id: string;
  policy_snapshot_id: string;
  organization_id: string;
  domain_name: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
