/**
 * Spec Repository - Immutable Decision Spec persistence layer
 * @see RFC-001 Section 5, BUILD-PLAN-v1.2 Section 5
 *
 * Rules:
 * - Specs are immutable once active (R0.4 Append-Only)
 * - No UPDATE or DELETE operations
 * - Spec resolution must be deterministic
 */

import { getPool } from '../db/connection.js';
import { DecisionSpec } from '@mandate/shared';

export class SpecRepository {
  constructor(private pool = getPool()) {}

  /**
   * Resolve active spec by organization, domain, intent, and stage.
   * Returns null if no active spec exists.
   * @see RFC-001 Section 11
   */
  async resolveActiveSpec(
    organizationId: string,
    domain: string,
    intent: string,
    stage: string
  ): Promise<DecisionSpec | null> {
    const result = await this.pool.query(
      `
      SELECT
        spec_id,
        version,
        organization_id,
        domain_name,
        intent,
        stage,
        allowed_verdicts,
        signals,
        enforcement,
        status,
        replaced_by,
        created_at
      FROM mandate.mandate_specs
      WHERE
        organization_id = $1
        AND domain_name = $2
        AND intent = $3
        AND stage = $4
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [organizationId, domain, intent, stage]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSpec(result.rows[0]);
  }

  /**
   * Fetch spec by spec_id and version.
   * Used for audit and replay scenarios.
   * @see RFC-001 Section 14
   */
  async fetchSpec(specId: string, version: string): Promise<DecisionSpec | null> {
    const result = await this.pool.query(
      `
      SELECT
        spec_id,
        version,
        organization_id,
        domain_name,
        intent,
        stage,
        allowed_verdicts,
        signals,
        enforcement,
        status,
        replaced_by,
        created_at
      FROM mandate.mandate_specs
      WHERE spec_id = $1 AND version = $2
      `,
      [specId, version]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToSpec(result.rows[0]);
  }

  /**
   * Insert a new spec.
   * Spec can only be inserted once; subsequent versions require new rows.
   * @see RFC-001 Section 4.2
   */
  async insertSpec(spec: DecisionSpec): Promise<void> {
    // Validation: spec cannot already exist
    const existing = await this.pool.query(
      'SELECT 1 FROM mandate.mandate_specs WHERE spec_id = $1 AND version = $2',
      [spec.spec_id, spec.version]
    );

    if (existing.rows.length > 0) {
      throw new Error(
        `Spec ${spec.spec_id}@${spec.version} already exists (append-only constraint)`
      );
    }

    await this.pool.query(
        `
        INSERT INTO mandate.mandate_specs (
          spec_id,
          version,
          organization_id,
          domain_name,
          intent,
          stage,
          allowed_verdicts,
          signals,
          enforcement,
          status,
          replaced_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          spec.spec_id,
          spec.version,
          spec.organization_id,
          spec.domain_name,
          spec.intent,
          spec.stage,
          spec.allowed_verdicts,
          JSON.stringify(spec.signals),
          JSON.stringify(spec.enforcement),
          spec.status,
          spec.replaced_by ?? null,
          spec.created_at,
        ]
      );
  }

  /**
   * List all specs for an organization (for observability).
   */
  async listSpecsByOrganization(organizationId: string): Promise<DecisionSpec[]> {
    const result = await this.pool.query(
      `
      SELECT
        spec_id,
        version,
        organization_id,
        domain_name,
        intent,
        stage,
        allowed_verdicts,
        signals,
        enforcement,
        status,
        replaced_by,
        created_at
      FROM mandate.mandate_specs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [organizationId]
    );

    return result.rows.map((row) => this.mapRowToSpec(row));
  }

  private mapRowToSpec(row: any): DecisionSpec {
    return {
      spec_id: row.spec_id,
      version: row.version,
      organization_id: row.organization_id,
      domain_name: row.domain_name,
      intent: row.intent,
      stage: row.stage,
      allowed_verdicts: row.allowed_verdicts,
      signals: typeof row.signals === 'string' ? JSON.parse(row.signals) : row.signals,
      enforcement: typeof row.enforcement === 'string' ? JSON.parse(row.enforcement) : row.enforcement,
      status: row.status,
      replaced_by: row.replaced_by,
      created_at: row.created_at,
    };
  }
  }
