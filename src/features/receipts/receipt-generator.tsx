"use client";

import { useEffect, useMemo, useState } from "react";

import { DocumentWorkspace } from "@/components/documents/document-workspace";
import { DraftPanel } from "@/components/documents/draft-panel";
import { ErrorSummary } from "@/components/documents/error-summary";
import { FormSection } from "@/components/documents/form-section";
import { useDocumentForm } from "@/components/documents/use-document-form";
import { clearFormMessage, useLocalDraft } from "@/components/documents/use-local-draft";
import { AmountInput } from "@/components/forms/amount-input";
import { FormField } from "@/components/forms/form-field";
import { TextField } from "@/components/forms/text-field";
import { ProfileFillBar } from "@/components/profile/profile-fill-bar";
import { useSavedProfile } from "@/components/profile/use-saved-profile";
import { NativeSelect } from "@/components/ui/native-select";
import { todayIsoDate } from "@/lib/dates";
import { fieldDomId } from "@/lib/documents/billing-document";
import { parseReceiptDraft } from "@/lib/drafts/draft-shapes";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import { amountInWords } from "@/lib/money/amount-in-words";
import { formatPaise } from "@/lib/money/format";
import { toReceiptBusiness } from "@/lib/profile/business-profile";
import { readProfile } from "@/lib/profile/profile-storage";
import {
  createEmptyReceipt,
  evaluateReceipt,
  PAYMENT_METHODS,
  paymentMethodInfo,
  type ContactValues,
  type PaymentMethod,
  type ReceiptValues,
} from "@/lib/receipts/receipt";

import { ReceiptPreview } from "./receipt-preview";

type Party = "business" | "payer";

