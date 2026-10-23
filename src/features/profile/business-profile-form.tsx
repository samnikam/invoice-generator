"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, Info, Save, ShieldAlert, Trash2 } from "lucide-react";
import { cn } from "cn";

import { ErrorSummary } from "@/components/documents/error-summary";
import { FormSection } from "@/components/documents/form-section";
import { FormField } from "@/components/forms/form-field";
import { StateSelect } from "@/components/forms/tax-selects";
import { TextField } from "@/components/forms/text-field";
import { useSavedProfile } from "@/components/profile/use-saved-profile";
import { Button } from "@/components/ui/button";
import { getBrowserStorage } from "@/lib/drafts/draft-storage";
import {
  createEmptyProfile,
  evaluateProfile,
  normaliseProfile,
  stateFromGstin,
  type BusinessProfile,
} from "@/lib/profile/business-profile";
import { deleteProfile, writeProfile } from "@/lib/profile/profile-storage";

const domId = (field: string) => `profile-${field}`;
const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" });

type Feedback =
  | { kind: "saved"; savedAt: string }
  | { kind: "deleted" }
  | { kind: "deleteFailed" }
  | { kind: "failed"; reason: "quota" | "unavailable" | "error" }
  | null;

const FAILURE_TEXT = {
  quota:
    "Could not save: this browser's storage is full. Free up space and try again. Your details are still on screen.",
  unavailable:
    "Could not save: this browser is blocking storage. Your details are still on screen.",
  error: "Could not save the profile. Your details are still on screen.",
} as const;

