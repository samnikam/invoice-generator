import { Info } from "lucide-react";

import { sampleInvoice as inv } from "@/components/marketing/sample-invoice";
import { formatPaise } from "@/lib/money/format";

/**
 * Static, clearly labelled illustration of an invoice for the landing page.
 * It is not interactive and uses sample data only.
 */
export function InvoicePreview() {
  const halfRate = inv.gstRatePercent / 2;

  return (
    <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 shadow-primary/5 ring-foreground/5">
        {/* Document header */}
        <div className="flex items-start justify-between gap-4 border-b bg-muted/40 px-5 py-4 sm:px-6">
          <div>
            <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-primary uppercase">
              Tax invoice
            </p>
            <p className="mt-1 text-sm font-semibold">{inv.seller.name}</p>
            <p className="text-xs text-muted-foreground">{inv.seller.location}</p>
            <p className="font-mono text-[0.7rem] text-muted-foreground">
              GSTIN {inv.seller.gstin}
            </p>
          </div>
          <dl className="shrink-0 text-right text-xs">
            <dt className="text-muted-foreground">Invoice no.</dt>
            <dd className="font-medium">{inv.number}</dd>
            <dt className="mt-1.5 text-muted-foreground">Date</dt>
            <dd className="font-medium">{inv.date}</dd>
          </dl>
        </div>

        <div className="space-y-4 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap justify-between gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Bill to</p>
              <p className="font-medium">{inv.customer.name}</p>
              <p className="text-muted-foreground">{inv.customer.location}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Due date</p>
              <p className="font-medium">{inv.dueDate}</p>
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-xs">
            <caption className="sr-only">Sample invoice line items</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 font-medium">
                  Item
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Qty
                </th>
                <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">
                  Rate
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item) => (
                <tr key={item.description} className="border-b border-dashed last:border-0">
                  <td className="py-2.5 pr-2">
                    <span className="font-medium">{item.description}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">
                      GST {inv.gstRatePercent}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{item.quantity}</td>
                  <td className="hidden py-2.5 text-right tabular-nums sm:table-cell">
                    {formatPaise(item.ratePaise)}
                  </td>
                  <td className="py-2.5 text-right font-medium tabular-nums">
                    {formatPaise(item.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <dl className="ml-auto max-w-60 space-y-1.5 border-t pt-3 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Taxable value</dt>
              <dd className="tabular-nums">{formatPaise(inv.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">CGST @ {halfRate}%</dt>
              <dd className="tabular-nums">{formatPaise(inv.cgstPaise)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">SGST @ {halfRate}%</dt>
              <dd className="tabular-nums">{formatPaise(inv.sgstPaise)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2 text-sm font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPaise(inv.totalPaise)}</dd>
            </div>
          </dl>
          <p className="rounded-md bg-muted/60 px-3 py-2 text-[0.7rem] text-muted-foreground">
            {inv.amountInWords}
          </p>
        </div>
      </div>

      <figcaption className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="size-3.5" />
        Illustrative example with sample data — not a real business.
      </figcaption>
    </figure>
  );
}
