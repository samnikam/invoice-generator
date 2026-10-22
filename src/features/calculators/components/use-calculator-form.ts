"use client";

import { useCallback, useMemo, useState } from "react";

import type { CalculatorOutcome } from "@/lib/calculators/outcome";

/**
 * Shared state for the calculator forms.
 * - Results are recalculated on every change (no "Calculate" button needed).
 * - An error is only shown for a field after the user has interacted with it
 *   (left a text box, or changed a select/radio), so empty forms are not shown in red.
 */
export function useCalculatorForm<
  Values extends Record<string, unknown>,
  Field extends string,
  Result,
>(initialValues: Values, run: (values: Values) => CalculatorOutcome<Field, Result>) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());

  const outcome = useMemo(() => run(values), [run, values]);

  const markTouched = useCallback((field: string) => {
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  }, []);

  const setValue = useCallback(
    <K extends keyof Values>(field: K, value: Values[K], touch = false) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (touch) markTouched(String(field));
    },
    [markTouched],
  );

  const errorFor = useCallback(
    (field: Field): string | undefined =>
      !outcome.ok && touched.has(field) ? outcome.errors[field] : undefined,
    [outcome, touched],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setTouched(new Set());
  }, [initialValues]);

  return { values, setValue, markTouched, outcome, errorFor, reset };
}
