import { describe, expect, it } from "vitest";

import { amountInWords } from "@/lib/money/amount-in-words";
import type { Paise } from "@/lib/money/paise";
import {
  calculateBalance,
  createEmptyReceipt,
  evaluateReceipt,
  paymentMethodInfo,
  type ReceiptValues,
} from "@/lib/receipts/receipt";

const p = (n: number) => n as Paise;

function receipt(overrides: Partial<ReceiptValues> = {}): ReceiptValues {
  return {
    ...createEmptyReceipt(),
    business: { name: "Sample Design Studio", address: "", phone: "", email: "" },
    receiptNumber: "RCPT-2026/001",
    paymentDate: "2026-10-23",
    payer: { name: "Example Retail Pvt Ltd", address: "", phone: "", email: "" },
    amount: "10000",
    method: "upi",
    ...overrides,
  };
}

describe("evaluateReceipt — required fields and amounts", () => {
  it("lists every missing required field for an empty receipt, in order", () => {
    const result = evaluateReceipt(createEmptyReceipt());
    expect(result.issues.map((i) => [i.field, i.message])).toEqual([
      ["business.name", "Business name is required."],
      ["receiptNumber", "Receipt number is required."],
      ["paymentDate", "Payment date is required."],
      ["payer.name", "Payer name is required."],
      ["amount", "Amount received is required."],
      ["method", "Choose how the payment was made."],
    ]);
    expect(result.amountPaise).toBeNull();
  });

  it("accepts a complete receipt with no balance details", () => {
    const result = evaluateReceipt(receipt());
    expect(result.issues).toEqual([]);
    expect(result.amountPaise).toBe(1_000_000);
    expect(result.balance).toBeNull();
  });

  it.each([
    ["0", "Amount received must be more than ₹0."],
    ["0.00", "Amount received must be more than ₹0."],
    ["-500", "Amount received cannot be negative."],
    ["10.555", "Amount received can have at most 2 decimal places."],
    ["1,000", /no commas/],
    ["abc", /must be a number/],
    ["1000000000000", /maximum supported amount/],
  ])("rejects amount %j", (amount, message) => {
    const result = evaluateReceipt(receipt({ amount }));
    expect(result.errors.amount).toMatch(message);
    expect(result.amountPaise).toBeNull();
  });

  it("accepts the smallest valid amount, ₹0.01", () => {
    expect(evaluateReceipt(receipt({ amount: "0.01" })).amountPaise).toBe(1);
  });

  it("validates receipt number, date, contact details and text lengths", () => {
    const result = evaluateReceipt(
      receipt({
        receiptNumber: "RCPT 1",
        paymentDate: "2026-13-01",
        payer: { name: "A", address: "", phone: "abc", email: "x@" },
        reference: "x".repeat(51),
      }),
    );
    expect(result.errors.receiptNumber).toMatch(/letters, numbers/);
    expect(result.errors.paymentDate).toBe("Payment date must be a valid date.");
    expect(result.errors["payer.phone"]).toMatch(/valid phone number/);
    expect(result.errors["payer.email"]).toMatch(/valid email address/);
    expect(result.errors.reference).toBe("Reference must be 50 characters or fewer.");
  });

  it("gives method-specific reference labels", () => {
    expect(paymentMethodInfo("cheque")?.referenceLabel).toBe("Cheque number");
    expect(paymentMethodInfo("upi")?.referenceLabel).toBe("UPI transaction ID");
    expect(paymentMethodInfo("")).toBeUndefined();
  });

  it("amount in words for the receipt uses the shared converter", () => {
    const { amountPaise } = evaluateReceipt(receipt({ amount: "25000.50" }));
    expect(amountInWords(amountPaise ?? 0)).toBe(
      "Rupees Twenty-Five Thousand and Fifty Paise Only",
    );
  });
});