/** Form + live preview for a payment receipt. */
export function ReceiptGenerator() {
  const [values, setValues] = useState<ReceiptValues>(createEmptyReceipt);
  const [filledFromProfile, setFilledFromProfile] = useState(false);
  const evaluation = useMemo(() => evaluateReceipt(values), [values]);
  const ready = evaluation.issues.length === 0 && evaluation.amountPaise !== null;
  const { touch, errorFor, showSummary, summaryRef, view, setView, print, resetInteraction } =
    useDocumentForm(evaluation.errors, ready);

  // Default the payment date to today in the user's own time zone (browser only).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only default
    setValues((v) => (v.paymentDate ? v : { ...v, paymentDate: todayIsoDate() }));
  }, []);

  // Optional draft saved in this browser (opt-in). Restored after the date default above.
  const draft = useLocalDraft({
    kind: "receipt",
    values,
    parse: parseReceiptDraft,
    restore: setValues,
    // Only when no draft was restored: fill a new receipt from the saved profile
    // (contact details only — never GSTIN or state).
    onNoDraft: () => {
      const profile = readProfile(getBrowserStorage());
      if (profile.status !== "loaded") return;
      setValues((v) => ({ ...v, business: toReceiptBusiness(profile.profile) }));
      setFilledFromProfile(true);
    },
  });
  const savedProfile = useSavedProfile();

  /** Replaces only the business contact fields with the saved profile, after confirmation. */
  function applyProfileDetails() {
    const profile = readProfile(getBrowserStorage());
    if (profile.status !== "loaded") {
      savedProfile.refresh();
      return;
    }
    const confirmed = window.confirm(
      "Replace the business name, address, phone and email in this receipt with your saved business profile? Other details are not changed.",
    );
    if (!confirmed) return;
    setValues((v) => ({ ...v, business: toReceiptBusiness(profile.profile) }));
    setFilledFromProfile(true);
  }

  const set = <K extends keyof ReceiptValues>(key: K, value: ReceiptValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setContact = (party: Party, field: keyof ContactValues, value: string) =>
    setValues((v) => ({ ...v, [party]: { ...v[party], [field]: value } }));

  function clearForm() {
    if (!window.confirm(clearFormMessage("receipt", draft.enabled))) return;
    setValues({ ...createEmptyReceipt(), paymentDate: todayIsoDate() });
    setFilledFromProfile(false);
    resetInteraction();
  }

  const text = (
    field: string,
    label: string,
    value: string,
    onValueChange: (value: string) => void,
    options: Omit<
      Parameters<typeof TextField>[0],
      "id" | "label" | "value" | "onValueChange" | "onBlur" | "error"
    > = {},
  ) => (
    <TextField
      id={fieldDomId(field)}
      label={label}
      value={value}
      onValueChange={(v) => {
        onValueChange(v);
        // Dates are picked, not typed, so check them as soon as they change.
        if (options.type === "date") touch(field);
      }}
      onBlur={() => touch(field)}
      error={errorFor(field)}
      {...options}
    />
  );

  const money = (
    field: "amount" | "documentTotal" | "previouslyPaid",
    label: string,
    hint?: string,
    optional = false,
  ) => (
    <FormField
      id={fieldDomId(field)}
      label={label}
      hint={hint}
      optional={optional}
      error={errorFor(field)}
    >
      {(control) => (
        <AmountInput
          {...control}
          unit="₹"
          placeholder="0.00"
          value={values[field]}
          onChange={(e) => set(field, e.target.value)}
          onBlur={() => touch(field)}
        />
      )}
    </FormField>
  );

  const contactFields = (party: Party, nameLabel: string, addressOptional: boolean) => {
    const c = values[party];
    const key = (f: string) => `${party}.${f}`;
    return (
      <>
        {text(key("name"), nameLabel, c.name, (v) => setContact(party, "name", v), {
          autoComplete: "organization",
        })}
        {text(key("address"), "Address", c.address, (v) => setContact(party, "address", v), {
          multiline: true,
          optional: addressOptional,
          autoComplete: "street-address",
        })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text(key("phone"), "Phone", c.phone, (v) => setContact(party, "phone", v), {
            optional: true,
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
          })}
          {text(key("email"), "Email", c.email, (v) => setContact(party, "email", v), {
            optional: true,
            type: "email",
            inputMode: "email",
            autoComplete: "email",
          })}
        </div>
      </>
    );
  };

  const method = paymentMethodInfo(values.method);

  const form = (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5"
      aria-label="Receipt details"
    >
      {showSummary ? (
        <ErrorSummary ref={summaryRef} issues={evaluation.issues} domId={fieldDomId} />
      ) : null}

      <FormSection title="Your business">
        <ProfileFillBar
          saved={savedProfile}
          filledFromProfile={filledFromProfile}
          documentNoun="receipt"
          onUseProfile={applyProfileDetails}
        />
        {contactFields("business", "Business name", true)}
      </FormSection>

      <FormSection title="Receipt details">
        <div className="grid gap-4 sm:grid-cols-2">
          {text(
            "receiptNumber",
            "Receipt number",
            values.receiptNumber,
            (v) => set("receiptNumber", v),
            {
              placeholder: "e.g. RCPT-2026/001",
              hint: "Up to 16 characters. Use a new, unique number for every receipt.",
            },
          )}
          {text("paymentDate", "Payment date", values.paymentDate, (v) => set("paymentDate", v), {
            type: "date",
          })}
        </div>
      </FormSection>

      <FormSection title="Received from">{contactFields("payer", "Payer name", true)}</FormSection>

      <FormSection title="Payment">
        <div className="grid gap-4 sm:grid-cols-2">
          {money("amount", "Amount received", "The amount actually received in this payment.")}
          <FormField id={fieldDomId("method")} label="Payment method" error={errorFor("method")}>
            {(control) => (
              <NativeSelect
                {...control}
                value={values.method}
                onChange={(e) => {
                  set("method", e.target.value as PaymentMethod | "");
                  touch("method");
                }}
              >
                <option value="">Select method</option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
        {evaluation.amountPaise !== null ? (
          <p className="rounded-lg bg-muted/60 p-3 text-sm" aria-live="polite">
            <span className="text-muted-foreground">In words: </span>
            <span className="font-medium" data-testid="form-amount-in-words">
              {amountInWords(evaluation.amountPaise)}
            </span>
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {text(
            "reference",
            method?.referenceLabel ?? "Reference",
            values.reference,
            (v) => set("reference", v),
            { optional: true, placeholder: "e.g. transaction or cheque number" },
          )}
          {text(
            "againstDocument",
            "Invoice or quotation number",
            values.againstDocument,
            (v) => set("againstDocument", v),
            { optional: true, placeholder: "e.g. INV-2026/001" },
          )}
        </div>
        {text("note", "Note", values.note, (v) => set("note", v), {
          multiline: true,
          optional: true,
          placeholder: "e.g. Advance for website project",
        })}
      </FormSection>

      <FormSection title="Balance (optional)">
        <p className="text-sm text-muted-foreground">
          To show what is still owed, enter the total of the invoice being paid and anything paid
          before this receipt. Leave both empty to skip this.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {money("documentTotal", "Invoice total", undefined, true)}
          {money("previouslyPaid", "Previously paid", "Before this payment.", true)}
        </div>
        {evaluation.balance ? (
          <div className="flex items-baseline justify-between rounded-lg bg-muted/60 p-4">
            <span className="text-sm font-medium">
              {evaluation.balance.outcome === "overpaid" ? "Received in excess" : "Balance due"}
            </span>
            <span className="text-xl font-semibold tabular-nums" data-testid="form-balance">
              {evaluation.balance.outcome === "overpaid"
                ? formatPaise(evaluation.balance.excessPaise)
                : evaluation.balance.outcome === "paid-in-full"
                  ? "Nil — paid in full"
                  : formatPaise(evaluation.balance.balanceDuePaise)}
            </span>
          </div>
        ) : null}
      </FormSection>
    </form>
  );

  return (
    <DocumentWorkspace
      title="New payment receipt"
      description="Fill in the payment details and the receipt preview updates as you type."
      documentNoun="receipt"
      view={view}
      onViewChange={setView}
      onClear={clearForm}
      onPrint={() => print(`Receipt ${values.receiptNumber.trim()}`)}
      draftPanel={<DraftPanel draft={draft} documentNoun="receipt" />}
      form={form}
      preview={<ReceiptPreview values={values} evaluation={evaluation} />}
    />
  );
}
