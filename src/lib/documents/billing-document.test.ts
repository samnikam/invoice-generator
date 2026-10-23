import { describe, expect, it } from "vitest";

import { formatDisplayDate, parseIsoDate, todayIsoDate } from "@/lib/dates";
import {
  createEmptyDocument,
  createEmptyLine,
  evaluateDocument,
  fieldDomId,
  type BillingDocumentValues,
  type LineValues,
} from "@/lib/documents/billing-document";
import { amountInWords } from "@/lib/money/amount-in-words";

/* ───────────── fixtures ───────────── */

const line = (id: string, overrides: Partial<LineValues>): LineValues => ({
  ...createEmptyLine(id),
  ...overrides,
});

/** The three-item example independently verified (Python Decimal) in the Step 1.2 audit. */
const THREE_LINES: LineValues[] = [
  line("a", {
    description: "Design work",
    quantity: "2",
    unitPrice: "1250",
    discountKind: "percent",
    discountValue: "10",
    treatment: "taxable",
    rateId: "18",
  }),
  line("b", {
    description: "Printed brochures",
    quantity: "1.5",
    unitPrice: "333.33",
    discountKind: "amount",
    discountValue: "50",
    treatment: "taxable",
    rateId: "5",
  }),
  line("c", {
    description: "Courier",
    quantity: "3",
    unitPrice: "99.99",
    treatment: "taxable",
    rateId: "18",
  }),
];

function taxInvoice(overrides: Partial<BillingDocumentValues> = {}): BillingDocumentValues {
  const base = createEmptyDocument("invoice");
  return {
    ...base,
    gstMode: "with-gst",
    seller: {
      name: "Example Studio",
      address: "Pune, Maharashtra",
      phone: "",
      email: "",
      gstin: "27AAPFU0939F1ZV", // published valid example (Maharashtra)
      stateCode: "27",
    },
    customer: { ...base.customer, name: "Example Customer" },
    documentNumber: "INV-2026/001",
    issueDate: "2026-10-22",
    placeOfSupply: "27",
    lines: THREE_LINES,
    ...overrides,
  };
}

const fields = (values: BillingDocumentValues) =>
  evaluateDocument(values).issues.map((i) => i.field);

/* ───────────── tests ───────────── */

describe("evaluateDocument — required fields", () => {
  it("lists every missing required field for an empty form, in order", () => {
    const result = evaluateDocument(createEmptyDocument("invoice"));
    expect(result.issues.map((i) => i.field)).toEqual([
      "gstMode",
      "seller.name",
      "seller.address",
      "customer.name",
      "documentNumber",
      "issueDate",
      "lines.line-1.description",
      "lines.line-1.unitPrice",
    ]);
    expect(result.totals).toBeNull();
  });

  it("requires seller GSTIN, state and place of supply on a tax invoice", () => {
    const values = taxInvoice({
      seller: { ...taxInvoice().seller, gstin: "", stateCode: "" },
      placeOfSupply: "",
    });
    const result = evaluateDocument(values);
    expect(result.errors["seller.gstin"]).toBe("GSTIN is required on a tax invoice.");
    expect(result.errors["seller.stateCode"]).toBe("Select the seller's state.");
    expect(result.errors["placeOfSupply"]).toBe("Select the place of supply.");
    expect(result.totals).toBeNull();
  });

  it("requires a GST treatment and rate for each item on a tax invoice", () => {
    const values = taxInvoice({
      lines: [
        line("x", { description: "A", unitPrice: "100" }),
        line("y", { description: "B", unitPrice: "100", treatment: "taxable" }),
      ],
    });
    const result = evaluateDocument(values);
    expect(result.errors["lines.x.treatment"]).toBe("Choose how GST applies to this item.");
    expect(result.errors["lines.y.rateId"]).toBe("Select a GST rate.");
    expect(result.issues.find((i) => i.field === "lines.y.rateId")?.label).toBe("Item 2: GST rate");
  });

  it("requires at least one item", () => {
    expect(fields(taxInvoice({ lines: [] }))).toContain("lines");
  });
});