describe("evaluateReceipt — optional balance", () => {
  it("balance due: total ₹25,965, paid earlier ₹10,000, now ₹10,000 → ₹5,965 due", () => {
    const { balance, issues } = evaluateReceipt(
      receipt({ documentTotal: "25965", previouslyPaid: "10000", amount: "10000" }),
    );
    expect(issues).toEqual([]);
    expect(balance).toEqual({
      documentTotalPaise: 2_596_500,
      previouslyPaidPaise: 1_000_000,
      thisPaymentPaise: 1_000_000,
      totalPaidPaise: 2_000_000,
      outcome: "balance-due",
      balanceDuePaise: 596_500,
      excessPaise: 0,
    });
  });

  it("previously paid is optional (treated as ₹0): total ₹3,481.47, now ₹3,481.47 → paid in full", () => {
    const { balance } = evaluateReceipt(receipt({ documentTotal: "3481.47", amount: "3481.47" }));
    expect(balance).toMatchObject({
      previouslyPaidPaise: 0,
      totalPaidPaise: 348_147,
      outcome: "paid-in-full",
      balanceDuePaise: 0,
      excessPaise: 0,
    });
  });

  it("overpayment is shown, not hidden: total ₹1,000, paid ₹400 + ₹700 → ₹100 excess", () => {
    const { balance } = evaluateReceipt(
      receipt({ documentTotal: "1000", previouslyPaid: "400", amount: "700" }),
    );
    expect(balance).toMatchObject({ outcome: "overpaid", balanceDuePaise: 0, excessPaise: 10_000 });
  });

  it("paisa-exact: total ₹100.01, paid ₹0.02 + ₹99.99 → paid in full", () => {
    const { balance } = evaluateReceipt(
      receipt({ documentTotal: "100.01", previouslyPaid: "0.02", amount: "99.99" }),
    );
    expect(balance).toMatchObject({ totalPaidPaise: 10_001, outcome: "paid-in-full" });
  });

  it("paisa-exact: total ₹100.01, paid ₹0.01 + ₹99.99 = ₹100.00 → ₹0.01 still due", () => {
    const { balance } = evaluateReceipt(
      receipt({ documentTotal: "100.01", previouslyPaid: "0.01", amount: "99.99" }),
    );
    expect(balance).toMatchObject({
      totalPaidPaise: 10_000,
      outcome: "balance-due",
      balanceDuePaise: 1,
    });
  });

  it("asks for the invoice total when only “previously paid” is entered", () => {
    const result = evaluateReceipt(receipt({ previouslyPaid: "500" }));
    expect(result.errors.documentTotal).toMatch(/Enter the invoice total/);
    expect(result.balance).toBeNull();
  });

  it("rejects invalid balance inputs", () => {
    expect(evaluateReceipt(receipt({ documentTotal: "0" })).errors.documentTotal).toBe(
      "Invoice total must be more than ₹0.",
    );
    expect(evaluateReceipt(receipt({ documentTotal: "-5" })).errors.documentTotal).toMatch(
      /cannot be negative/,
    );
    const badPrevious = evaluateReceipt(
      receipt({ documentTotal: "1000", previouslyPaid: "1.234" }),
    );
    expect(badPrevious.errors.previouslyPaid).toMatch(/2 decimal places/);
    expect(badPrevious.balance).toBeNull();
  });

  it("no balance while the amount received is invalid", () => {
    const result = evaluateReceipt(receipt({ documentTotal: "1000", amount: "" }));
    expect(result.balance).toBeNull();
    expect(result.errors.amount).toBe("Amount received is required.");
  });
});

describe("calculateBalance", () => {
  it("works with large amounts exactly (crores)", () => {
    // ₹5,00,00,000.00 total, ₹1,23,45,678.90 earlier, ₹2,00,00,000.00 now → ₹1,76,54,321.10 due
    expect(calculateBalance(p(5_000_000_000), p(1_234_567_890), p(2_000_000_000))).toMatchObject({
      totalPaidPaise: 3_234_567_890,
      balanceDuePaise: 1_765_432_110,
      outcome: "balance-due",
    });
  });
});
