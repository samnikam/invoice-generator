import {
  collectFieldError,
  hasErrors,
  type CalculatorOutcome,
  type FieldErrors,
} from "@/lib/calculators/outcome";
import { amountInWords } from "@/lib/money/amount-in-words";
import { parseRupees, type Paise } from "@/lib/money/paise";

/**
 * AMOUNT TO WORDS
 * Accepts ₹0.00 to ₹9,99,99,99,99,999.99 with up to 2 decimal places (paise), using the
 * same parser and wording as invoices.
 */
export type AmountWordsField = "amount";

export function runAmountWords(input: {
  amount: string;
}): CalculatorOutcome<AmountWordsField, { amountPaise: Paise; words: string }> {
  const errors: FieldErrors<AmountWordsField> = {};
  const amountPaise = collectFieldError(errors, "amount", () =>
    parseRupees(input.amount, "amount", "Amount"),
  );
  if (hasErrors(errors) || amountPaise === undefined) return { ok: false, errors };
  return { ok: true, result: { amountPaise, words: amountInWords(amountPaise) } };
}
