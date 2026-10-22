import { InvalidInputError } from "@/lib/errors";
import type { BasisPoints } from "@/lib/money/percent";

/**
 * GST RATE CONFIGURATION — PROVISIONAL, REVIEW BEFORE REAL-WORLD USE
 * ══════════════════════════════════════════════════════════════════
 * This is the ONLY place GST rates are defined. Calculation code receives a rate from
 * here; it never hardcodes one.
 *
 * What this list is:
 *   The total GST rates (CGST + SGST/UTGST, or IGST) that appear in the goods rate
 *   schedules in force after the GST rate rationalisation of 22 September 2025.
 *
 * What this list is NOT:
 *   - It is not a complete statement of Indian GST law. The correct rate for any item
 *     depends on its HSN/SAC classification, conditions and exemptions in the
 *     notifications, and later amendments.
 *   - It does not choose a rate for the user. The user selects the rate for each item.
 *   - Using a rate from this list does not make a document legally compliant.
 *
 * How this list was compiled (researched 2026-10-22):
 *   None of the notifications below was read in full from the official CBIC/Gazette text.
 *   The rates come from secondary summaries and reproductions (tax publishers and news
 *   reports). The official text is published by CBIC at https://cbic-gst.gov.in.
 *   - Notification No. 9/2025-Central Tax (Rate), dated 17-09-2025, effective 22-09-2025,
 *     as summarised: CGST schedules of 2.5%, 9%, 20%, 1.5%, 0.125%, 0.75%, 14%
 *     → total GST 5%, 18%, 40%, 3%, 0.25%, 1.5%, 28%.
 *   - Notification No. 19/2025-Central Tax (Rate), dated 31-12-2025: reported to move
 *     tobacco products from 28% to 40% (biris 18%) from 01-02-2026. The 28% rate is
 *     therefore NOT included below.
 *   - Notification No. 15/2025-Central Tax (Rate) (services), effective 22-09-2025:
 *     only secondary summaries of selected services were seen.
 *   - Notification No. 1/2026-Central Tax (Rate), dated 30-04-2026, reported to amend
 *     9/2025 "to align with the Finance Act, 2026". Its content is UNKNOWN to this project.
 *
 * Before real-world use, a qualified tax professional should verify this list against the
 * current official notifications and set `verifiedByTaxProfessional` to true.
 *
 * Deliberately NOT included (add only after checking the notification and conditions):
 *   - Concessional/conditional rates such as 0.1% (supplies to merchant exporters) and
 *     special rates for certain services (e.g. some construction or job-work services).
 *   - Compensation cess and other levies outside GST.
 *   - 0%: nil-rated, exempt, non-GST and zero-rated supplies are handled as separate
 *     tax TREATMENTS (see calculate-totals.ts), not as a "0% rate", because they mean
 *     different things legally.
 */
export const GST_RATE_REVIEW = {
  status: "provisional",
  /** Date the rates were last researched from secondary sources — not a legal review. */
  researchedOn: "2026-10-22",
  effectiveFrom: "2025-09-22",
  verifiedByTaxProfessional: false,
  /**
   * Notice that any screen offering these rates must show to the user, so the app never
   * presents the list as legally verified or as applying to every item.
   */
  userNotice:
    "GST rates listed here are provided for convenience and have not been verified by a tax professional. The correct rate depends on your item's HSN/SAC classification and current GST notifications. Please confirm the rate before issuing a document.",
} as const;

export type GstRateCategory = "standard" | "special";

export type GstRate = {
  /** Stable identifier stored on documents. Equal to the total rate as text. */
  id: string;
  /** Total GST rate in basis points (1% = 100). CGST and SGST/UTGST are each half. */
  basisPoints: BasisPoints;
  /** Label shown to users, e.g. "18%". */
  label: string;
  category: GstRateCategory;
  /** General guidance only. Never use this to decide an item's rate. */
  note: string;
};

const RATES = [
  {
    id: "5",
    basisPoints: 500 as BasisPoints,
    label: "5%",
    category: "standard",
    note: "Merit rate for many essential goods and some services.",
  },
  {
    id: "18",
    basisPoints: 1800 as BasisPoints,
    label: "18%",
    category: "standard",
    note: "Standard rate for most goods and services.",
  },
  {
    id: "40",
    basisPoints: 4000 as BasisPoints,
    label: "40%",
    category: "standard",
    note: "Rate for specified luxury and demerit goods and services.",
  },
  {
    id: "3",
    basisPoints: 300 as BasisPoints,
    label: "3%",
    category: "special",
    note: "Special rate for specified goods (e.g. gold, silver and jewellery).",
  },
  {
    id: "1.5",
    basisPoints: 150 as BasisPoints,
    label: "1.5%",
    category: "special",
    note: "Special rate for specified goods listed in the rate notification (check the schedule).",
  },
  {
    id: "0.25",
    basisPoints: 25 as BasisPoints,
    label: "0.25%",
    category: "special",
    note: "Special rate for specified goods (e.g. rough diamonds and certain precious stones).",
  },
] as const satisfies readonly GstRate[];

export type GstRateId = (typeof RATES)[number]["id"];

/** All configured GST rates, in display order. */
export const GST_RATES: readonly GstRate[] = RATES;

/** Looks up a configured rate. Throws for any id that is not in the configuration. */
export function getGstRate(id: string, field = "gstRate"): GstRate {
  const rate = GST_RATES.find((r) => r.id === id);
  if (!rate) {
    throw new InvalidInputError(
      "unknown_gst_rate",
      `"${id}" is not a configured GST rate. Choose one of: ${GST_RATES.map((r) => r.label).join(", ")}.`,
      field,
    );
  }
  return rate;
}
