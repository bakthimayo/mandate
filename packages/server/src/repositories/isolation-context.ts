/**
 * Isolation Context - RFC-002 Governance Boundaries
 *
 * All data consumers MUST use IsolationContext to ensure:
 * - organization_id and domain_id are hard isolation boundaries
 * - No implicit cross-domain aggregation or filtering
 * - Domain context is preserved in all queries and exports
 *
 * @see RFC-002 Section 8, Section 9
 */

/**
 * Required context for all data access operations.
 * Enforces RFC-002 isolation boundaries.
 */
export interface IsolationContext {
  readonly organization_id: string;
  readonly domain_id: string;
}

/**
 * Validates that an IsolationContext is complete.
 * Throws if organization_id or domain_id is missing.
 *
 * @param ctx - The isolation context to validate
 * @throws Error if context is incomplete
 */
export function validateIsolationContext(ctx: IsolationContext): void {
  if (!ctx.organization_id) {
    throw new Error('RFC-002 violation: organization_id is required for data access');
  }
  if (!ctx.domain_id) {
    throw new Error('RFC-002 violation: domain_id is required for data access');
  }
}

/**
 * Creates a validated IsolationContext.
 * Use this to ensure context is valid before passing to repositories.
 *
 * @param organization_id - The organization UUID
 * @param domain_id - The domain UUID
 * @returns Validated IsolationContext
 * @throws Error if either parameter is missing
 */
export function createIsolationContext(
  organization_id: string,
  domain_id: string
): IsolationContext {
  const ctx: IsolationContext = { organization_id, domain_id };
  validateIsolationContext(ctx);
  return ctx;
}