/** Form to save business details once, in this browser, for reuse on new documents. */
export function BusinessProfileForm() {
  const saved = useSavedProfile();
  const [values, setValues] = useState<BusinessProfile>(createEmptyProfile);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Put the saved profile into the form once it has been read (after page load).
  useEffect(() => {
    if (saved.state === "loaded" && loadedFrom !== saved.savedAt) {
      /* eslint-disable react-hooks/set-state-in-effect -- sync form with the profile just read */
      setValues(saved.profile);
      setLoadedFrom(saved.savedAt);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [saved, loadedFrom]);

  const evaluation = useMemo(() => evaluateProfile(values), [values]);
  const errorFor = (field: string) =>
    showAll || touched.has(field) ? evaluation.errors[field] : undefined;
  const touch = (field: string) =>
    setTouched((current) => (current.has(field) ? current : new Set(current).add(field)));
  const set = (field: keyof BusinessProfile, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setFeedback(null);
  };

  const storedProfile = saved.state === "loaded" ? saved.profile : null;
  const unsaved =
    storedProfile !== null
      ? JSON.stringify(normaliseProfile(values)) !== JSON.stringify(storedProfile)
      : Object.values(values).some((v) => v.trim() !== "");
  const gstinState = stateFromGstin(values.gstin);
  const blocked = saved.state === "unavailable";

  function save() {
    if (evaluation.issues.length > 0) {
      setShowAll(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    const profile = normaliseProfile(values);
    const result = writeProfile(getBrowserStorage(), profile);
    if (result.ok) {
      setValues(profile);
      setLoadedFrom(result.savedAt);
      setFeedback({ kind: "saved", savedAt: result.savedAt });
      saved.refresh();
    } else {
      setFeedback({ kind: "failed", reason: result.reason });
    }
  }

  function remove() {
    const confirmed = window.confirm(
      "Delete the business profile saved in this browser? Documents and drafts you have already started keep their own copy of these details.",
    );
    if (!confirmed) return;
    if (!deleteProfile(getBrowserStorage())) {
      // Not deleted: say so, and leave the form exactly as it is.
      setFeedback({ kind: "deleteFailed" });
      return;
    }
    setValues(createEmptyProfile());
    setTouched(new Set());
    setShowAll(false);
    setLoadedFrom(null);
    setFeedback({ kind: "deleted" });
    saved.refresh();
  }

  const text = (
    field: keyof BusinessProfile,
    label: string,
    options: Omit<
      Parameters<typeof TextField>[0],
      "id" | "label" | "value" | "onValueChange" | "onBlur" | "error"
    > = {},
  ) => (
    <TextField
      id={domId(field)}
      label={label}
      value={values[field]}
      onValueChange={(v) => set(field, v)}
      onBlur={() => touch(field)}
      error={errorFor(field)}
      {...options}
    />
  );

  const feedbackText =
    feedback?.kind === "saved"
      ? `Saved in this browser at ${timeFormatter.format(new Date(feedback.savedAt))}.`
      : feedback?.kind === "deleted"
        ? "Business profile deleted from this browser."
        : feedback?.kind === "deleteFailed"
          ? "Could not delete the profile: this browser is blocking storage. It is still saved here."
          : feedback?.kind === "failed"
            ? FAILURE_TEXT[feedback.reason]
            : unsaved && saved.state !== "checking"
              ? "You have unsaved changes."
              : "";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex gap-2.5 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p>
            Saved only when you press <strong className="text-foreground">Save profile</strong>, and
            only in this browser on this device. It is not uploaded and not encrypted, and anyone
            who uses this browser can see it.
          </p>
          <p>
            New invoices, quotations and receipts are filled from this profile. Documents and drafts
            you have already started keep their own copy, so changes here do not alter them.
            Receipts never include the GSTIN or state.
          </p>
        </div>
      </div>

      {saved.state === "invalid" ? (
        <p
          data-testid="profile-notice"
          className="flex gap-2 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />A business profile saved
          earlier in this browser could not be read (it may be damaged or from an older version), so
          it was not loaded. Saving will replace it.
        </p>
      ) : null}
      {blocked ? (
        <p role="alert" className="flex gap-2 text-sm text-destructive">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          This browser is blocking storage (for example in some private-browsing modes), so the
          profile cannot be saved here.
        </p>
      ) : null}

      {/* Actions sit above the fields, so error messages appearing below a field when it
          loses focus can never move the Save button away from the pointer mid-click. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          form="profile-form"
          size="lg"
          disabled={blocked || saved.state === "checking"}
        >
          <Save data-icon="inline-start" />
          Save profile
        </Button>
        {storedProfile ? (
          <Button type="button" variant="ghost" size="lg" onClick={remove}>
            <Trash2 data-icon="inline-start" />
            Delete profile
          </Button>
        ) : null}
        <p
          role="status"
          data-testid="profile-status"
          className={cn(
            "text-sm",
            feedback?.kind === "failed" || feedback?.kind === "deleteFailed"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
        >
          {feedbackText}
        </p>
      </div>

      <form
        id="profile-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-5"
        aria-label="Business profile"
      >
        {showAll && evaluation.issues.length > 0 ? (
          <ErrorSummary ref={summaryRef} issues={evaluation.issues} domId={domId} action="saving" />
        ) : null}

        <FormSection title="Business details">
          {text("name", "Business name", { autoComplete: "organization" })}
          {text("address", "Business address", {
            multiline: true,
            optional: true,
            autoComplete: "street-address",
            hint: "Needed on invoices and quotations; optional on receipts.",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {text("phone", "Phone", {
              optional: true,
              type: "tel",
              inputMode: "tel",
              autoComplete: "tel",
            })}
            {text("email", "Email", {
              optional: true,
              type: "email",
              inputMode: "email",
              autoComplete: "email",
            })}
          </div>
        </FormSection>

        <FormSection title="GST registration">
          <p className="text-sm text-muted-foreground">
            Leave these empty if your business is not registered for GST. They are used only on
            invoices and quotations with GST.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("gstin", "GSTIN", {
              optional: true,
              placeholder: "15 characters",
              hint: "Checked for format only — not whether it is registered or active.",
            })}
            <div className="space-y-2">
              <FormField
                id={domId("stateCode")}
                label="State of registration"
                optional
                error={errorFor("stateCode")}
              >
                {(control) => (
                  <StateSelect
                    {...control}
                    placeholder="Not specified"
                    value={values.stateCode}
                    onChange={(v) => {
                      set("stateCode", v);
                      touch("stateCode");
                    }}
                  />
                )}
              </FormField>
              {gstinState && gstinState.code !== values.stateCode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    set("stateCode", gstinState.code);
                    touch("stateCode");
                  }}
                >
                  Use {gstinState.name} ({gstinState.code}) from the GSTIN
                </Button>
              ) : null}
            </div>
          </div>
        </FormSection>
      </form>
    </div>
  );
}
