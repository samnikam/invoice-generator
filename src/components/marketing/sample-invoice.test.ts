import { describe, expect, it } from "vitest";

import { sampleInvoice } from "@/components/marketing/sample-invoice";
import { calculateDocumentTotals } from "@/lib/documents/calculate-totals";
import { amountInWords } from "@/lib/money/amount-in-words";
import { NO_DISCOUNT } from "@/lib/money/discount";
import type { Paise } from "@/lib/money/paise";
import { parseQuantity } from "@/lib/money/quantity";

// The landing page shows these figures, so they must add up exactly.
describe("landing-page sample invoice", () => {
  it("has line amounts equal to quantity × rate", () => {
    for (const item of sampleInvoice.items) {
      expect(item.amountPaise).toBe(item.quantity * item.ratePaise);
    }
  });

  it("has a subtotal equal to the sum of line amounts", () => {
    const sum = sampleInvoice.items.reduce((total, item) => total + item.amountPaise, 0);
    expect(sampleInvoice.subtotalPaise).toBe(sum);
  });

  it("splits intra-state GST equally into CGST and SGST", () => {
    const halfRate = sampleInvoice.gstRatePercent / 2;
    const expectedHalf = (sampleInvoice.subtotalPaise * halfRate) / 100;
    expect(sampleInvoice.supplyType).toBe("intra-state");
    expect(sampleInvoice.cgstPaise).toBe(expectedHalf);
    expect(sampleInvoice.sgstPaise).toBe(expectedHalf);
  });

  it("has a total equal to subtotal plus taxes", () => {
    expect(sampleInvoice.totalPaise).toBe(
      sampleInvoice.subtotalPaise + sampleInvoice.cgstPaise + sampleInvoice.sgstPaise,
    );
  });

  it("matches the calculation engine exactly", () => {
    const totals = calculateDocumentTotals({
      lines: sampleInvoice.items.map((item) => ({
        quantity: parseQuantity(item.quantity),
        unitPricePaise: item.ratePaise as Paise,
        discount: NO_DISCOUNT,
        tax: { treatment: "taxable", rateId: "18" },
      })),
      taxContext: {
        chargesGst: true,
        sellerStateCode: "27",
        placeOfSupply: { kind: "state", stateCode: "27" },
      },
      roundOffToNearestRupee: false,
    });
    expect(totals.lines.map((l) => l.grossPaise)).toEqual(
      sampleInvoice.items.map((i) => i.amountPaise),
    );
    expect(totals.taxablePaise).toBe(sampleInvoice.subtotalPaise);
    expect(totals.cgstPaise).toBe(sampleInvoice.cgstPaise);
    expect(totals.sgstPaise).toBe(sampleInvoice.sgstPaise);
    expect(totals.grandTotalPaise).toBe(sampleInvoice.totalPaise);
  });

  it("shows the amount in words produced by the converter", () => {
    expect(sampleInvoice.amountInWords).toBe(amountInWords(sampleInvoice.totalPaise));
  });
});