describe("evaluateDocument — format checks", () => {
  it.each([
    ["INV 001", /letters, numbers/], // space
    ["INV#001", /letters, numbers/],
    ["INV-2026-27/00001", /up to 16 characters/i], // 17 characters
  ])("rejects invoice number %j", (documentNumber, message) => {
    expect(evaluateDocument(taxInvoice({ documentNumber })).errors.documentNumber).toMatch(message);
  });

  it("accepts a 16-character invoice number with - and /", () => {
    expect(fields(taxInvoice({ documentNumber: "INV-2026-27/0001" }))).toEqual([]);
  });

  it("rejects a GSTIN from another state and a mistyped GSTIN", () => {
    const otherState = taxInvoice({ seller: { ...taxInvoice().seller, stateCode: "29" } });
    expect(evaluateDocument(otherState).errors["seller.gstin"]).toMatch(/belongs to state code 27/);
    const typo = taxInvoice({ seller: { ...taxInvoice().seller, gstin: "27AAPFU0939F1ZA" } });
    expect(evaluateDocument(typo).errors["seller.gstin"]).toMatch(/check character/);
    const customer = taxInvoice({ customer: { ...taxInvoice().customer, gstin: "12345" } });
    expect(evaluateDocument(customer).errors["customer.gstin"]).toMatch(/15 characters/);
  });

  it("validates dates, phone, email and HSN/SAC", () => {
    const values = taxInvoice({
      issueDate: "2026-02-30",
      seller: { ...taxInvoice().seller, phone: "call me", email: "not-an-email" },
      lines: [line("h", { ...THREE_LINES[0], id: "h", hsnSac: "12345" })],
    });
    const { errors } = evaluateDocument(values);
    expect(errors.issueDate).toBe("Invoice date must be a valid date.");
    expect(errors["seller.phone"]).toMatch(/valid phone number/);
    expect(errors["seller.email"]).toMatch(/valid email address/);
    expect(errors["lines.h.hsnSac"]).toBe("HSN/SAC code must be 4, 6 or 8 digits.");
  });

  it("rejects a due date before the invoice date", () => {
    expect(evaluateDocument(taxInvoice({ dueDate: "2026-10-21" })).errors.dueDate).toBe(
      "Due date cannot be before the invoice date.",
    );
    expect(fields(taxInvoice({ dueDate: "2026-10-22" }))).toEqual([]);
  });

  it("reports invalid quantities, prices and discounts against the right item", () => {
    const values = taxInvoice({
      lines: [
        line("q", { description: "A", quantity: "0", unitPrice: "-1", treatment: "exempt" }),
        line("d", {
          description: "B",
          unitPrice: "100",
          discountKind: "percent",
          discountValue: "120",
          treatment: "exempt",
        }),
      ],
    });
    const { errors } = evaluateDocument(values);
    expect(errors["lines.q.quantity"]).toBe("Quantity must be greater than zero.");
    expect(errors["lines.q.unitPrice"]).toBe("Unit price cannot be negative.");
    expect(errors["lines.d.discountValue"]).toBe("Discount percentage cannot be more than 100%.");
  });

  it("maps an engine error (fixed discount above the item value) to the item's discount field", () => {
    const values = taxInvoice({
      lines: [
        line("z", {
          description: "A",
          quantity: "2",
          unitPrice: "100",
          discountKind: "amount",
          discountValue: "200.01",
          treatment: "exempt",
        }),
      ],
    });
    expect(evaluateDocument(values).errors["lines.z.discountValue"]).toBe(
      "Discount cannot be more than the item's value.",
    );
  });

  it("maps the LUT-for-domestic-supply rule to the item's treatment field", () => {
    const values = taxInvoice({
      placeOfSupply: "29",
      lines: [line("l", { description: "A", unitPrice: "100", treatment: "zero-rated-lut" })],
    });
    expect(evaluateDocument(values).errors["lines.l.treatment"]).toMatch(
      /exports or supplies to an SEZ/,
    );
  });
});

