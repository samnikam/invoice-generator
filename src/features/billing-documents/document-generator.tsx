"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DocumentWorkspace } from "@/components/documents/document-workspace";
import { DraftPanel } from "@/components/documents/draft-panel";
import { ErrorSummary } from "@/components/documents/error-summary";
import { FormSection, sectionHeadingId } from "@/components/documents/form-section";
import { useDocumentForm } from "@/components/documents/use-document-form";
import { clearFormMessage, useLocalDraft } from "@/components/documents/use-local-draft";
import { FormField } from "@/components/forms/form-field";
import { ProvisionalRateNotice, StateSelect } from "@/components/forms/tax-selects";
import { TextField } from "@/components/forms/text-field";
import { ProfileFillBar } from "@/components/profile/profile-fill-bar";
import { useSavedProfile } from "@/components/profile/use-saved-profile";
import { Label } from "@/components/ui/label";
import { todayIsoDate } from "@/lib/dates";
import {
  createEmptyDocument,
  createEmptyLine,
  DOCUMENT_KINDS,
  evaluateDocument,
  fieldDomId,
  showsSellerGstin,
  type BillingDocumentKind,
  type BillingDocumentValues,
  type LineValues,
  type PartyValues,
} from "@/lib/documents/billing-document";
import { nextLineNumber, parseBillingDocumentDraft } from "@/lib/drafts/draft-shapes";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import { formatPaise } from "@/lib/money/format";
import { toSellerFields } from "@/lib/profile/business-profile";
import { readProfile } from "@/lib/profile/profile-storage";

import { DocumentPreview } from "./document-preview";
import { LineItemsEditor } from "./line-items-editor";

type Section = "seller" | "customer";

const NOTES_PLACEHOLDERS: Record<BillingDocumentKind, { notes: string; terms: string }> = {
  invoice: {
    notes: "e.g. Bank account, UPI ID, or a thank-you note",
    terms: "e.g. Payment due within 15 days",
  },
  quotation: {
    notes: "e.g. Delivery time, or what is included in the price",
    terms: "e.g. 50% advance with order, balance on delivery",
  },
};

