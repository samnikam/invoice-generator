import { validateGstinFormat } from "@/lib/tax/gstin";

/**
 * The PAN contained in a regular GSTIN (characters 3–12), for display only.
 * Uses the existing GSTIN check (format, current state code and check character), so an
 * incomplete or mistyped GSTIN never yields a PAN. This only reads the PAN that is already
 * part of the GSTIN; it does not verify it with the Income Tax department.
 */
export function panFromGstin(gstin: string): string | null {
  if (gstin.trim() === "") return null;
  try {
    return validateGstinFormat(gstin).pan;
  } catch {
    return null;
  }
}
