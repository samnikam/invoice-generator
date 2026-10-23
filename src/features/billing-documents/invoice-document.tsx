import type { ReactNode } from "react";
import { cn } from "cn";

import { TREATMENT_OPTIONS } from "@/lib/calculators/gst-calculator";
import { OUTSIDE_INDIA } from "@/lib/calculators/place-of-supply";
import { formatDisplayDate } from "@/lib/dates";
import {
  DOCUMENT_KINDS,
  showsSellerGstin,
  type BillingDocumentValues,
  type DocumentEvaluation,
} from "@/lib/documents/billing-document";
import type { DocumentTotals, LineResult } from "@/lib/documents/calculate-totals";
import { amountInWords } from "@/lib/money/amount-in-words";
import type { PaymentBalance } from "@/lib/money/balance";
import { formatPaise } from "@/lib/money/format";
import { formatBasisPointsAsPercent, formatHalfRatePercent } from "@/lib/money/percent";
import { formatQuantity } from "@/lib/money/quantity";
import { GST_STATES } from "@/lib/tax/states";

/**
 * INVOICE DOCUMENT (green design)
 * ═══════════════════════════════
 * The invoice's live preview and printed / "Save as PDF" page, laid out after the
 * user's reference invoice: company block, title banner, Bill To + invoice details,
 * item table, totals with tax rows, amount in words, amount received / balance due,
 * terms, payment mode, and a seal & signature area.
 *
 * It only DISPLAYS values: every figure comes from the shared engine through
 * `evaluation` (totals, per-rate tax summary, balance). Tax rows use the actual rates —
 * nothing is hard-coded. Quotations keep using DocumentPreview.
 *
 * Colours are the reference document's fixed palette (not theme tokens), so the printed
 * invoice looks the same whatever the app theme. Global print styles keep backgrounds.
 */
const GREEN = {
  dark: "#1A5529",
  light: "#7AD694",
  pale: "#D1F1DA",
} as const;