/** Form + live preview for an itemised document: an invoice or a quotation. */
export function BillingDocumentGenerator({ kind }: { kind: BillingDocumentKind }) {
  const config = DOCUMENT_KINDS[kind];
  const [values, setValues] = useState<BillingDocumentValues>(() => createEmptyDocument(kind));
  const nextLineId = useRef(2);
  const [filledFromProfile, setFilledFromProfile] = useState(false);
  const focusLineId = useRef<string | null>(null);

  const evaluation = useMemo(() => evaluateDocument(values), [values]);
  const ready = evaluation.issues.length === 0 && evaluation.totals !== null;
  const { touch, errorFor, showSummary, summaryRef, view, setView, print, resetInteraction } =
    useDocumentForm(evaluation.errors, ready);
  const withGst = values.gstMode === "with-gst";

  // Default the issue date to today in the user's own time zone (browser only).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only default
    setValues((v) => (v.issueDate ? v : { ...v, issueDate: todayIsoDate() }));
  }, []);

  // Optional draft saved in this browser (opt-in). Restored after the date default above.
  const draft = useLocalDraft({
    kind,
    values,
    parse: (raw) => parseBillingDocumentDraft(raw, kind),
    restore: (saved) => {
      nextLineId.current = nextLineNumber(saved.lines);
      setValues(saved);
    },
    // Only when no draft was restored: fill a new document from the saved profile.
    onNoDraft: () => {
      const profile = readProfile(getBrowserStorage());
      if (profile.status !== "loaded") return;
      setValues((v) => ({ ...v, seller: toSellerFields(profile.profile) }));
      setFilledFromProfile(true);
    },
  });
  const savedProfile = useSavedProfile();

  /** Replaces only the business fields with the saved profile, after confirmation. */
  function applyProfileDetails() {
    const profile = readProfile(getBrowserStorage());
    if (profile.status !== "loaded") {
      savedProfile.refresh();
      return;
    }
    const confirmed = window.confirm(
      `Replace the business name, address, phone, email, GSTIN and state in this ${config.noun} with your saved business profile? Customer, items and other details are not changed.`,
    );
    if (!confirmed) return;
    setValues((v) => ({ ...v, seller: toSellerFields(profile.profile) }));
    setFilledFromProfile(true);
  }

  // After "Add item", move keyboard focus to the new item's description.
  useEffect(() => {
    if (!focusLineId.current) return;
    document.getElementById(fieldDomId(`lines.${focusLineId.current}.description`))?.focus();
    focusLineId.current = null;
  }, [values.lines.length]);

  const set = <K extends keyof BillingDocumentValues>(key: K, value: BillingDocumentValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setParty = (section: Section, field: keyof PartyValues | "stateCode", value: string) =>
    setValues((v) => ({ ...v, [section]: { ...v[section], [field]: value } }));
  const updateLine = (id: string, patch: Partial<LineValues>) =>
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
    if (!window.confirm(clearFormMessage(config.noun, draft.enabled))) return;
    nextLineId.current = 2;
    setValues({ ...createEmptyDocument(kind), issueDate: todayIsoDate() });
    setFilledFromProfile(false);
    resetInteraction();
  }

  /** Text field bound to a form key, with touch-on-blur and its error. */
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

  const partyFields = (section: Section) => {
    const p = values[section];
    const key = (f: string) => `${section}.${f}`;
    const isSeller = section === "seller";
    return (
      <>
        {text(
          key("name"),
          isSeller ? "Business name" : "Customer name",
          p.name,
          (v) => setParty(section, "name", v),
          { autoComplete: "organization" },
        )}
        {text(
          key("address"),
          isSeller ? "Business address" : "Customer address",
          p.address,
          (v) => setParty(section, "address", v),
          { multiline: true, optional: !isSeller, autoComplete: "street-address" },
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

  const endDate = config.endDate;

  const formContent = (
    <form
      noValidate
      onSubmit={(e) => e.preventDefault()}
      className="space-y-5"
      aria-label={`${config.Noun} details`}
    >
      {showSummary ? (
        <ErrorSummary ref={summaryRef} issues={evaluation.issues} domId={fieldDomId} />
      ) : null}

      <FormSection title={config.typeLabel}>
        <div
          role="radiogroup"
          aria-labelledby={sectionHeadingId(config.typeLabel)}
          aria-describedby={errorFor("gstMode") ? `${fieldDomId("gstMode")}-error` : undefined}
          className="grid gap-3 sm:grid-cols-2"
        >
          {config.gstModes.map((mode, index) => (
            <label
              key={mode.value}
              className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent/50"
            >
              <input
                type="radio"
                name="gst-mode"
                id={index === 0 ? fieldDomId("gstMode") : undefined}
                value={mode.value}
                checked={values.gstMode === mode.value}
                onChange={() => {
                  set("gstMode", mode.value);
                  touch("gstMode");
                }}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">{mode.title}</span>
                <span className="block text-xs text-muted-foreground">{mode.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errorFor("gstMode") ? (
          <p id={`${fieldDomId("gstMode")}-error`} className="text-sm text-destructive">
            {errorFor("gstMode")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {kind === "invoice"
            ? "A bill of supply (for composition-scheme or exempt-only businesses) is not available yet."
            : "A quotation is a price offer. It is not an invoice and does not show that anything has been paid."}
        </p>
      </FormSection>

      <FormSection title="Your business">
        <ProfileFillBar
          saved={savedProfile}
          filledFromProfile={filledFromProfile}
          documentNoun={config.noun}
          onUseProfile={applyProfileDetails}
        />
        {partyFields("seller")}
        {withGst ? (
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
            {showsSellerGstin(values)
              ? text(
                  "seller.gstin",
                  "GSTIN",
                  values.seller.gstin,
                  (v) => setParty("seller", "gstin", v),
                  {
                    optional: config.gstinWithGst === "optional",
                    placeholder: "15 characters",
                    hint: "Checked for format only — not whether it is registered or active.",
                  },
                )
              : null}
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Customer">
        {partyFields("customer")}
        {text(
          "customer.gstin",
          "Customer GSTIN",
          values.customer.gstin,
          (v) => setParty("customer", "gstin", v),
          { optional: true, placeholder: "If the customer is GST-registered" },
        )}
      </FormSection>

      <FormSection title={`${config.Noun} details`}>
        <div className="grid gap-4 sm:grid-cols-3">
          {text(
            "documentNumber",
            config.numberLabel,
            values.documentNumber,
            (v) => set("documentNumber", v),
            {
              placeholder: `e.g. ${config.numberExample}`,
              hint: `Up to 16 characters. Use a new, unique number for every ${config.noun}.`,
            },
          )}
          {text("issueDate", config.dateLabel, values.issueDate, (v) => set("issueDate", v), {
            type: "date",
          })}
          {text(endDate.field, endDate.label, values[endDate.field], (v) => set(endDate.field, v), {
            type: "date",
            optional: true,
          })}
        </div>
        {withGst ? (
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
                id="doc-sez"
                type="checkbox"
                checked={values.recipientIsSez}
                onChange={(e) => set("recipientIsSez", e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <Label htmlFor="doc-sez" className="leading-snug font-normal">
                The customer is an SEZ unit or developer (supplies to an SEZ are inter-state)
              </Label>
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Items">
        {withGst ? <ProvisionalRateNotice /> : null}
        <LineItemsEditor
          lines={values.lines}
          withGst={withGst}
          totals={evaluation.totals}
          errorFor={errorFor}
          onChange={updateLine}
          onTouch={touch}
          onAdd={addLine}
          onRemove={removeLine}
        />
      </FormSection>

      <FormSection title="Total">
        <div className="flex items-start gap-2.5">
          <input
            id="doc-round-off"
            type="checkbox"
            checked={values.roundOff}
            onChange={(e) => set("roundOff", e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <Label htmlFor="doc-round-off" className="leading-snug font-normal">
            Round the total to the nearest rupee (the difference is shown as “Round off”)
          </Label>
        </div>
        <div className="flex items-baseline justify-between rounded-lg bg-muted/60 p-4">
          <span className="text-sm font-medium">{config.Noun} total</span>
          <span className="text-xl font-semibold tabular-nums" data-testid="form-grand-total">
            {evaluation.totals ? formatPaise(evaluation.totals.grandTotalPaise) : "—"}
          </span>
        </div>
      </FormSection>

      <FormSection title="Notes and terms">
        {text("notes", "Notes or payment details", values.notes, (v) => set("notes", v), {
          multiline: true,
          optional: true,
          placeholder: NOTES_PLACEHOLDERS[kind].notes,
        })}
        {text("terms", "Terms", values.terms, (v) => set("terms", v), {
          multiline: true,
          optional: true,
          placeholder: NOTES_PLACEHOLDERS[kind].terms,
        })}
      </FormSection>
    </form>
  );

  return (
    <DocumentWorkspace
      title={`New ${config.noun}`}
      description={`Fill in the details and the ${config.noun} preview updates as you type.`}
      documentNoun={config.noun}
      view={view}
      onViewChange={setView}
      onClear={clearForm}
      onPrint={() => print(`${config.Noun} ${values.documentNumber.trim()}`)}
      draftPanel={<DraftPanel draft={draft} documentNoun={config.noun} />}
      form={formContent}
      preview={<DocumentPreview values={values} evaluation={evaluation} />}
    />
  );
}
