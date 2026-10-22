import { describe, expect, it } from "vitest";

import { sampleInvoice } from "@/components/marketing/sample-invoice";

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
});