describe("evaluateDocument — totals come from the shared engine", () => {
  it("intra-state, three items: ₹3,481.47 with CGST ₹240.75 + SGST ₹240.75", () => {
    const { issues, totals } = evaluateDocument(taxInvoice());
    expect(issues).toEqual([]);
    expect(totals).toMatchObject({
      supplyType: { kind: "intra-state", stateTaxLabel: "SGST" },
      grossPaise: 329997,
      discountPaise: 30000,
      taxablePaise: 299997,
      cgstPaise: 24075,
      sgstPaise: 24075,
      igstPaise: 0,
      totalBeforeRoundOffPaise: 348147,
      roundOffPaise: 0,
      grandTotalPaise: 348147,
    });
    expect(amountInWords(totals?.grandTotalPaise ?? 0)).toBe(
      "Rupees Three Thousand Four Hundred Eighty-One and Forty-Seven Paise Only",
    );
  });

  it("round off to the nearest rupee is opt-in and shown separately: −₹0.47", () => {
    const { totals } = evaluateDocument(taxInvoice({ roundOff: true }));
    expect(totals).toMatchObject({
      totalBeforeRoundOffPaise: 348147,
      roundOffPaise: -47,
      grandTotalPaise: 348100,
    });
  });

  it("inter-state (Maharashtra → Karnataka): IGST ₹481.49, total ₹3,481.46", () => {
    const { totals } = evaluateDocument(taxInvoice({ placeOfSupply: "29" }));
    expect(totals).toMatchObject({
      supplyType: { kind: "inter-state", reason: "different-state" },
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 48149,
      grandTotalPaise: 348146,
    });
  });

  it("Chandigarh seller and place of supply: CGST + UTGST", () => {
    const values = taxInvoice({
      seller: { ...taxInvoice().seller, gstin: "04AAAAA0000A1ZA", stateCode: "04" },
      placeOfSupply: "04",
    });
    expect(evaluateDocument(values).totals?.supplyType).toMatchObject({ stateTaxLabel: "UTGST" });
  });

  it("computes totals even while non-tax header fields are still incomplete", () => {
    const values = taxInvoice({
      documentNumber: "",
      customer: createEmptyDocument("invoice").customer,
    });
    const result = evaluateDocument(values);
    expect(result.issues.map((i) => i.field)).toEqual(["customer.name", "documentNumber"]);
    expect(result.totals?.grandTotalPaise).toBe(348147);
  });
});

describe("evaluateDocument — invoice without GST", () => {
  const nonGst = (overrides: Partial<BillingDocumentValues> = {}): BillingDocumentValues =>
    taxInvoice({
      gstMode: "without-gst",
      seller: { ...taxInvoice().seller, gstin: "", stateCode: "" },
      placeOfSupply: "",
      // Treatment/rate values left over from a tax invoice are ignored, never charged.
      lines: THREE_LINES,
      ...overrides,
    });

  it("charges no GST and needs no state or place of supply", () => {
    const { issues, totals } = evaluateDocument(nonGst());
    expect(issues).toEqual([]);
    expect(totals).toMatchObject({
      supplyType: null,
      taxablePaise: 299997,
      totalTaxPaise: 0,
      grandTotalPaise: 299997,
      rateSummary: [],
    });
  });

  it("refuses a seller GSTIN", () => {
    const values = nonGst({ seller: { ...taxInvoice().seller, stateCode: "" } });
    expect(evaluateDocument(values).errors["seller.gstin"]).toMatch(/Remove the GSTIN/);
  });
});

describe("helpers", () => {
  it("builds safe DOM ids from field keys", () => {
    expect(fieldDomId("lines.line-3.unitPrice")).toBe("doc-lines-line-3-unitPrice");
    expect(fieldDomId("seller.gstin")).toBe("doc-seller-gstin");
  });

  it("parses and formats calendar dates", () => {
    expect(parseIsoDate("2028-02-29")).toBe("2028-02-29"); // leap year
    expect(() => parseIsoDate("2027-02-29")).toThrow();
    expect(() => parseIsoDate("22/10/2026")).toThrow();
    expect(formatDisplayDate("2026-10-05")).toBe("5 Oct 2026");
    expect(todayIsoDate(new Date(2026, 0, 9))).toBe("2026-01-09");
  });
});

