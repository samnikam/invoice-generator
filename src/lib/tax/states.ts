import { InvalidInputError } from "@/lib/errors";

/**
 * GST STATE AND UNION-TERRITORY CODES
 * ═══════════════════════════════════
 * The two-digit codes used in GSTINs and for place of supply.
 * Source: the GST state code list as published on the GST portal (gst.gov.in) and
 * reproduced widely; cross-checked 2026-10-22.
 *
 * - "state" and "ut-with-legislature" (Delhi, Puducherry, Jammu and Kashmir) levy SGST.
 * - "ut" (union territories without a legislature) and "other-territory" levy UTGST
 *   instead of SGST. The rate is the same; only the name on the invoice differs.
 * - Legacy codes are kept so they are recognised, but rejected with a clear message:
 *     25 Daman and Diu → merged into 26 (26-01-2020)
 *     28 Andhra Pradesh (before division) → use 37
 * - Not included (and therefore rejected): 96 (Foreign Country — use an "outside India"
 *   place of supply instead) and 99 (Centre Jurisdiction — not a place of supply).
 */
export type StateKind = "state" | "ut-with-legislature" | "ut" | "other-territory";

export type GstState = {
  code: string;
  name: string;
  kind: StateKind;
  /** Legacy codes are recognised but must not be used for new documents. */
  legacyReplacedBy?: string;
};

export const GST_STATES: readonly GstState[] = [
  { code: "01", name: "Jammu and Kashmir", kind: "ut-with-legislature" },
  { code: "02", name: "Himachal Pradesh", kind: "state" },
  { code: "03", name: "Punjab", kind: "state" },
  { code: "04", name: "Chandigarh", kind: "ut" },
  { code: "05", name: "Uttarakhand", kind: "state" },
  { code: "06", name: "Haryana", kind: "state" },
  { code: "07", name: "Delhi", kind: "ut-with-legislature" },
  { code: "08", name: "Rajasthan", kind: "state" },
  { code: "09", name: "Uttar Pradesh", kind: "state" },
  { code: "10", name: "Bihar", kind: "state" },
  { code: "11", name: "Sikkim", kind: "state" },
  { code: "12", name: "Arunachal Pradesh", kind: "state" },
  { code: "13", name: "Nagaland", kind: "state" },
  { code: "14", name: "Manipur", kind: "state" },
  { code: "15", name: "Mizoram", kind: "state" },
  { code: "16", name: "Tripura", kind: "state" },
  { code: "17", name: "Meghalaya", kind: "state" },
  { code: "18", name: "Assam", kind: "state" },
  { code: "19", name: "West Bengal", kind: "state" },
  { code: "20", name: "Jharkhand", kind: "state" },
  { code: "21", name: "Odisha", kind: "state" },
  { code: "22", name: "Chhattisgarh", kind: "state" },
  { code: "23", name: "Madhya Pradesh", kind: "state" },
  { code: "24", name: "Gujarat", kind: "state" },
  { code: "25", name: "Daman and Diu (merged)", kind: "ut", legacyReplacedBy: "26" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", kind: "ut" },
  { code: "27", name: "Maharashtra", kind: "state" },
  {
    code: "28",
    name: "Andhra Pradesh (before division)",
    kind: "state",
    legacyReplacedBy: "37",
  },
  { code: "29", name: "Karnataka", kind: "state" },
  { code: "30", name: "Goa", kind: "state" },
  { code: "31", name: "Lakshadweep", kind: "ut" },
  { code: "32", name: "Kerala", kind: "state" },
  { code: "33", name: "Tamil Nadu", kind: "state" },
  { code: "34", name: "Puducherry", kind: "ut-with-legislature" },
  { code: "35", name: "Andaman and Nicobar Islands", kind: "ut" },
  { code: "36", name: "Telangana", kind: "state" },
  { code: "37", name: "Andhra Pradesh", kind: "state" },
  { code: "38", name: "Ladakh", kind: "ut" },
  { code: "97", name: "Other Territory", kind: "other-territory" },
];

/** States and union territories that can be chosen on new documents, in code order. */
export const ACTIVE_GST_STATES: readonly GstState[] = GST_STATES.filter((s) => !s.legacyReplacedBy);

/**
 * Returns the state for a two-digit code. Rejects malformed, unknown and legacy codes
 * instead of guessing.
 */
export function getActiveState(code: string, field = "stateCode"): GstState {
  if (typeof code !== "string" || code.trim() === "") {
    throw new InvalidInputError("required", "State is required.", field);
  }
  const trimmed = code.trim();
  if (!/^\d{2}$/.test(trimmed)) {
    throw new InvalidInputError(
      "unknown_state",
      `"${trimmed}" is not a valid two-digit GST state code.`,
      field,
    );
  }
  const state = GST_STATES.find((s) => s.code === trimmed);
  if (!state) {
    throw new InvalidInputError(
      "unknown_state",
      `"${trimmed}" is not a recognised GST state or union-territory code.`,
      field,
    );
  }
  if (state.legacyReplacedBy) {
    throw new InvalidInputError(
      "unsupported_state",
      `State code ${state.code} (${state.name}) is no longer used. Use ${state.legacyReplacedBy} instead.`,
      field,
    );
  }
  return state;
}

/** "UTGST" for union territories without a legislature; otherwise "SGST". */
export function stateTaxLabel(state: GstState): "SGST" | "UTGST" {
  return state.kind === "ut" || state.kind === "other-territory" ? "UTGST" : "SGST";
}
