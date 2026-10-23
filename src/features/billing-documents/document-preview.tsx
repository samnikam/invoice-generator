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
import { formatPaise } from "@/lib/money/format";
import { formatBasisPointsAsPercent, formatHalfRatePercent } from "@/lib/money/percent";
import { formatQuantity } from "@/lib/money/quantity";
import { GST_STATES } from "@/lib/tax/states";

/**
 * The invoice or quotation document. Used both as the live on-screen preview and as the
 * printed / "Save as PDF" page (see the print: classes). It only displays values: every
 * figure comes from the shared calculation engine via `evaluation.totals`.
 *
 * Colours: unlike the rest of the app, the document uses fixed neutral colours
 * (white paper, near-black text) rather than theme tokens, so the printed document is
 * plain black-on-white whatever the app theme.
 */
export function DocumentPreview({
  values,
  evaluation,
}: {
  values: BillingDocumentValues;
  evaluation: DocumentEvaluation;
}) {
  const config = DOCUMENT_KINDS[values.kind];
  const isQuotation = values.kind === "quotation";
  const totals = evaluation.totals;
  const withGst = values.gstMode === "with-gst";
  const title = config.title[withGst ? "with-gst" : "without-gst"];
  const complete = evaluation.issues.length === 0 && totals !== null;
  const endDate = values[config.endDate.field];
  const sectionHeading = "text-[11px] font-semibold tracking-wider text-neutral-500 uppercase";

  return (
    <article
      aria-label={`${title} preview`}
      data-testid="document-preview"
      className="rounded-xl border bg-white text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:border-0 print:text-[11px] print:shadow-none"
    >
      {!complete ? (
        <p className="rounded-t-xl border-b bg-muted px-5 py-2 text-xs text-muted-foreground print:hidden">
          Preview — fill in the highlighted details to complete this {config.noun}.
        </p>
      ) : null}

      <div className="space-y-6 p-5 sm:p-8 print:p-0">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-lg font-bold tracking-wide uppercase">{title}</h2>
            {isQuotation ? (
              <p
                className="pb-1 text-[11px] text-neutral-500"
                data-testid="preview-document-notice"
              >
                Price estimate — not an invoice and not a receipt for payment.
              </p>
            ) : null}
            <Text
              value={values.seller.name}
              placeholder="Your business name"
              className="text-base font-semibold"
            />
            <Multiline value={values.seller.address} />
            <ContactLine phone={values.seller.phone} email={values.seller.email} />
            {showsSellerGstin(values) ? (
              <Labelled label="GSTIN" value={values.seller.gstin.trim().toUpperCase()} mono />
            ) : null}
            {withGst ? (
              <Labelled label="State" value={stateLabel(values.seller.stateCode)} />
            ) : null}
          </div>
          <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right">
            <dt className="text-neutral-500">{config.Noun} no.</dt>
            <dd className="font-semibold" data-testid="preview-document-number">
              {values.documentNumber.trim() || "—"}
            </dd>
            <dt className="text-neutral-500">{config.dateLabel}</dt>
            <dd>{values.issueDate ? formatDisplayDate(values.issueDate) : "—"}</dd>
            {endDate ? (
              <>
                <dt className="text-neutral-500">{config.endDate.label}</dt>
                <dd data-testid="preview-end-date">{formatDisplayDate(endDate)}</dd>
              </>
            ) : null}
          </dl>
        </header>

        {/* Parties */}
        <section className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0 space-y-0.5">
            <h3 className={sectionHeading}>{isQuotation ? "Prepared for" : "Bill to"}</h3>
            <Text
              value={values.customer.name}
              placeholder="Customer name"
              className="font-semibold"
              testId="preview-customer"
            />
            <Multiline value={values.customer.address} />
            <ContactLine phone={values.customer.phone} email={values.customer.email} />
            <Labelled label="GSTIN" value={values.customer.gstin.trim().toUpperCase()} mono />
          </div>
          {withGst ? (
            <div className="min-w-0 space-y-0.5 sm:text-right print:text-right">
              <h3 className={sectionHeading}>Place of supply</h3>
              <p data-testid="preview-place-of-supply">
                {placeOfSupplyLabel(values)}
                {values.recipientIsSez ? " — SEZ unit/developer" : ""}
              </p>
              {totals?.supplyType ? (
                <p className="text-neutral-500" data-testid="preview-supply-type">
                  {totals.supplyType.kind === "intra-state"
                    ? `Intra-state supply (CGST + ${totals.supplyType.stateTaxLabel})`
                    : "Inter-state supply (IGST)"}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <ItemsTable
          values={values}
          totals={totals}
          parsedLines={evaluation.parsedLines}
          withGst={withGst}
        />

        {totals ? (
          <TotalsSection values={values} totals={totals} withGst={withGst} />
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-neutral-500">
            Totals appear here once every item and the tax details are filled in correctly.
          </p>
        )}

        {/* Notes and terms */}
        {values.notes.trim() || values.terms.trim() ? (
          <section className="grid gap-4 border-t pt-4 sm:grid-cols-2 print:grid-cols-2">
            {values.notes.trim() ? (
              <div className="min-w-0">
                <h3 className={sectionHeading}>
                  {isQuotation ? "Notes" : "Notes / payment details"}
                </h3>
                <Multiline value={values.notes} testId="preview-notes" />
              </div>
            ) : null}
            {values.terms.trim() ? (
              <div className="min-w-0">
                <h3 className={sectionHeading}>Terms</h3>
                <Multiline value={values.terms} testId="preview-terms" />
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Footer */}
        <footer className="flex break-inside-avoid flex-wrap items-end justify-between gap-6 border-t pt-4">
          {isQuotation ? (
            <div className="min-w-56 space-y-5 text-[11px]" data-testid="preview-acceptance">
              <p className="font-semibold text-neutral-700">Accepted by customer</p>
              {["Name", "Signature", "Date"].map((label) => (
                <div key={label} className="border-b border-neutral-400 pb-1 text-neutral-500">
                  {label}
                </div>
              ))}
            </div>
          ) : null}
          <div className="ml-auto text-right">
            <p className="font-semibold">For {values.seller.name.trim() || "your business"}</p>
            <div className="mt-10 border-t border-neutral-400 pt-1 text-[11px] text-neutral-500">
              Authorised signatory
            </div>
          </div>
          <div className="w-full space-y-1 text-[11px] text-neutral-500">
            {values.kind === "invoice" && values.gstMode === "without-gst" ? (
              <p data-testid="preview-non-gst-note">
                The supplier is not registered under GST. No GST has been charged on this invoice.
              </p>
            ) : null}
            {isQuotation && values.gstMode === "without-gst" ? (
              <p data-testid="preview-non-gst-note">
                No GST has been added to the amounts in this quotation.
              </p>
            ) : null}
            {isQuotation ? (
              <p>
                This quotation is an offer only. It is not an invoice and is not proof of payment.
              </p>
            ) : null}
            <p>All amounts are in Indian Rupees (₹) and rounded to the nearest paisa.</p>
          </div>
        </footer>
      </div>
    </article>
  );
}

/* ───────────── items ───────────── */

function ItemsTable({
  values,
  totals,
  parsedLines,
  withGst,
}: {
  values: BillingDocumentValues;
  totals: DocumentTotals | null;
  parsedLines: DocumentEvaluation["parsedLines"];
  withGst: boolean;
}) {
  const showHsn = values.lines.some((l) => l.hsnSac.trim() !== "");
  return (
    <div className="-mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
      <table className="w-full min-w-135 border-collapse text-left text-xs print:min-w-0 print:text-[10.5px]">
        <caption className="sr-only">Items</caption>
        <thead>
          <tr className="border-y bg-neutral-100 text-[11px] text-neutral-600 print:bg-neutral-100">
            <th scope="col" className="w-8 px-2 py-2 font-semibold">
              #
            </th>
            <th scope="col" className="px-2 py-2 font-semibold">
              Description
            </th>
            {showHsn ? (
              <th scope="col" className="px-2 py-2 font-semibold">
                HSN/SAC
              </th>
            ) : null}
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Rate
            </th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Discount
            </th>
            {withGst ? (
              <>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  Taxable value
                </th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">
                  GST
                </th>
              </>
            ) : null}
            <th scope="col" className="px-2 py-2 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {values.lines.map((line, index) => {
            const result: LineResult | undefined = totals?.lines[index];
            const parsed = parsedLines[index];
            return (
              <tr
                key={line.id}
                className="break-inside-avoid border-b align-top"
                data-testid="preview-line"
              >
                <td className="px-2 py-2 text-neutral-500">{index + 1}</td>
                <td className="px-2 py-2 wrap-break-word whitespace-pre-line">
                  {line.description.trim() || (
                    <span className="text-neutral-400 italic">Item description</span>
                  )}
                </td>
                {showHsn ? <td className="px-2 py-2 tabular-nums">{line.hsnSac.trim()}</td> : null}
                <td className="px-2 py-2 text-right tabular-nums">
                  {parsed ? formatQuantity(parsed.quantity) : line.quantity.trim() || "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {parsed ? formatPaise(parsed.unitPricePaise) : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {result && result.discountPaise > 0 ? (
                    <>
                      {formatPaise(result.discountPaise)}
                      {line.discountKind === "percent" ? (
                        <span className="block text-[10px] text-neutral-500">
                          {line.discountValue.trim()}%
                        </span>
                      ) : null}
                    </>
                  ) : result ? (
                    "—"
                  ) : (
                    ""
                  )}
                </td>
                {withGst ? (
                  <>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {result ? formatPaise(result.taxablePaise) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {result ? <GstCell result={result} /> : "—"}
                    </td>
                  </>
                ) : null}
                <td
                  className="px-2 py-2 text-right font-medium tabular-nums"
                  data-testid="preview-line-total"
                >
                  {result ? formatPaise(result.totalPaise) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GstCell({ result }: { result: LineResult }) {
  if (result.treatment !== "taxable" || result.rateBasisPoints === null) {
    const label = TREATMENT_OPTIONS.find((o) => o.value === result.treatment)?.label ?? "—";
    return <span className="text-neutral-500">{label}</span>;
  }
  const tax = result.cgstPaise + result.sgstPaise + result.igstPaise;
  return (
    <>
      {formatBasisPointsAsPercent(result.rateBasisPoints)}%
      <span className="block text-[10px] text-neutral-500">{formatPaise(tax)}</span>
    </>
  );
}

/* ───────────── totals ───────────── */

function TotalsSection({
  values,
  totals,
  withGst,
}: {
  values: BillingDocumentValues;
  totals: DocumentTotals;
  withGst: boolean;
}) {
  const intra = totals.supplyType?.kind === "intra-state";
  const stateTax =
    totals.supplyType?.kind === "intra-state" ? totals.supplyType.stateTaxLabel : "SGST";
  const zeroRated = totals.nonTaxableValuePaise["zero-rated-lut"];

  return (
    <section className="grid break-inside-avoid gap-6 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]">
      <div className="min-w-0 space-y-4">
        {withGst && totals.rateSummary.length > 0 ? (
          <table className="w-full border-collapse text-[11px]">
            <caption className="mb-1 text-left text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Tax summary
            </caption>
            <thead>
              <tr className="border-y bg-neutral-100 text-neutral-600">
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
                <tr key={row.rateId} className="border-b">
                  <td className="px-2 py-1.5">
                    {formatBasisPointsAsPercent(row.rateBasisPoints)}%
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatPaise(row.taxablePaise)}
                  </td>
                  {intra ? (
                    <>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatPaise(row.cgstPaise)}
                        <span className="block text-[10px] text-neutral-500">
                          @ {formatHalfRatePercent(row.rateBasisPoints)}%
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatPaise(row.sgstPaise)}
                        <span className="block text-[10px] text-neutral-500">
                          @ {formatHalfRatePercent(row.rateBasisPoints)}%
                        </span>
                      </td>
                    </>
                  ) : (
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatPaise(row.igstPaise)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {zeroRated > 0 ? (
          <p className="text-[11px] text-neutral-600" data-testid="preview-lut-note">
            {values.placeOfSupply === OUTSIDE_INDIA ? "Export" : "Supply to an SEZ"} under Letter of
            Undertaking / bond without payment of IGST: {formatPaise(zeroRated)}.
          </p>
        ) : null}

        <div>
          <h3 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Amount in words
          </h3>
          <p className="font-medium" data-testid="preview-amount-in-words">
            {amountInWords(totals.grandTotalPaise)}
          </p>
        </div>
      </div>

      <dl
        className="w-full min-w-60 space-y-1 tabular-nums sm:w-64 print:w-64"
        data-testid="preview-totals"
      >
        <TotalRow label="Subtotal" value={formatPaise(totals.grossPaise)} />
        {totals.discountPaise > 0 ? (
          <TotalRow
            label="Discount"
            value={`−${formatPaise(totals.discountPaise)}`}
            testId="preview-discount"
          />
        ) : null}
        {withGst ? (
          <>
            <TotalRow label="Taxable value" value={formatPaise(totals.taxablePaise)} />
            {intra ? (
              <>
                <TotalRow
                  label="CGST"
                  value={formatPaise(totals.cgstPaise)}
                  testId="preview-cgst"
                />
                <TotalRow
                  label={stateTax}
                  value={formatPaise(totals.sgstPaise)}
                  testId="preview-sgst"
                />
              </>
            ) : (
              <TotalRow label="IGST" value={formatPaise(totals.igstPaise)} testId="preview-igst" />
            )}
          </>
        ) : null}
        {values.roundOff ? (
          <TotalRow
            label="Round off"
            value={formatSignedPaise(totals.roundOffPaise)}
            testId="preview-round-off"
          />
        ) : null}
        <TotalRow
          label="Total"
          value={formatPaise(totals.grandTotalPaise)}
          strong
          testId="preview-grand-total"
        />
      </dl>
    </section>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
  testId,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-6",
        strong && "mt-1 border-t-2 border-neutral-900 pt-1.5 text-base font-bold",
      )}
    >
      <dt className={strong ? undefined : "text-neutral-600"}>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  );
}

/* ───────────── small pieces ───────────── */

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

function Text({
  value,
  placeholder,
  className,
  testId,
}: {
  value: string;
  placeholder: string;
  className?: string;
  testId?: string;
}) {
  const text = value.trim();
  return (
    <p className={cn("wrap-break-word", className)} data-testid={testId}>
      {text || <span className="font-normal text-neutral-400 italic">{placeholder}</span>}
    </p>
  );
}

function Multiline({ value, testId }: { value: string; testId?: string }) {
  const text = value.trim();
  return text ? (
    <p className="wrap-break-word whitespace-pre-line text-neutral-700" data-testid={testId}>
      {text}
    </p>
  ) : null;
}

function Labelled({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <p className="text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className={mono ? "font-mono" : undefined}>{value}</span>
    </p>
  );
}

function ContactLine({ phone, email }: { phone: string; email: string }): ReactNode {
  const parts = [phone.trim(), email.trim()].filter(Boolean);
  return parts.length > 0 ? (
    <p className="wrap-break-word text-neutral-700">{parts.join(" · ")}</p>
  ) : null;
}
