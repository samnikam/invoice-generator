/**
 * ILLUSTRATIVE SAMPLE DATA for the landing-page preview only.
 * These are not real businesses. GSTINs are deliberately masked placeholders.
 * All amounts are in paise. `sample-invoice.test.ts` checks the arithmetic.
 */
export const sampleInvoice = {
  number: "INV-2026-27/0042",
  date: "15 Oct 2026",
  dueDate: "30 Oct 2026",
  seller: {
    name: "Sample Design Studio",
    location: "Pune, Maharashtra",
    gstin: "27XXXXX0000X1ZX",
  },
  customer: {
    name: "Example Retail Pvt Ltd",
    location: "Mumbai, Maharashtra",
  },
  /** Seller and customer are both in Maharashtra, so this is an intra-state supply. */
  supplyType: "intra-state",
  gstRatePercent: 18,
  items: [
    { description: "Brand identity design", quantity: 1, ratePaise: 1800000, amountPaise: 1800000 },
    {
      description: "Social media creatives (set of 10)",
      quantity: 2,
      ratePaise: 250000,
      amountPaise: 500000,
    },
  ],
  subtotalPaise: 2300000,
  cgstPaise: 207000,
  sgstPaise: 207000,
  totalPaise: 2714000,
  amountInWords: "Rupees Twenty-Seven Thousand One Hundred Forty Only",
} as const;
