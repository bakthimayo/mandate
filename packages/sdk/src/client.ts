/**
 * Mandate SDK Client - RFC-002 Compliant
 *
 * The SDK is a thin client that:
 * - Accepts organization_id and domain from the caller (required)
 * - Forwards them to the server without modification
 * - Does NOT infer, default, or enforce policy logic
 */

import type {
  DecisionEvent,
  VerdictEvent,
  TimelineEntry,
  Scope,
} from '@mandate/shared';

export interface MandateClientConfig {
  baseUrl: string;
  apiKey?: string;
}

/**
 * Input for requesting a decision.
 * RFC-002: organization_id and scope.domain are required.
 */
export interface RequestDecisionInput {
  organization_id: string;
  intent: string;
  stage: 'proposed' | 'pre_commit' | 'executed';
  actor: string;
  target: string;
  context?: Record<string, unknown>;
  scope: {
    domain: string;
    service?: string;
    agent?: string;
    system?: string;
    environment?: string;
  };
}

export interface RequestDecisionResponse {
  decision: DecisionEvent;
  verdict: VerdictEvent;
}

export interface ReportOutcomeInput {
  decision_id: string;
  success: boolean;
  details?: Record<string, unknown>;
}

export class MandateClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: MandateClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      this.headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
  }

  async requestDecision(
    input: RequestDecisionInput
  ): Promise<RequestDecisionResponse> {
    const { randomUUID } = await import('node:crypto');
    const body: Record<string, unknown> = {
      decision_id: randomUUID(),
      organization_id: input.organization_id,
      intent: input.intent,
      stage: input.stage,
      actor: input.actor,
      target: input.target,
      context: input.context ?? {},
      scope: {
        organization_id: input.organization_id,
        domain: input.scope.domain,
        service: input.scope.service,
        agent: input.scope.agent,
        system: input.scope.system,
        environment: input.scope.environment,
      },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(`${this.baseUrl}/api/v1/decisions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Request failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<RequestDecisionResponse>;
  }

  async reportOutcome(input: ReportOutcomeInput): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/decisions/${input.decision_id}/outcome`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          success: input.success,
          details: input.details ?? {},
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Report outcome failed: ${response.status} ${error}`);
    }
  }

  async getDecision(decisionId: string): Promise<DecisionEvent> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/decisions/${decisionId}`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get decision failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<DecisionEvent>;
  }

  async getVerdict(decisionId: string): Promise<VerdictEvent> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/decisions/${decisionId}/verdict`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get verdict failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<VerdictEvent>;
  }

  async getTimeline(decisionId: string): Promise<readonly TimelineEntry[]> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/decisions/${decisionId}/timeline`,
      {
        method: 'GET',
        headers: this.headers,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Get timeline failed: ${response.status} ${error}`);
    }

    return response.json() as Promise<readonly TimelineEntry[]>;
  }
}