describe("evaluateDocument — quotations", () => {
  const quotation = (overrides: Partial<BillingDocumentValues> = {}): BillingDocumentValues =>
    taxInvoice({ kind: "quotation", documentNumber: "QT-2026/001", ...overrides });

  it("uses quotation labels and messages for an empty form", () => {
    const result = evaluateDocument(createEmptyDocument("quotation"));
    expect(result.issues.map((i) => [i.field, i.label])).toEqual([
      ["gstMode", "Quotation type"],
      ["seller.name", "Business name"],
      ["seller.address", "Business address"],
      ["customer.name", "Customer name"],
      ["documentNumber", "Quotation number"],
      ["issueDate", "Issue date"],
      ["lines.line-1.description", "Item 1: description"],
      ["lines.line-1.unitPrice", "Item 1: unit price"],
    ]);
    expect(result.errors.gstMode).toBe("Choose whether this quotation includes GST.");
    expect(result.errors.documentNumber).toBe("Quotation number is required.");
    expect(result.errors.issueDate).toBe("Issue date is required.");
  });

  it("with GST: GSTIN is optional, totals come from the engine (₹3,481.47)", () => {
    const values = quotation({ seller: { ...taxInvoice().seller, gstin: "" } });
    const { issues, totals } = evaluateDocument(values);
    expect(issues).toEqual([]);
    expect(totals).toMatchObject({ cgstPaise: 24075, sgstPaise: 24075, grandTotalPaise: 348147 });
  });

  it("with GST: a GSTIN that is entered is still checked", () => {
    const values = quotation({ seller: { ...taxInvoice().seller, stateCode: "29" } });
    expect(evaluateDocument(values).errors["seller.gstin"]).toMatch(/belongs to state code 27/);
  });

  it("with GST: still requires seller state and place of supply", () => {
    const values = quotation({
      seller: { ...taxInvoice().seller, stateCode: "" },
      placeOfSupply: "",
    });
    const { errors, totals } = evaluateDocument(values);
    expect(errors["seller.stateCode"]).toBe("Select the seller's state.");
    expect(errors.placeOfSupply).toBe("Select the place of supply.");
    expect(totals).toBeNull();
  });

  it("checks “valid until” against the issue date and ignores the invoice due date", () => {
    expect(evaluateDocument(quotation({ validUntil: "2026-10-21" })).errors.validUntil).toBe(
      "“Valid until” cannot be before the issue date.",
    );
    expect(evaluateDocument(quotation({ validUntil: "2026-11-21" })).issues).toEqual([]);
    expect(evaluateDocument(quotation({ dueDate: "2026-01-01" })).issues).toEqual([]);
  });

  it("without GST: no tax, no state needed, and a leftover GSTIN is ignored (not refused)", () => {
    const values = quotation({
      gstMode: "without-gst",
      seller: { ...taxInvoice().seller, stateCode: "" },
      placeOfSupply: "",
    });
    const { issues, totals } = evaluateDocument(values);
    expect(issues).toEqual([]);
    expect(totals).toMatchObject({ supplyType: null, totalTaxPaise: 0, grandTotalPaise: 299997 });
  });
});

describe("evaluateDocument — amount received and balance due (invoices)", () => {
  // Grand total of the three-item example is ₹3,481.47 (348,147 paise).
  it("shows no balance when no amount received is entered", () => {
    expect(evaluateDocument(taxInvoice()).balance).toBeNull();
    expect(evaluateDocument(taxInvoice({ amountReceived: "   " })).balance).toBeNull();
  });

  it("balance due: ₹3,481.47 − ₹1,000.00 = ₹2,481.47", () => {
    const { balance, issues } = evaluateDocument(taxInvoice({ amountReceived: "1000" }));
    expect(issues).toEqual([]);
    expect(balance).toMatchObject({
      documentTotalPaise: 348147,
      thisPaymentPaise: 100000,
      outcome: "balance-due",
      balanceDuePaise: 248147,
      excessPaise: 0,
    });
  });

  it("paid in full when the amount received equals the grand total", () => {
    expect(evaluateDocument(taxInvoice({ amountReceived: "3481.47" })).balance).toMatchObject({
      outcome: "paid-in-full",
      balanceDuePaise: 0,
    });
  });

  it("uses the rounded grand total when round off is on (₹3,481.00)", () => {
    expect(
      evaluateDocument(taxInvoice({ roundOff: true, amountReceived: "3481" })).balance,
    ).toMatchObject({ documentTotalPaise: 348100, outcome: "paid-in-full" });
  });

  it("reports an overpayment honestly: ₹5,000 received → ₹1,518.53 in excess", () => {
    expect(evaluateDocument(taxInvoice({ amountReceived: "5000" })).balance).toMatchObject({
      outcome: "overpaid",
      balanceDuePaise: 0,
      excessPaise: 151853,
    });
  });

  it.each([
    ["0", /must be more than ₹0/],
    ["-10", /cannot be negative/],
    ["10.555", /2 decimal places/],
    ["1,000", /no commas/],
  ])("rejects amount received %j", (amountReceived, message) => {
    const result = evaluateDocument(taxInvoice({ amountReceived }));
    expect(result.errors.amountReceived).toMatch(message);
    expect(result.balance).toBeNull();
  });

  it("no balance while totals are incomplete, even with an amount received", () => {
    const values = taxInvoice({ amountReceived: "100", placeOfSupply: "" });
    expect(evaluateDocument(values).balance).toBeNull();
  });

  it("checks the payment mode length", () => {
    expect(evaluateDocument(taxInvoice({ paymentMode: "x".repeat(301) })).errors.paymentMode).toBe(
      "Payment mode must be 300 characters or fewer.",
    );
  });

  it("quotations ignore the invoice-only payment fields", () => {
    const values = taxInvoice({
      kind: "quotation",
      documentNumber: "QT-1",
      amountReceived: "abc",
      paymentMode: "x".repeat(400),
    });
    const result = evaluateDocument(values);
    expect(result.issues).toEqual([]);
    expect(result.balance).toBeNull();
  });
});
