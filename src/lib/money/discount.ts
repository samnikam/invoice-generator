import { InvalidInputError } from "@/lib/errors";
import { asPaise, type Paise } from "@/lib/money/paise";
import { asBasisPoints, ONE_HUNDRED_PERCENT, type BasisPoints } from "@/lib/money/percent";
import { mulDivRoundHalfUp } from "@/lib/money/rounding";

/**
 * SMARTBILL DISCOUNT POLICY
 * ─────────────────────────
 * - Discounts are trade discounts shown on the document, applied per line item.
 * - They are applied BEFORE GST: tax is calculated on the value after discount
 *   (the "taxable value"). Every function in SmartBill follows this rule.
 * - A percentage discount is rounded half up to the nearest paisa.
 * - A discount can never exceed the line's value, so taxable value is never negative.
 * - Invoice-level (whole-document) discounts are not supported yet.
 *
 * Whether a particular discount may legally reduce the taxable value depends on GST
 * rules (e.g. it must be known at or before the time of supply and recorded on the
 * invoice). SmartBill does not decide that for the user.
 */
export type Discount =
  | { kind: "none" }
  | { kind: "percent"; basisPoints: BasisPoints }
  | { kind: "amount"; paise: Paise };

export const NO_DISCOUNT: Discount = { kind: "none" };

/** Returns the discount in paise for a line worth `amountPaise`. */
export function calculateDiscount(
  amountPaise: Paise,
  discount: Discount,
  field = "discount",
): Paise {
  const amount = asPaise(amountPaise, field);

  switch (discount.kind) {
    case "none":
      return 0 as Paise;

    case "percent": {
      const rate = asBasisPoints(discount.basisPoints, field, "Discount percentage");
      return Number(
        mulDivRoundHalfUp(BigInt(amount), BigInt(rate), BigInt(ONE_HUNDRED_PERCENT)),
      ) as Paise;
    }

    case "amount": {
      const fixed = asPaise(discount.paise, field, "Discount");
      if (fixed > amount) {
        throw new InvalidInputError(
          "discount_exceeds_amount",
          "Discount cannot be more than the item's value.",
          field,
        );
      }
      return fixed;
    }
  }
}

/** Applies a discount and returns both the discount and the remaining (taxable) value. */
export function applyDiscount(
  amountPaise: Paise,
  discount: Discount,
  field = "discount",
): { discountPaise: Paise; afterDiscountPaise: Paise } {
  const discountPaise = calculateDiscount(amountPaise, discount, field);
  return {
    discountPaise,
    afterDiscountPaise: (amountPaise - discountPaise) as Paise,
  };
}
