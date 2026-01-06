import type {
  DecisionEvent,
  VerdictEvent,
  TimelineEntry,
  Verdict,
} from '@mandate/shared';

export interface MandateClientConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface RequestDecisionInput {
  intent: string;
  stage: 'proposed' | 'pre_commit' | 'executed';
  actor: string;
  target: string;
  context?: Record<string, unknown>;
  scope?: {
    org_id: string;
    project_id?: string;
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
    const response = await fetch(`${this.baseUrl}/api/v1/decisions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        intent: input.intent,
        stage: input.stage,
        actor: input.actor,
        target: input.target,
        context: input.context ?? {},
        scope: input.scope ?? { org_id: 'default' },
      }),
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
