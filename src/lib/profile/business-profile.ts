import {
  messageOf,
  optionalEmail,
  optionalPhone,
  optionalText,
  requireText,
  TEXT_LIMITS,
  type DocumentIssue,
  type PartyValues,
} from "@/lib/documents/billing-document";
import type { ContactValues } from "@/lib/receipts/receipt";
import { validateGstinFormat } from "@/lib/tax/gstin";
import { getActiveState, GST_STATES, type GstState } from "@/lib/tax/states";

/**
 * BUSINESS PROFILE
 * ════════════════
 * Business details the user saves once and reuses on new documents.
 *
 * Documents COPY these details when they start; they never stay linked. Changing the
 * profile later therefore never alters a document or draft that already exists.
 *
 * - Invoices and quotations receive every field (toSellerFields).
 * - Receipts receive only name, address, phone and email (toReceiptBusiness) — never
 *   the GSTIN or state, so a receipt never looks like a tax document.
 *
 * Validation reuses the document validators and limits, so saved values always pass
 * the document checks too.
 */
export type BusinessProfile = {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Optional. Format and check character are validated; registration is not checked. */
  gstin: string;
  /** Optional two-digit GST state code. Must match the GSTIN when both are given. */
  stateCode: string;
};

export function createEmptyProfile(): BusinessProfile {
  return { name: "", address: "", phone: "", email: "", gstin: "", stateCode: "" };
}

export type ProfileEvaluation = {
  issues: DocumentIssue[];
  errors: Record<string, string>;
};

function stateName(code: string): string {
  const state = GST_STATES.find((s) => s.code === code);
  return state ? `${state.name} (${state.code})` : code;
}

/** The state a valid GSTIN belongs to, or null if the GSTIN is not valid. */
export function stateFromGstin(gstin: string): GstState | null {
  try {
    return validateGstinFormat(gstin).state;
  } catch {
    return null;
  }
}

export function evaluateProfile(profile: BusinessProfile): ProfileEvaluation {
  const issues: DocumentIssue[] = [];
  const add = (field: string, label: string, message: string | undefined) => {
    if (message) issues.push({ field, label, message });
  };

  add("name", "Business name", requireText(profile.name, "Business name", TEXT_LIMITS.name));
  add(
    "address",
    "Business address",
    optionalText(profile.address, "Business address", TEXT_LIMITS.address),
  );
  add("phone", "Phone", optionalPhone(profile.phone));
  add("email", "Email", optionalEmail(profile.email));

  const hasGstin = profile.gstin.trim() !== "";
  const hasState = profile.stateCode.trim() !== "";
  const gstinError = hasGstin ? messageOf(() => validateGstinFormat(profile.gstin)) : undefined;
  add("gstin", "GSTIN", gstinError);

  const stateError = hasState ? messageOf(() => getActiveState(profile.stateCode)) : undefined;
  add("stateCode", "State of registration", stateError);

  // GSTIN and state must agree (the first two GSTIN digits are the state code).
  if (hasGstin && !gstinError && !stateError) {
    const gstinState = stateFromGstin(profile.gstin);
    if (gstinState && !hasState) {
      add(
        "stateCode",
        "State of registration",
        `Select the state of registration. This GSTIN is registered in ${stateName(gstinState.code)}.`,
      );
    } else if (gstinState && gstinState.code !== profile.stateCode.trim()) {
      add(
        "stateCode",
        "State of registration",
        `This GSTIN is registered in ${stateName(gstinState.code)}, but the state selected is ${stateName(profile.stateCode.trim())}.`,
      );
    }
  }

  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.field] = issue.message;
  return { issues, errors };
}

/** Tidies a valid profile for saving: trims spaces and upper-cases the GSTIN. */
export function normaliseProfile(profile: BusinessProfile): BusinessProfile {
  return {
    name: profile.name.trim(),
    address: profile.address.trim(),
    phone: profile.phone.trim(),
    email: profile.email.trim(),
    gstin: profile.gstin.trim().toUpperCase(),
    stateCode: profile.stateCode.trim(),
  };
}

/** Business fields for an invoice or quotation (the full profile). */
export function toSellerFields(profile: BusinessProfile): PartyValues & { stateCode: string } {
  return {
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    gstin: profile.gstin,
    stateCode: profile.stateCode,
  };
}

/** Business fields for a receipt: contact details only — never GSTIN or state. */
export function toReceiptBusiness(profile: BusinessProfile): ContactValues {
  return {
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
  };
}
