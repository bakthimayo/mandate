import { DecisionEventSchema } from '@mandate/shared';
import type { ZodError } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[] | null;
}

export function validateDecisionEventRequest(data: unknown): ValidationResult {
  const result = DecisionEventSchema.safeParse(data);
  if (result.success) {
    return { valid: true, errors: null };
  }
  const errors = result.error.errors.map(
    (e: ZodError['errors'][number]) => `${e.path.join('.')} ${e.message}`
  );
  return { valid: false, errors };
}
