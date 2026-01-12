/**
 * Isolation Context - RFC-002 Governance Boundaries
 *
 * All data consumers MUST use IsolationContext to ensure:
 * - organization_id and domain_name are hard isolation boundaries
 * - No implicit cross-domain aggregation or filtering
 * - Domain context is preserved in all queries and exports
 *
 * @see RFC-002 Section 3.2, Section 8, Section 9
 */

/**
 * Required context for all data access operations.
 * Enforces RFC-002 isolation boundaries.
 * RFC-002: domain_name is TEXT slug (human-readable), not UUID.
 */
export interface IsolationContext {
  readonly organization_id: string;
  readonly domain_name: string;
}

/**
 * Validates that an IsolationContext is complete.
 * Throws if organization_id or domain_name is missing.
 *
 * @param ctx - The isolation context to validate
 * @throws Error if context is incomplete
 */
export function validateIsolationContext(ctx: IsolationContext): void {
  if (!ctx.organization_id) {
    throw new Error('RFC-002 violation: organization_id is required for data access');
  }
  if (!ctx.domain_name) {
    throw new Error('RFC-002 violation: domain_name is required for data access');
  }
}

/**
 * Creates a validated IsolationContext.
 * Use this to ensure context is valid before passing to repositories.
 *
 * @param organization_id - The organization UUID
 * @param domain_name - The domain name (text slug, e.g., "config-management")
 * @returns Validated IsolationContext
 * @throws Error if either parameter is missing
 */
export function createIsolationContext(
  organization_id: string,
  domain_name: string
): IsolationContext {
  const ctx: IsolationContext = { organization_id, domain_name };
  validateIsolationContext(ctx);
  return ctx;
}
