import { cn } from "cn";

import { formatDisplayDate } from "@/lib/dates";
import { amountInWords } from "@/lib/money/amount-in-words";
import { formatPaise } from "@/lib/money/format";
import {
  paymentMethodInfo,
  type ContactValues,
  type ReceiptBalance,
  type ReceiptEvaluation,
  type ReceiptValues,
} from "@/lib/receipts/receipt";

/**
 * The payment receipt document: live preview and printed / "Save as PDF" page.
 * Like the invoice, it uses fixed black-on-white colours so it prints plainly.
 * It acknowledges only the amount actually received, and states that it is not a
 * tax invoice.
 */
export function ReceiptPreview({
  values,
  evaluation,
}: {
  values: ReceiptValues;
  evaluation: ReceiptEvaluation;
}) {
  const amount = evaluation.amountPaise;
  const method = paymentMethodInfo(values.method);
  const complete = evaluation.issues.length === 0 && amount !== null;
  const payerName = values.payer.name.trim();
  const reference = values.reference.trim();
  const against = values.againstDocument.trim();
  const heading = "text-[11px] font-semibold tracking-wider text-neutral-500 uppercase";

  return (
    <article
      aria-label="Payment receipt preview"
      data-testid="receipt-preview"
      className="rounded-xl border bg-white text-[13px] leading-relaxed text-neutral-900 shadow-sm print:rounded-none print:border-0 print:text-[11px] print:shadow-none"
    >
      {!complete ? (
        <p className="rounded-t-xl border-b bg-muted px-5 py-2 text-xs text-muted-foreground print:hidden">
          Preview — fill in the highlighted details to complete this receipt.
        </p>
      ) : null}

      <div className="space-y-6 p-5 sm:p-8 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-lg font-bold tracking-wide uppercase">Payment Receipt</h2>
            <Contact contact={values.business} placeholder="Your business name" strong />
          </div>
          <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right">
            <dt className="text-neutral-500">Receipt no.</dt>
            <dd className="font-semibold" data-testid="preview-receipt-number">
              {values.receiptNumber.trim() || "—"}
            </dd>
            <dt className="text-neutral-500">Payment date</dt>
            <dd>{values.paymentDate ? formatDisplayDate(values.paymentDate) : "—"}</dd>
          </dl>
        </header>

        {/* Acknowledgement */}
        <section className="space-y-3 rounded-lg bg-neutral-50 p-4 print:bg-neutral-50">
          <p className="text-[15px] leading-relaxed" data-testid="preview-acknowledgement">
            Received with thanks from{" "}
            <strong>{payerName || <Placeholder text="payer name" />}</strong> the sum of{" "}
            <strong data-testid="preview-amount">
              {amount !== null ? formatPaise(amount) : <Placeholder text="amount" />}
            </strong>
            {method ? (
              <>
                {" "}
                by <strong>{method.label}</strong>
              </>
            ) : null}
            {against ? (
              <>
                {" "}
                towards <strong>{against}</strong>
              </>
            ) : null}
            .
          </p>
          {amount !== null ? (
            <p data-testid="preview-amount-in-words">
              <span className="text-neutral-500">Amount in words: </span>
              <span className="font-medium">{amountInWords(amount)}</span>
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          <div className="min-w-0 space-y-0.5">
            <h3 className={heading}>Received from</h3>
            <Contact contact={values.payer} placeholder="Payer name" testId="preview-payer" />
          </div>
          <dl className="space-y-1 text-right" data-testid="preview-payment-details">
            <Row label="Payment method" value={method?.label ?? "—"} />
            {reference ? (
              <Row label={method?.referenceLabel ?? "Reference"} value={reference} />
            ) : null}
            {against ? <Row label="For invoice / quotation" value={against} /> : null}
          </dl>
        </section>

        {evaluation.balance ? <BalanceSection balance={evaluation.balance} /> : null}

        {values.note.trim() ? (
          <section className="border-t pt-4">
            <h3 className={heading}>Note</h3>
            <p className="wrap-break-word whitespace-pre-line" data-testid="preview-note">
              {values.note.trim()}
            </p>
          </section>
        ) : null}

        <footer className="flex break-inside-avoid flex-wrap items-end justify-between gap-6 border-t pt-4">
          <p
            className="max-w-sm text-[11px] text-neutral-500"
            data-testid="preview-receipt-disclaimer"
          >
            This receipt acknowledges the payment shown above. It is not a tax invoice.
          </p>
          <div className="ml-auto text-right">
            <p className="font-semibold">For {values.business.name.trim() || "your business"}</p>
            <div className="mt-10 border-t border-neutral-400 pt-1 text-[11px] text-neutral-500">
              Authorised signatory
            </div>
          </div>
        </footer>
      </div>
    </article>
  );
}

function BalanceSection({ balance }: { balance: ReceiptBalance }) {
  return (
    <section className="ml-auto w-full max-w-xs break-inside-avoid" data-testid="preview-balance">
      <h3 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        Account summary
      </h3>
      <dl className="mt-1 space-y-1 tabular-nums">
        <Row label="Invoice total" value={formatPaise(balance.documentTotalPaise)} />
        <Row label="Paid earlier" value={formatPaise(balance.previouslyPaidPaise)} />
        <Row label="This payment" value={formatPaise(balance.thisPaymentPaise)} />
        <Row label="Total paid" value={formatPaise(balance.totalPaidPaise)} />
        {balance.outcome === "balance-due" ? (
          <Row
            label="Balance due"
            value={formatPaise(balance.balanceDuePaise)}
            strong
            testId="preview-balance-due"
          />
        ) : balance.outcome === "paid-in-full" ? (
          <Row label="Balance due" value="Nil — paid in full" strong testId="preview-balance-due" />
        ) : (
          <Row
            label="Received in excess"
            value={formatPaise(balance.excessPaise)}
            strong
            testId="preview-excess"
          />
        )}
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
  label: string;
  value: string;
  strong?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-6",
        strong && "mt-1 border-t-2 border-neutral-900 pt-1.5 font-bold",
      )}
    >
      <dt className={strong ? undefined : "text-neutral-600"}>{label}</dt>
      <dd className="text-right wrap-break-word" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function Contact({
  contact,
  placeholder,
  strong = false,
  testId,
}: {
  contact: ContactValues;
  placeholder: string;
  strong?: boolean;
  testId?: string;
}) {
  const name = contact.name.trim();
  const extras = [contact.phone.trim(), contact.email.trim()].filter(Boolean);
  return (
    <>
      <p
        className={cn("wrap-break-word", strong ? "text-base font-semibold" : "font-semibold")}
        data-testid={testId}
      >
        {name || <Placeholder text={placeholder} />}
      </p>
      {contact.address.trim() ? (
        <p className="wrap-break-word whitespace-pre-line text-neutral-700">
          {contact.address.trim()}
        </p>
      ) : null}
      {extras.length > 0 ? (
        <p className="wrap-break-word text-neutral-700">{extras.join(" · ")}</p>
      ) : null}
    </>
  );
}

function Placeholder({ text }: { text: string }) {
  return <span className="font-normal text-neutral-400 italic">{text}</span>;
}
