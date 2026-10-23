import { sumPaise, type Paise } from "@/lib/money/paise";

/**
 * PAYMENT BALANCE
 * Shared by receipts (optional balance) and invoices (amount received / balance due).
 * Totals use sumPaise (which enforces the supported maximum) and plain integer
 * subtraction, which is exact for whole numbers in this range. Nothing is rounded.
 * An overpayment is reported as "overpaid" with the excess, never hidden.
 */
export type PaymentBalance = {
  documentTotalPaise: Paise;
  previouslyPaidPaise: Paise;
  thisPaymentPaise: Paise;
  totalPaidPaise: Paise;
  outcome: "balance-due" | "paid-in-full" | "overpaid";
  /** Still to be paid (0 unless outcome is "balance-due"). */
  balanceDuePaise: number;
  /** Received beyond the total (0 unless outcome is "overpaid"). */
  excessPaise: number;
};

/** Works out the remaining balance. All inputs are validated, non-negative whole paise. */
export function calculateBalance(
  documentTotalPaise: Paise,
  previouslyPaidPaise: Paise,
  thisPaymentPaise: Paise,
): PaymentBalance {
  const totalPaidPaise = sumPaise([previouslyPaidPaise, thisPaymentPaise], "amount", "Total paid");
  const difference = documentTotalPaise - totalPaidPaise; // exact: whole numbers
  return {
    documentTotalPaise,
    previouslyPaidPaise,
    thisPaymentPaise,
    totalPaidPaise,
    outcome: difference > 0 ? "balance-due" : difference === 0 ? "paid-in-full" : "overpaid",
    balanceDuePaise: Math.max(difference, 0),
    excessPaise: Math.max(-difference, 0),
  };
}
