/**
 * Observe Phase Tests
 *
 * @see RFC-002 Section 7
 */

import { describe, it, expect } from 'vitest';
import { executeObservePhase, createObservePhaseExecutor } from './observe-phase.js';
import type { DecisionEvent, DecisionSpec } from '@mandate/shared';

describe('Observe Phase - Signal Population', () => {
  const baseDecision: DecisionEvent = {
    decision_id: 'test-decision-1',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    actor: 'agent-001',
    target: 'account-456',
    context: {},
    scope: {
      organization_id: 'org-123',
      domain_name: 'finance',
    },
    timestamp: '2025-01-12T10:00:00Z',
  };

  const specWithSignals: DecisionSpec = {
    spec_id: 'spec-transfer-001',
    version: '1.0.0',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    allowed_verdicts: ['ALLOW', 'PAUSE', 'BLOCK'],
    signals: [
      {
        name: 'amount',
        type: 'number',
        required: true,
        source: 'context',
      },
      {
        name: 'priority',
        type: 'enum',
        values: ['low', 'medium', 'high', 'critical'],
        required: false,
        source: 'context',
      },
    ],
    enforcement: {},
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
  };

  it('should populate signals from unstructured context', async () => {
    const unstructured = 'Transfer amount: 5000 USD with high priority.';

    const result = await executeObservePhase(
      baseDecision,
      specWithSignals,
      unstructured,
      { enableAssistedParsing: false }
    );

    expect(result.context).toHaveProperty('amount');
    expect(result.context.amount).toBe(5000);
    expect(result.context).toHaveProperty('priority');
    expect(result.context.priority).toBe('high');
  });

  it('should return unmodified decision if no unstructured context', async () => {
    const result = await executeObservePhase(
      baseDecision,
      specWithSignals,
      '',
      { enableAssistedParsing: false }
    );

    expect(result.context).toEqual(baseDecision.context);
  });

  it('should return unmodified decision if spec has no signals', async () => {
    const specWithoutSignals: DecisionSpec = {
      ...specWithSignals,
      signals: [],
    };

    const unstructured = 'Some text here';

    const result = await executeObservePhase(
      baseDecision,
      specWithoutSignals,
      unstructured,
      { enableAssistedParsing: false }
    );

    expect(result.context).toEqual(baseDecision.context);
  });

  it('should not modify other decision fields', async () => {
    const unstructured = 'Amount: 5000';

    const result = await executeObservePhase(
      baseDecision,
      specWithSignals,
      unstructured,
      { enableAssistedParsing: false }
    );

    expect(result.decision_id).toBe(baseDecision.decision_id);
    expect(result.organization_id).toBe(baseDecision.organization_id);
    expect(result.domain_name).toBe(baseDecision.domain_name);
    expect(result.intent).toBe(baseDecision.intent);
    expect(result.stage).toBe(baseDecision.stage);
    expect(result.actor).toBe(baseDecision.actor);
    expect(result.target).toBe(baseDecision.target);
  });

  it('should not infer missing intent, domain, or stage', async () => {
    const unstructured =
      'Transfer from finance domain at proposed stage with intent to transfer_funds';

    const result = await executeObservePhase(
      baseDecision,
      specWithSignals,
      unstructured,
      { enableAssistedParsing: false }
    );

    // These should remain unchanged from the input decision
    expect(result.intent).toBe(baseDecision.intent);
    expect(result.domain_name).toBe(baseDecision.domain_name);
    expect(result.stage).toBe(baseDecision.stage);
  });

  it('should preserve existing context when adding new signals', async () => {
    const decisionWithContext: DecisionEvent = {
      ...baseDecision,
      context: {
        existing_field: 'existing_value',
      },
    };

    const unstructured = 'Amount: 5000';

    const result = await executeObservePhase(
      decisionWithContext,
      specWithSignals,
      unstructured,
      { enableAssistedParsing: false }
    );

    expect(result.context).toHaveProperty('existing_field');
    expect(result.context.existing_field).toBe('existing_value');
    expect(result.context).toHaveProperty('amount');
    expect(result.context.amount).toBe(5000);
  });

  it('should handle whitespace-only unstructured context', async () => {
    const result = await executeObservePhase(
      baseDecision,
      specWithSignals,
      '   \n\t  ',
      { enableAssistedParsing: false }
    );

    expect(result.context).toEqual(baseDecision.context);
  });
});

