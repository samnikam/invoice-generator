import {
  collectFieldError,
  hasErrors,
  type CalculatorOutcome,
  type FieldErrors,
} from "@/lib/calculators/outcome";
import { applyDiscount, type Discount } from "@/lib/money/discount";
import { parseRupees, type Paise } from "@/lib/money/paise";
import { parsePercent } from "@/lib/money/percent";

/**
 * DISCOUNT CALCULATOR
 * Uses the same discount rules as invoice line items (discount.ts): a percentage is
 * rounded half up to the nearest paisa, and a discount can never exceed the price.
 */
export type DiscountKind = "percent" | "amount";
export type DiscountField = "price" | "value";

export type DiscountInput = { price: string; kind: DiscountKind; value: string };

export type DiscountResult = {
  originalPaise: Paise;
  discountPaise: Paise;
  finalPaise: Paise;
  discount: Discount;
};

export function runDiscountCalculator(
  input: DiscountInput,
): CalculatorOutcome<DiscountField, DiscountResult> {
  const errors: FieldErrors<DiscountField> = {};

  const originalPaise = collectFieldError(errors, "price", () =>
    parseRupees(input.price, "price", "Original price"),
  );
  const discount = collectFieldError<DiscountField, Discount>(errors, "value", () =>
    input.kind === "percent"
      ? { kind: "percent", basisPoints: parsePercent(input.value, "value", "Discount percentage") }
      : { kind: "amount", paise: parseRupees(input.value, "value", "Discount amount") },
  );

  if (hasErrors(errors) || originalPaise === undefined || discount === undefined) {
    return { ok: false, errors };
  }

  const applied = collectFieldError(errors, "value", () =>
    applyDiscount(originalPaise, discount, "value"),
  );
  if (!applied) return { ok: false, errors };

  return {
    ok: true,
    result: {
      originalPaise,
      discountPaise: applied.discountPaise,
      finalPaise: applied.afterDiscountPaise,
      discount,
    },
  };
}
