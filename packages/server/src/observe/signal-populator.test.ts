/**
 * Signal Population Tests
 *
 * @see RFC-002 Section 7
 */

import { describe, it, expect } from 'vitest';
import { populateSignals, mergeSignalsIntoDecision } from './signal-populator.js';
import type { DecisionEvent, SignalDefinition } from '@mandate/shared';

describe('Signal Population - Deterministic Extraction', () => {
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

  it('should extract numeric values from unstructured text', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'amount',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'The transaction amount: 5000.50 USD';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('amount');
    expect(result.amount).toBe(5000.5);
  });

  it('should extract enum values from unstructured text', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'priority',
        type: 'enum',
        values: ['critical', 'high', 'medium', 'low'],
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'This is a critical transaction that requires immediate attention.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('priority');
    expect(result.priority).toBe('critical');
  });

  it('should extract boolean values from unstructured text', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'requires_approval',
        type: 'boolean',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'This transfer requires approval from a manager.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('requires_approval');
    expect(result.requires_approval).toBe(true);
  });

  it('should extract string qualifiers from unstructured text', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'risk_level',
        type: 'string',
        values: ['low', 'medium', 'high'],
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'Risk assessment shows this is a high risk transaction.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('risk_level');
    expect(result.risk_level).toBe('high');
  });

  it('should not populate signals with empty unstructured context', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'amount',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const result = await populateSignals(baseDecision, signals, '');

    expect(result).not.toHaveProperty('amount');
  });

  it('should not populate signals not declared in spec', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'declared_signal',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'Amount: 5000, undeclared_signal: 9999';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('declared_signal');
    expect(result).not.toHaveProperty('undeclared_signal');
  });

  it('should pre-populate scope-sourced signals from decision.scope', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'service',
        type: 'string',
        required: false,
        source: 'scope',
      },
    ];

    const decisionWithService: DecisionEvent = {
      ...baseDecision,
      scope: {
        ...baseDecision.scope,
        service: 'payment-service',
      },
    };

    const result = await populateSignals(decisionWithService, signals, 'some text');

    expect(result).toHaveProperty('service');
    expect(result.service).toBe('payment-service');
  });

  it('should pre-populate timestamp-sourced signals from decision.timestamp', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'timestamp',
        type: 'string',
        required: false,
        source: 'timestamp',
      },
    ];

    const result = await populateSignals(baseDecision, signals, 'some text');

    expect(result).toHaveProperty('timestamp');
    expect(result.timestamp).toBe('2025-01-12T10:00:00Z');
  });

  it('should handle multiple signals simultaneously', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'amount',
        type: 'number',
        required: false,
        source: 'context',
      },
      {
        name: 'priority',
        type: 'enum',
        values: ['critical', 'high', 'medium', 'low'],
        required: false,
        source: 'context',
      },
      {
        name: 'requires_approval',
        type: 'boolean',
        required: false,
        source: 'context',
      },
    ];

    const unstructured =
      'Transfer amount: 10000 USD with critical priority. Requires approval: yes.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('amount');
    expect(result.amount).toBe(10000);
    expect(result).toHaveProperty('priority');
    expect(result.priority).toBe('critical');
    expect(result).toHaveProperty('requires_approval');
    expect(result.requires_approval).toBe(true);
  });

  it('should not extract if signal is not in unstructured text', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'amount',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'No numeric values in this text.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).not.toHaveProperty('amount');
  });

  it('should handle case-insensitive enum matching', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'status',
        type: 'enum',
        values: ['approved', 'rejected', 'pending'],
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'The request has been APPROVED by management.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('status');
    expect(result.status).toBe('approved');
  });
});

describe('Signal Population - Merge Into Decision', () => {
  const baseDecision: DecisionEvent = {
    decision_id: 'test-decision-1',
    organization_id: 'org-123',
    domain_name: 'finance',
    intent: 'transfer_funds',
    stage: 'proposed',
    actor: 'agent-001',
    target: 'account-456',
    context: {
      existing_field: 'existing_value',
    },
    scope: {
      organization_id: 'org-123',
      domain_name: 'finance',
    },
    timestamp: '2025-01-12T10:00:00Z',
  };

  it('should merge populated signals into decision context', () => {
    const populatedSignals = {
      amount: 5000,
      priority: 'critical',
    };

    const merged = mergeSignalsIntoDecision(baseDecision, populatedSignals);

    expect(merged.context).toHaveProperty('existing_field');
    expect(merged.context.existing_field).toBe('existing_value');
    expect(merged.context).toHaveProperty('amount');
    expect(merged.context.amount).toBe(5000);
    expect(merged.context).toHaveProperty('priority');
    expect(merged.context.priority).toBe('critical');
  });

  it('should not modify original decision', () => {
    const originalContext = { ...baseDecision.context };
    const populatedSignals = {
      amount: 5000,
    };

    mergeSignalsIntoDecision(baseDecision, populatedSignals);

    expect(baseDecision.context).toEqual(originalContext);
    expect(baseDecision.context).not.toHaveProperty('amount');
  });

  it('should overwrite existing context fields', () => {
    const decisionWithContext: DecisionEvent = {
      ...baseDecision,
      context: {
        amount: 100, // existing value
      },
    };

    const populatedSignals = {
      amount: 5000, // new value
    };

    const merged = mergeSignalsIntoDecision(decisionWithContext, populatedSignals);

    expect(merged.context.amount).toBe(5000);
  });
});

describe('Signal Population - Edge Cases', () => {
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

  it('should handle zero values correctly', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'count',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'The count is 0.';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('count');
    expect(result.count).toBe(0);
  });

  it('should handle negative values correctly', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'amount',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'Amount: -5000';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).not.toHaveProperty('amount'); // Negative not in pattern
  });

  it('should handle decimal values', async () => {
    const signals: SignalDefinition[] = [
      {
        name: 'rate',
        type: 'number',
        required: false,
        source: 'context',
      },
    ];

    const unstructured = 'Interest rate: 2.5%';

    const result = await populateSignals(baseDecision, signals, unstructured);

    expect(result).toHaveProperty('rate');
    expect(result.rate).toBe(2.5);
  });

  it('should return empty object if no signals declared', async () => {
    const result = await populateSignals(baseDecision, [], 'any text');

    expect(result).toEqual({});
  });
});