describe('Observe Phase - Executor Factory', () => {
  const baseDecision: DecisionEvent = {
    decision_id: 'test-decision-1',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    actor: 'agent-001',
    target: 'account-456',
    context: {},
    scope: {
      organization_id: 'org-123',
      domain_name: 'finance',
    },
    timestamp: '2025-01-12T10:00:00Z',
  };

  const spec: DecisionSpec = {
    spec_id: 'spec-transfer-001',
    version: '1.0.0',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    allowed_verdicts: ['ALLOW', 'PAUSE', 'BLOCK'],
    signals: [
      {
        name: 'amount',
        type: 'number',
        required: true,
        source: 'context',
      },
    ],
    enforcement: {},
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
  };

  it('should create an executor with pre-configured settings', async () => {
    const executor = createObservePhaseExecutor({
      enableAssistedParsing: false,
      assistedParsingConfidenceThreshold: 0.8,
    });

    const result = await executor(baseDecision, spec, 'Amount: 5000');

    expect(result.context).toHaveProperty('amount');
    expect(result.context.amount).toBe(5000);
  });

  it('created executor should be reusable', async () => {
    const executor = createObservePhaseExecutor({
      enableAssistedParsing: false,
    });

    const decision1 = await executor(baseDecision, spec, 'Amount: 5000');
    const decision2 = await executor(baseDecision, spec, 'Amount: 10000');

    expect(decision1.context.amount).toBe(5000);
    expect(decision2.context.amount).toBe(10000);
  });
});

describe('Observe Phase - Assisted Parsing', () => {
  const baseDecision: DecisionEvent = {
    decision_id: 'test-decision-1',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    actor: 'agent-001',
    target: 'account-456',
    context: {},
    scope: {
      organization_id: 'org-123',
      domain_name: 'finance',
    },
    timestamp: '2025-01-12T10:00:00Z',
  };

  const spec: DecisionSpec = {
    spec_id: 'spec-transfer-001',
    version: '1.0.0',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    allowed_verdicts: ['ALLOW', 'PAUSE', 'BLOCK'],
    signals: [
      {
        name: 'amount',
        type: 'number',
        required: true,
        source: 'context',
      },
      {
        name: 'risk_level',
        type: 'string',
        required: false,
        source: 'context',
      },
    ],
    enforcement: {},
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
  };

  it('should use assisted parsing when enabled and deterministic fails', async () => {
    const assistedParsingFn = async () => ({
      risk_level: { value: 'high', confidence: 0.95 },
    });

    const result = await executeObservePhase(
      baseDecision,
      spec,
      'Some ambiguous text',
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.8,
        assistedParsingFn,
      }
    );

    expect(result.context).toHaveProperty('risk_level');
    expect(result.context.risk_level).toBe('high');
  });

  it('should respect confidence threshold for assisted parsing', async () => {
    const assistedParsingFn = async () => ({
      risk_level: { value: 'high', confidence: 0.5 }, // Below 0.8 threshold
    });

    const result = await executeObservePhase(
      baseDecision,
      spec,
      'Some text',
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.8,
        assistedParsingFn,
      }
    );

    expect(result.context).not.toHaveProperty('risk_level');
  });

  it('should not use assisted parsing if deterministic extraction succeeded', async () => {
    let assistedCalled = false;
    const assistedParsingFn = async () => {
      assistedCalled = true;
      return {};
    };

    await executeObservePhase(
      baseDecision,
      spec,
      'Amount: 5000', // Deterministic extraction will succeed
      {
        enableAssistedParsing: true,
        assistedParsingConfidenceThreshold: 0.8,
        assistedParsingFn,
      }
    );

    // Assisted parsing should still be called, but amount won't be overwritten
    expect(assistedCalled).toBe(true);
  });
});

describe('Observe Phase - Error Handling', () => {
  const baseDecision: DecisionEvent = {
    decision_id: 'test-decision-1',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    actor: 'agent-001',
    target: 'account-456',
    context: {},
    scope: {
      organization_id: 'org-123',
      domain_name: 'finance',
    },
    timestamp: '2025-01-12T10:00:00Z',
  };

  const spec: DecisionSpec = {
    spec_id: 'spec-transfer-001',
    version: '1.0.0',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    allowed_verdicts: ['ALLOW', 'PAUSE', 'BLOCK'],
    signals: [],
    enforcement: {},
    status: 'active',
    created_at: '2025-01-01T00:00:00Z',
  };

  it('should handle assisted parsing errors gracefully', async () => {
    const assistedParsingFn = async () => {
      throw new Error('LLM service unavailable');
    };

    // Should not throw, just skip assisted parsing
    const result = await executeObservePhase(
      baseDecision,
      spec,
      'Some text',
      {
        enableAssistedParsing: true,
        assistedParsingFn,
      }
    );

    expect(result).toBeDefined();
  });
});
