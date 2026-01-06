/**
 * Mandate UI - Read-only Type Definitions
 * RFC-003: These types represent persisted API responses only.
 * No client-side mutations or transformations.
 */

export type Verdict = 'ALLOW' | 'PAUSE' | 'BLOCK' | 'OBSERVE'
export type DecisionStage = 'INITIATED' | 'EVALUATED' | 'RESOLVED'
export type EventSource = 'control_plane' | 'agent' | 'human'

export interface DecisionEvent {
  id: string
  timestamp: string
  organization_id: string
  domain: string
  intent: string
  stage: DecisionStage
  context: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface VerdictEvent {
  id: string
  decision_id: string
  timestamp: string
  verdict: Verdict
  policy_snapshot_id: string
  matched_scopes: string[]
  matched_policies: string[]
  explanation: string
  precedence_order: number
}

export interface TimelineEntry {
  id: string
  timestamp: string
  source: EventSource
  authority_level: string
  summary: string
  type: 'decision' | 'verdict' | 'audit'
  details: Record<string, unknown>
}

export interface DecisionTimeline {
  decision_id: string
  decision_event: DecisionEvent
  timeline: TimelineEntry[]
  verdict: VerdictEvent | null
}

export interface DecisionListItem {
  id: string
  timestamp: string
  intent: string
  stage: DecisionStage
  verdict: Verdict
  agent: string
  target: string
  policy_snapshot_id: string
  organization_id: string
  domain: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}
