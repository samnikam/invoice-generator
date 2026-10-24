import { CheckCircle2, Info, Printer, ReceiptIndianRupee } from "lucide-react";

import { sampleInvoice as inv } from "@/components/marketing/sample-invoice";
import { formatPaise } from "@/lib/money/format";

/**
 * Static, clearly labelled illustration of an invoice for the landing page.
 * It is not interactive and uses sample data only. The window frame and floating
 * cards are decoration (hidden from screen readers); their figures come from the
 * same sample data.
 */
export function InvoicePreview() {
  const halfRate = inv.gstRatePercent / 2;

  return (
    <figure className="relative mx-auto w-full max-w-xl lg:max-w-none">
      {/* Soft glow behind the window */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-linear-to-br from-primary/20 via-info/10 to-primary-deep/20 blur-2xl"
      />

      <div className="relative">
        <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl ring-1 shadow-primary/15 ring-foreground/5">
          {/* App window bar */}
          <div
            aria-hidden="true"
            className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5"
          >
            <span className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-warning" />
              <span className="size-2.5 rounded-full bg-success/70" />
            </span>
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-card px-3 py-1 text-[0.7rem] text-muted-foreground shadow-xs">
              <ReceiptIndianRupee className="size-3 text-primary" />
              SmartBill · New invoice
            </span>
            <span className="hidden w-10 sm:block" />
          </div>

          {/* Document header */}
          <div className="flex items-start justify-between gap-4 border-b bg-linear-to-r from-accent/70 to-card px-5 py-4 sm:px-6">
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
                <tr className="bg-primary text-left text-primary-foreground">
                  <th scope="col" className="rounded-l-md px-2 py-2 font-medium">
                    Item
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Qty
                  </th>
                  <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                    Rate
                  </th>
                  <th scope="col" className="rounded-r-md px-2 py-2 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((item) => (
                  <tr key={item.description} className="border-b border-dashed last:border-0">
                    <td className="px-2 py-2.5">
                      <span className="font-medium">{item.description}</span>
                      <span className="block text-[0.7rem] text-muted-foreground">
                        GST {inv.gstRatePercent}%
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{item.quantity}</td>
                    <td className="hidden px-2 py-2.5 text-right tabular-nums sm:table-cell">
                      {formatPaise(item.ratePaise)}
                    </td>
                    <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                      {formatPaise(item.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <dl className="ml-auto max-w-64 space-y-1.5 border-t pt-3 text-xs">
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
              <div className="mt-2.5! flex justify-between gap-4 rounded-md bg-primary px-2.5 py-2 text-sm font-semibold text-primary-foreground">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPaise(inv.totalPaise)}</dd>
              </div>
            </dl>
            <p className="rounded-md bg-muted/60 px-3 py-2 text-[0.7rem] text-muted-foreground">
              {inv.amountInWords}
            </p>
          </div>
        </div>

        {/* Floating cards (decoration; wider screens only). Placed over empty space only. */}
        <div
          aria-hidden="true"
          className="absolute bottom-[4.75rem] -left-5 hidden items-center gap-2.5 rounded-xl border bg-card/95 px-3.5 py-2.5 shadow-card-hover backdrop-blur sm:flex lg:-left-9"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-success/15 text-success">
            <CheckCircle2 className="size-4.5" />
          </span>
          <span className="text-xs leading-tight">
            <span className="block font-semibold">Intra-state supply</span>
            <span className="text-muted-foreground">
              CGST + SGST{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatPaise(inv.cgstPaise + inv.sgstPaise)}
              </span>
            </span>
          </span>
        </div>
        <div
          aria-hidden="true"
          className="absolute -top-4 right-6 hidden items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs font-medium shadow-card-hover backdrop-blur sm:flex"
        >
          <Printer className="size-3.5 text-info" />
          Print or save as PDF
        </div>
      </div>

      <figcaption className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Info aria-hidden="true" className="size-3.5" />
        Illustrative example with sample data — not a real business.
      </figcaption>
    </figure>
  );
}
