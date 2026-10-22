import { InvalidInputError } from "@/lib/errors";

/**
 * Result of running a calculator on raw form text.
 * Either every input was valid and `result` is available, or `errors` maps each
 * problem field to a plain-English message that the form can show next to it.
 */
export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

export type CalculatorOutcome<Field extends string, Result> =
  { ok: true; result: Result } | { ok: false; errors: FieldErrors<Field> };

/**
 * Runs `parse` and returns its value. If it throws InvalidInputError, records the
 * message against `field` and returns undefined so other fields can still be checked.
 * Any other error is a programming bug and is re-thrown.
 */
export function collectFieldError<Field extends string, T>(
  errors: FieldErrors<Field>,
  field: Field,
  parse: () => T,
): T | undefined {
  try {
    return parse();
  } catch (error) {
    if (error instanceof InvalidInputError) {
      errors[field] = error.message;
      return undefined;
    }
    throw error;
  }
}

export function hasErrors<Field extends string>(errors: FieldErrors<Field>): boolean {
  return Object.keys(errors).length > 0;
}
