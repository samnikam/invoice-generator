"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, Eraser, Info, Printer } from "lucide-react";
import { cn } from "cn";

import { FormField } from "@/components/forms/form-field";
import { ProvisionalRateNotice, StateSelect } from "@/components/forms/tax-selects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayIsoDate } from "@/lib/dates";
import {
  createEmptyInvoice,
  createEmptyLine,
  evaluateInvoice,
  fieldDomId,
  type InvoiceDocumentType,
  type InvoiceFormValues,
  type InvoiceLineValues,
  type PartyValues,
} from "@/lib/invoices/invoice-form";
import { formatPaise } from "@/lib/money/format";

import { InvoicePreview } from "./invoice-preview";
import { LineItemsEditor } from "./line-items-editor";

const DOCUMENT_TYPES: readonly { value: InvoiceDocumentType; title: string; hint: string }[] = [
  {
    value: "tax-invoice",
    title: "Tax invoice",
    hint: "I am registered for GST and charging GST on this sale.",
  },
  {
    value: "non-gst-invoice",
    title: "Invoice without GST",
    hint: "I am not registered for GST, so I cannot charge GST.",
  },
];

type Section = "seller" | "customer";

export function InvoiceGenerator() {
  const [values, setValues] = useState<InvoiceFormValues>(createEmptyInvoice);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const nextLineId = useRef(2);
  const focusLineId = useRef<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const evaluation = useMemo(() => evaluateInvoice(values), [values]);
  const isTaxInvoice = values.documentType === "tax-invoice";

  // Default the invoice date to today in the user's own time zone (browser only).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only default
    setValues((v) => (v.invoiceDate ? v : { ...v, invoiceDate: todayIsoDate() }));
  }, []);

  // After "Add item", move keyboard focus to the new item's description.
  useEffect(() => {
    if (!focusLineId.current) return;
    document.getElementById(fieldDomId(`lines.${focusLineId.current}.description`))?.focus();
    focusLineId.current = null;
  }, [values.lines.length]);

  const touch = (field: string) =>
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  const errorFor = (field: string) =>
    showAllErrors || touched.has(field) ? evaluation.errors[field] : undefined;

  const set = <K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setParty = (section: Section, field: keyof PartyValues | "stateCode", value: string) =>
    setValues((v) => ({ ...v, [section]: { ...v[section], [field]: value } }));
  const updateLine = (id: string, patch: Partial<InvoiceLineValues>) =>
    setValues((v) => ({ ...v, lines: v.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const addLine = () => {
    const id = `line-${nextLineId.current++}`;
    focusLineId.current = id;
    setValues((v) => ({ ...v, lines: [...v.lines, createEmptyLine(id)] }));
  };
  const removeLine = (id: string) =>
    setValues((v) =>
      v.lines.length <= 1 ? v : { ...v, lines: v.lines.filter((l) => l.id !== id) },
    );

  function clearForm() {
    if (!window.confirm("Clear all invoice details? This cannot be undone.")) return;
    nextLineId.current = 2;
    setValues({ ...createEmptyInvoice(), invoiceDate: todayIsoDate() });
    setTouched(new Set());
    setShowAllErrors(false);
  }

  function printInvoice() {
    if (evaluation.issues.length > 0 || !evaluation.totals) {
      setShowAllErrors(true);
      setView("edit");
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    // The browser suggests the page title as the PDF file name.
    const previousTitle = document.title;
    document.title = `Invoice ${values.invoiceNumber.trim()}`;
    window.print();
    document.title = previousTitle;
  }

  /* ───────────── field helpers ───────────── */

  const text = (
    field: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: {
      optional?: boolean;
      hint?: ReactNode;
      multiline?: boolean;
      type?: string;
      autoComplete?: string;
      placeholder?: string;
      inputMode?: "text" | "tel" | "email";
    } = {},
  ) => (
    <FormField
      id={fieldDomId(field)}
      label={label}
      optional={options.optional}
      hint={options.hint}
      error={errorFor(field)}
    >
      {(control) =>
        options.multiline ? (
          <Textarea
            {...control}
            rows={2}
            value={value}
            placeholder={options.placeholder}
            autoComplete={options.autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => touch(field)}
          />
        ) : (
          <Input
            {...control}
            type={options.type ?? "text"}
            inputMode={options.inputMode}
            className="h-10"
            value={value}
            placeholder={options.placeholder}
            autoComplete={options.autoComplete}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => touch(field)}
          />
        )
      }
    </FormField>
  );

  const partyFields = (section: Section, prefix: "Business" | "Customer") => {
    const p = values[section];
    const key = (f: string) => `${section}.${f}`;
    return (
      <>
        {text(
          key("name"),
          prefix === "Business" ? "Business name" : "Customer name",
          p.name,
          (v) => setParty(section, "name", v),
          { autoComplete: "organization" },
        )}
        {text(
          key("address"),
          prefix === "Business" ? "Business address" : "Customer address",
          p.address,
          (v) => setParty(section, "address", v),
          { multiline: true, optional: section === "customer", autoComplete: "street-address" },
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {text(key("phone"), "Phone", p.phone, (v) => setParty(section, "phone", v), {
            optional: true,
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
          })}
          {text(key("email"), "Email", p.email, (v) => setParty(section, "email", v), {
            optional: true,
            type: "email",
            inputMode: "email",
            autoComplete: "email",
          })}
        </div>
      </>
    );
  };

  /* ───────────── form ───────────── */

  const showSummary = showAllErrors && evaluation.issues.length > 0;

  const form = (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5"
      aria-label="Invoice details"
    >
      {showSummary ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
        >
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            Please fix {evaluation.issues.length}{" "}
            {evaluation.issues.length === 1 ? "problem" : "problems"} before printing
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {evaluation.issues.map((issue) => (
              <li key={issue.field}>
                <a
                  href={`#${fieldDomId(issue.field)}`}
                  className="underline underline-offset-2 hover:text-destructive"
                  onClick={(e) => {
                    const target = document.getElementById(fieldDomId(issue.field));
                    if (target) {
                      e.preventDefault();
                      target.focus();
                      target.scrollIntoView({ block: "center" });
                    }
                  }}
                >
                  {issue.label}
                </a>
                : {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Section title="Invoice type">
        <div
          role="radiogroup"
          aria-labelledby="section-invoice-type"
          aria-describedby={
            errorFor("documentType") ? `${fieldDomId("documentType")}-error` : undefined
          }
          className="grid gap-3 sm:grid-cols-2"
        >
          {DOCUMENT_TYPES.map((type, index) => (
            <label
              key={type.value}
              className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent/50"
            >
              <input
                type="radio"
                name="document-type"
                id={index === 0 ? fieldDomId("documentType") : undefined}
                value={type.value}
                checked={values.documentType === type.value}
                onChange={() => {
                  set("documentType", type.value);
                  touch("documentType");
                }}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">{type.title}</span>
                <span className="block text-xs text-muted-foreground">{type.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errorFor("documentType") ? (
          <p id={`${fieldDomId("documentType")}-error`} className="text-sm text-destructive">
            {errorFor("documentType")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          A bill of supply (for composition-scheme or exempt-only businesses) is not available yet.
        </p>
      </Section>

      <Section title="Your business">
        {partyFields("seller", "Business")}
        {isTaxInvoice ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id={fieldDomId("seller.stateCode")}
              label="State of registration"
              error={errorFor("seller.stateCode")}
            >
              {(control) => (
                <StateSelect
                  {...control}
                  placeholder="Select state"
                  value={values.seller.stateCode}
                  onChange={(v) => {
                    setParty("seller", "stateCode", v);
                    touch("seller.stateCode");
                  }}
                />
              )}
            </FormField>
            {text(
              "seller.gstin",
              "GSTIN",
              values.seller.gstin,
              (v) => setParty("seller", "gstin", v),
              {
                placeholder: "15 characters",
                hint: "Checked for format only — not whether it is registered or active.",
              },
            )}
          </div>
        ) : null}
      </Section>

      <Section title="Customer">
        {partyFields("customer", "Customer")}
        {text(
          "customer.gstin",
          "Customer GSTIN",
          values.customer.gstin,
          (v) => setParty("customer", "gstin", v),
          {
            optional: true,
            placeholder: "If the customer is GST-registered",
          },
        )}
      </Section>

      <Section title="Invoice details">
        <div className="grid gap-4 sm:grid-cols-3">
          {text(
            "invoiceNumber",
            "Invoice number",
            values.invoiceNumber,
            (v) => set("invoiceNumber", v),
            {
              placeholder: "e.g. INV-2026/001",
              hint: "Up to 16 characters. Use a new, unique number for every invoice.",
            },
          )}
          {text("invoiceDate", "Invoice date", values.invoiceDate, (v) => set("invoiceDate", v), {
            type: "date",
          })}
          {text("dueDate", "Due date", values.dueDate, (v) => set("dueDate", v), {
            type: "date",
            optional: true,
          })}
        </div>
        {isTaxInvoice ? (
          <div className="space-y-3">
            <FormField
              id={fieldDomId("placeOfSupply")}
              label="Place of supply"
              hint="Decides CGST + SGST/UTGST or IGST. For a GST-registered customer this is often their state — check the GST rules for your supply."
              error={errorFor("placeOfSupply")}
            >
              {(control) => (
                <StateSelect
                  {...control}
                  includeOutsideIndia
                  placeholder="Select place of supply"
                  value={values.placeOfSupply}
                  onChange={(v) => {
                    set("placeOfSupply", v);
                    touch("placeOfSupply");
                  }}
                />
              )}
            </FormField>
            <div className="flex items-start gap-2.5">
              <input
                id="invoice-sez"
                type="checkbox"
                checked={values.recipientIsSez}
                onChange={(e) => set("recipientIsSez", e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <Label htmlFor="invoice-sez" className="leading-snug font-normal">
                The customer is an SEZ unit or developer (supplies to an SEZ are inter-state)
              </Label>
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Items">
        {isTaxInvoice ? <ProvisionalRateNotice /> : null}
        <LineItemsEditor
          lines={values.lines}
          isTaxInvoice={isTaxInvoice}
          totals={evaluation.totals}
          errorFor={errorFor}
          onChange={updateLine}
          onTouch={touch}
          onAdd={addLine}
          onRemove={removeLine}
        />
      </Section>

      <Section title="Total">
        <div className="flex items-start gap-2.5">
          <input
            id="invoice-round-off"
            type="checkbox"
            checked={values.roundOff}
            onChange={(e) => set("roundOff", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <Label htmlFor="invoice-round-off" className="leading-snug font-normal">
            Round the total to the nearest rupee (the difference is shown as “Round off”)
          </Label>
        </div>
        <div className="flex items-baseline justify-between rounded-lg bg-muted/60 p-4">
          <span className="text-sm font-medium">Invoice total</span>
          <span className="text-xl font-semibold tabular-nums" data-testid="form-grand-total">
            {evaluation.totals ? formatPaise(evaluation.totals.grandTotalPaise) : "—"}
          </span>
        </div>
      </Section>

      <Section title="Notes and terms">
        {text("notes", "Notes or payment details", values.notes, (v) => set("notes", v), {
          multiline: true,
          optional: true,
          placeholder: "e.g. Bank account, UPI ID, or a thank-you note",
        })}
        {text("terms", "Terms", values.terms, (v) => set("terms", v), {
          multiline: true,
          optional: true,
          placeholder: "e.g. Payment due within 15 days",
        })}
      </Section>
    </form>
  );

  return (
    <div className="space-y-6" data-wide-page>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New invoice</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Fill in the details and the invoice preview updates as you type.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="lg" onClick={clearForm}>
            <Eraser data-icon="inline-start" />
            Clear form
          </Button>
          <Button type="button" size="lg" onClick={printInvoice}>
            <Printer data-icon="inline-start" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <p className="flex gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground print:hidden">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Details stay in this browser tab only. Nothing is saved or uploaded, and refreshing the page
        clears the form. To save a PDF, choose “Save as PDF” in the print window.
      </p>

      <div
        role="group"
        aria-label="Show"
        className="inline-flex rounded-lg bg-muted p-1 2xl:hidden print:hidden"
      >
        {(["edit", "preview"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            onClick={() => setView(option)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              view === option
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "edit" ? "Edit details" : "Preview invoice"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] print:block">
        <div
          className={cn(
            "max-w-3xl min-w-0 2xl:max-w-none print:hidden",
            view === "preview" && "hidden 2xl:block",
          )}
        >
          {form}
        </div>
        <div
          className={cn(
            "min-w-0 2xl:sticky 2xl:top-20 print:static print:block",
            view === "edit" && "hidden 2xl:block",
          )}
        >
          <InvoicePreview values={values} evaluation={evaluation} />
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border bg-card p-5 shadow-xs">
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