export function InvoiceDocument({
  values,
  evaluation,
}: {
  values: BillingDocumentValues;
  evaluation: DocumentEvaluation;
}) {
  const config = DOCUMENT_KINDS.invoice;
  const totals = evaluation.totals;
  const withGst = values.gstMode === "with-gst";
  const title = config.title[withGst ? "with-gst" : "without-gst"];
  const complete = evaluation.issues.length === 0 && totals !== null;
  const seller = values.seller;
  const contact = [seller.phone.trim(), seller.email.trim()].filter(Boolean);
  const sellerGstin = showsSellerGstin(values) ? seller.gstin.trim().toUpperCase() : "";

  return (
    <article
      aria-label={`${title} preview`}
      data-testid="document-preview"
      className="overflow-hidden rounded-xl border bg-white text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:border-0 print:text-[11px] print:shadow-none"
    >
      {!complete ? (
        <p className="border-b bg-muted px-5 py-2 text-xs text-muted-foreground print:hidden">
          Preview — fill in the highlighted details to complete this invoice.
        </p>
      ) : null}

      <div className="space-y-5 p-5 sm:p-7 print:space-y-4 print:p-0">
        {/* ── Company block ── */}
        <header
          className={cn(
            "grid break-inside-avoid items-stretch gap-4",
            values.sellerLogo && "sm:grid-cols-[auto_1fr] print:grid-cols-[auto_1fr]",
          )}
        >
          {values.sellerLogo ? (
            <div className="flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, not a remote image */}
              <img
                src={values.sellerLogo}
                alt={`${seller.name.trim() || "Business"} logo`}
                data-testid="preview-logo"
                className="max-h-24 max-w-52 object-contain print:max-h-20"
              />
            </div>
          ) : null}
          <div
            className="min-w-0 space-y-0.5 rounded-md px-5 py-4 text-white"
            style={{ backgroundColor: GREEN.dark }}
            data-testid="preview-company"
          >
            <p className="text-lg font-bold wrap-break-word">
              {seller.name.trim() || (
                <span className="font-normal italic opacity-70">Your business name</span>
              )}
            </p>
            {seller.address.trim() ? (
              <p className="wrap-break-word whitespace-pre-line opacity-95">
                {seller.address.trim()}
              </p>
            ) : null}
            {contact.length > 0 ? (
              <p className="wrap-break-word opacity-95">{contact.join(" · ")}</p>
            ) : null}
            {sellerGstin ? (
              <p>
                GSTIN: <span className="font-mono">{sellerGstin}</span>
              </p>
            ) : null}
            {withGst && stateLabel(seller.stateCode) ? (
              <p>State: {stateLabel(seller.stateCode)}</p>
            ) : null}
          </div>
        </header>

        {/* ── Title banner ── */}
        <div
          className="break-inside-avoid rounded-md py-2 text-center text-white"
          style={{ backgroundColor: GREEN.dark }}
        >
          <h2 className="text-xl font-bold tracking-widest uppercase">{title}</h2>
        </div>

        {/* ── Bill to + invoice details ── */}
        <section className="grid break-inside-avoid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0 space-y-0.5">
            <h3 className="font-bold tracking-wide" style={{ color: GREEN.dark }}>
              BILL TO:
            </h3>
            <p className="font-semibold wrap-break-word" data-testid="preview-customer">
              {values.customer.name.trim() || (
                <span className="font-normal text-neutral-400 italic">Customer name</span>
              )}
            </p>
            {values.customer.address.trim() ? (
              <p className="wrap-break-word whitespace-pre-line text-neutral-700">
                {values.customer.address.trim()}
              </p>
            ) : null}
            {values.customer.phone.trim() ? (
              <Detail label="Contact">{values.customer.phone.trim()}</Detail>
            ) : null}
            {values.customer.email.trim() ? (
              <Detail label="Email">{values.customer.email.trim()}</Detail>
            ) : null}
            {values.customer.gstin.trim() ? (
              <Detail label="GSTIN">
                <span className="font-mono">{values.customer.gstin.trim().toUpperCase()}</span>
              </Detail>
            ) : null}
          </div>
          <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-3 gap-y-1 sm:justify-self-end print:justify-self-end">
            <dt className="font-semibold" style={{ color: GREEN.dark }}>
              INVOICE NO.:
            </dt>
            <dd className="font-semibold" data-testid="preview-document-number">
              {values.documentNumber.trim() || "—"}
            </dd>
            <dt className="font-semibold" style={{ color: GREEN.dark }}>
              DATE:
            </dt>
            <dd>{values.issueDate ? formatDisplayDate(values.issueDate) : "—"}</dd>
            {values.dueDate ? (
              <>
                <dt className="font-semibold" style={{ color: GREEN.dark }}>
                  DUE DATE:
                </dt>
                <dd data-testid="preview-end-date">{formatDisplayDate(values.dueDate)}</dd>
              </>
            ) : null}
            {withGst ? (
              <>
                <dt className="font-semibold" style={{ color: GREEN.dark }}>
                  PLACE OF SUPPLY:
                </dt>
                <dd>
                  <span data-testid="preview-place-of-supply">
                    {placeOfSupplyLabel(values)}
                    {values.recipientIsSez ? " — SEZ unit/developer" : ""}
                  </span>
                  {totals?.supplyType ? (
                    <span
                      className="block text-[11px] text-neutral-500"
                      data-testid="preview-supply-type"
                    >
                      {totals.supplyType.kind === "intra-state"
                        ? `Intra-state supply (CGST + ${totals.supplyType.stateTaxLabel})`
                        : "Inter-state supply (IGST)"}
                    </span>
                  ) : null}
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        <ItemsTable values={values} evaluation={evaluation} withGst={withGst} />

        {totals ? (
          <>
            {withGst && totals.rateSummary.length > 1 ? <RateBreakdown totals={totals} /> : null}
            <TotalsAndNotes
              values={values}
              totals={totals}
              balance={evaluation.balance}
              withGst={withGst}
            />
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-neutral-500">
            Totals appear here once every item and the tax details are filled in correctly.
          </p>
        )}

        {/* ── Payment mode + seal & signature ── */}
        <section className="grid break-inside-avoid gap-6 border-t pt-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="font-bold" style={{ color: GREEN.dark }}>
                Payment Mode:
              </h3>
              {values.paymentMode.trim() ? (
                <p
                  className="wrap-break-word whitespace-pre-line"
                  data-testid="preview-payment-mode"
                >
                  {values.paymentMode.trim()}
                </p>
              ) : (
                <p className="text-neutral-400">—</p>
              )}
            </div>
            {values.gstMode === "without-gst" ? (
              <p className="text-[11px] text-neutral-500" data-testid="preview-non-gst-note">
                The supplier is not registered under GST. No GST has been charged on this invoice.
              </p>
            ) : null}
            <p className="text-[11px] text-neutral-500">
              All amounts are in Indian Rupees (₹) and rounded to the nearest paisa.
            </p>
          </div>
          <div className="flex items-end gap-4" data-testid="preview-seal-signature">
            <div className="flex size-24 items-center justify-center rounded-md border border-dashed border-neutral-400 text-center text-[10px] text-neutral-400">
              Company seal
            </div>
            <div className="w-44 text-right">
              <p className="font-semibold wrap-break-word">
                For {seller.name.trim() || "your business"}
              </p>
              <div className="mt-12 border-t border-neutral-500 pt-1 text-[11px] text-neutral-600">
                Seal &amp; Signature
              </div>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

/* ───────────── items ───────────── */

function ItemsTable({
  values,
  evaluation,
  withGst,
}: {
  values: BillingDocumentValues;
  evaluation: DocumentEvaluation;
  withGst: boolean;
}) {
  const totals = evaluation.totals;
  const anyDiscount = values.lines.some((l) => l.discountKind !== "none");
  const head = "px-2 py-2 font-semibold text-white";
  return (
    <div className="-mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
      <table className="w-full min-w-140 border-collapse text-left text-xs print:min-w-0 print:text-[10.5px]">
        <caption className="sr-only">Invoice items</caption>
        <thead>
          <tr style={{ backgroundColor: GREEN.dark }}>
            <th scope="col" className={cn(head, "w-10")}>
              Items
            </th>
            <th scope="col" className={head}>
              Description
            </th>
            <th scope="col" className={cn(head, "text-right")}>
              Quantity
            </th>
            <th scope="col" className={cn(head, "text-right")}>
              Price
            </th>
            {anyDiscount ? (
              <th scope="col" className={cn(head, "text-right")}>
                Discount
              </th>
            ) : null}
            {withGst ? (
              <th scope="col" className={cn(head, "text-right")}>
                Tax
              </th>
            ) : null}
            <th scope="col" className={cn(head, "text-right")}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {values.lines.map((line, index) => {
            const result: LineResult | undefined = totals?.lines[index];
            const parsed = evaluation.parsedLines[index];
            return (
              <tr
                key={line.id}
                className="break-inside-avoid border-b border-neutral-300 align-top"
                data-testid="preview-line"
              >
                <td className="px-2 py-2 text-neutral-600">{index + 1}</td>
                <td className="min-w-44 px-2 py-2 wrap-break-word whitespace-pre-line">
                  {line.description.trim() || (
                    <span className="text-neutral-400 italic">Item description</span>
                  )}
                  {line.hsnSac.trim() ? (
                    <span className="block text-[10px] text-neutral-500">
                      HSN/SAC {line.hsnSac.trim()}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {parsed ? formatQuantity(parsed.quantity) : line.quantity.trim() || "—"}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                  {parsed ? formatPaise(parsed.unitPricePaise) : "—"}
                </td>
                {anyDiscount ? (
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                    {result && result.discountPaise > 0 ? (
                      <>
                        −{formatPaise(result.discountPaise)}
                        {line.discountKind === "percent" ? (
                          <span className="block text-[10px] text-neutral-500">
                            {line.discountValue.trim()}%
                          </span>
                        ) : null}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : null}
                {withGst ? (
                  <td className="px-2 py-2 text-right whitespace-nowrap tabular-nums">
                    {result ? taxLabel(result) : "—"}
                  </td>
                ) : null}
                <td
                  className="px-2 py-2 text-right font-medium tabular-nums"
                  data-testid="preview-line-total"
                >
                  {result ? formatPaise(result.taxablePaise) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        {totals ? (
          <tfoot>
            <tr style={{ backgroundColor: GREEN.light }} className="font-bold">
              <td className="px-2 py-2" colSpan={4 + (anyDiscount ? 1 : 0) + (withGst ? 1 : 0)}>
                Total
              </td>
              <td
                className="px-2 py-2 text-right whitespace-nowrap tabular-nums"
                data-testid="preview-items-total"
              >
                {formatPaise(totals.taxablePaise)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

/** "18%" for taxable lines; the treatment name (e.g. "Exempt") otherwise. */
function taxLabel(result: LineResult): string {
  if (result.treatment === "taxable" && result.rateBasisPoints !== null) {
    return `${formatBasisPointsAsPercent(result.rateBasisPoints)}%`;
  }
  return TREATMENT_OPTIONS.find((o) => o.value === result.treatment)?.label ?? "—";
}

/* ───────────── per-rate breakdown (only when more than one GST rate is used) ───────────── */

function RateBreakdown({ totals }: { totals: DocumentTotals }) {
  const intra = totals.supplyType?.kind === "intra-state";
  const stateTax =
    totals.supplyType?.kind === "intra-state" ? totals.supplyType.stateTaxLabel : "SGST";
  return (
    <table className="w-full border-collapse break-inside-avoid text-[11px]">
      <caption className="mb-1 text-left font-bold" style={{ color: GREEN.dark }}>
        Tax breakdown by rate
      </caption>
      <thead>
        <tr style={{ backgroundColor: GREEN.pale }}>
          <th scope="col" className="px-2 py-1.5 text-left font-semibold">
            GST rate
          </th>
          <th scope="col" className="px-2 py-1.5 text-right font-semibold">
            Taxable value
          </th>
          {intra ? (
            <>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                CGST
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {stateTax}
              </th>
            </>
          ) : (
            <th scope="col" className="px-2 py-1.5 text-right font-semibold">
              IGST
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {totals.rateSummary.map((row) => (
          <tr key={row.rateId} className="border-b border-neutral-200">
            <td className="px-2 py-1.5">{formatBasisPointsAsPercent(row.rateBasisPoints)}%</td>
            <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
              {formatPaise(row.taxablePaise)}
            </td>
            {intra ? (
              <>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {formatPaise(row.cgstPaise)}{" "}
                  <span className="text-neutral-500">
                    @ {formatHalfRatePercent(row.rateBasisPoints)}%
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {formatPaise(row.sgstPaise)}{" "}
                  <span className="text-neutral-500">
                    @ {formatHalfRatePercent(row.rateBasisPoints)}%
                  </span>
                </td>
              </>
            ) : (
              <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                {formatPaise(row.igstPaise)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────── totals, amount in words, terms ───────────── */

function TotalsAndNotes({
  values,
  totals,
  balance,
  withGst,
}: {
  values: BillingDocumentValues;
  totals: DocumentTotals;
  balance: PaymentBalance | null;
  withGst: boolean;
}) {
  const intra = totals.supplyType?.kind === "intra-state";
  const stateTax =
    totals.supplyType?.kind === "intra-state" ? totals.supplyType.stateTaxLabel : "SGST";
  // With a single GST rate, show it on the tax rows (e.g. "@ 9%"), as in the reference.
  const singleRate = totals.rateSummary.length === 1 ? totals.rateSummary[0] : undefined;
  const halfRate = singleRate ? ` @ ${formatHalfRatePercent(singleRate.rateBasisPoints)}%` : "";
  const fullRate = singleRate
    ? ` @ ${formatBasisPointsAsPercent(singleRate.rateBasisPoints)}%`
    : "";

  return (
    <section className="grid break-inside-avoid gap-5 sm:grid-cols-[1fr_minmax(0,18rem)] print:grid-cols-[1fr_17rem]">
      <div className="min-w-0 space-y-3">
        <div>
          <h3 className="font-bold" style={{ color: GREEN.dark }}>
            Amount in Words:
          </h3>
          <p className="font-medium" data-testid="preview-amount-in-words">
            {amountInWords(totals.grandTotalPaise)}
          </p>
        </div>
        <div className="rounded-md p-3" style={{ backgroundColor: GREEN.pale }}>
          <h3 className="font-bold" style={{ color: GREEN.dark }}>
            Terms &amp; Conditions:
          </h3>
          {values.terms.trim() ? (
            <p className="wrap-break-word whitespace-pre-line" data-testid="preview-terms">
              {values.terms.trim()}
            </p>
          ) : (
            <p className="text-neutral-500">—</p>
          )}
        </div>
        {values.notes.trim() ? (
          <div>
            <h3 className="font-bold" style={{ color: GREEN.dark }}>
              Notes:
            </h3>
            <p className="wrap-break-word whitespace-pre-line" data-testid="preview-notes">
              {values.notes.trim()}
            </p>
          </div>
        ) : null}
        {totals.nonTaxableValuePaise["zero-rated-lut"] > 0 ? (
          <p className="text-[11px] text-neutral-600" data-testid="preview-lut-note">
            {values.placeOfSupply === OUTSIDE_INDIA ? "Export" : "Supply to an SEZ"} under Letter of
            Undertaking / bond without payment of IGST:{" "}
            {formatPaise(totals.nonTaxableValuePaise["zero-rated-lut"])}.
          </p>
        ) : null}
      </div>

      <dl className="space-y-1 tabular-nums" data-testid="preview-totals">
        {totals.discountPaise > 0 ? (
          <>
            <Row label="Subtotal" value={formatPaise(totals.grossPaise)} />
            <Row
              label="Less: Discount"
              value={`−${formatPaise(totals.discountPaise)}`}
              testId="preview-discount"
            />
          </>
        ) : null}
        <Row label={withGst ? "Taxable value" : "Total"} value={formatPaise(totals.taxablePaise)} />
        {withGst ? (
          intra ? (
            <>
              <Row
                label={
                  <>
                    Add: <span>CGST</span>
                    {halfRate}
                  </>
                }
                value={formatPaise(totals.cgstPaise)}
                testId="preview-cgst"
              />
              <Row
                label={
                  <>
                    Add: <span>{stateTax}</span>
                    {halfRate}
                  </>
                }
                value={formatPaise(totals.sgstPaise)}
                testId="preview-sgst"
              />
            </>
          ) : (
            <Row
              label={
                <>
                  Add: <span>IGST</span>
                  {fullRate}
                </>
              }
              value={formatPaise(totals.igstPaise)}
              testId="preview-igst"
            />
          )
        ) : null}
        {values.roundOff ? (
          <Row
            label="Round off"
            value={formatSignedPaise(totals.roundOffPaise)}
            testId="preview-round-off"
          />
        ) : null}
        <div
          className="mt-2 flex items-center justify-between gap-4 rounded-md px-3 py-2 text-white"
          style={{ backgroundColor: GREEN.dark }}
        >
          <dt className="font-bold tracking-wide">GRAND TOTAL</dt>
          <dd className="text-base font-bold" data-testid="preview-grand-total">
            {formatPaise(totals.grandTotalPaise)}
          </dd>
        </div>
        {balance ? (
          <div className="mt-2 space-y-1 border-t border-neutral-300 pt-2">
            <Row
              label="Amount received"
              value={formatPaise(balance.thisPaymentPaise)}
              testId="preview-amount-received"
            />
            {balance.outcome === "overpaid" ? (
              <>
                <Row label="Balance due" value="Nil" strong testId="preview-balance-due" />
                <Row
                  label="Received in excess"
                  value={formatPaise(balance.excessPaise)}
                  testId="preview-excess"
                />
              </>
            ) : (
              <Row
                label="Balance due"
                value={
                  balance.outcome === "paid-in-full"
                    ? "Nil — paid in full"
                    : formatPaise(balance.balanceDuePaise)
                }
                strong
                testId="preview-balance-due"
              />
            )}
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function Row({
  label,
  value,
  strong = false,
  testId,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
  testId?: string;
}) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-bold")}>
      <dt className={strong ? undefined : "text-neutral-700"}>{label}</dt>
      <dd className="text-right" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="wrap-break-word text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      {children}
    </p>
  );
}

/* ───────────── small helpers ───────────── */

function formatSignedPaise(paise: number): string {
  if (paise === 0) return formatPaise(0);
  return `${paise < 0 ? "−" : "+"}${formatPaise(Math.abs(paise))}`;
}

function stateLabel(code: string): string {
  const state = GST_STATES.find((s) => s.code === code.trim());
  return state ? `${state.name} (${state.code})` : "";
}

function placeOfSupplyLabel(values: BillingDocumentValues): string {
  if (values.placeOfSupply === OUTSIDE_INDIA) return "Outside India (export)";
  return stateLabel(values.placeOfSupply) || "—";
}
