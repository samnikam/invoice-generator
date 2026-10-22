import { InvalidInputError } from "@/lib/errors";
import { MAX_AMOUNT_PAISE } from "@/lib/money/paise";

/**
 * Converts an amount in paise to Indian-English words for invoices, using the Indian
 * numbering system (thousand, lakh, crore).
 *
 * Wording rules (applied consistently):
 * - Title Case, numbers 21–99 hyphenated ("Twenty-One"), no "and" inside numbers.
 * - "Rupees … Only" for whole rupees; "Rupees … and … Paise Only" when there are paise.
 * - Amounts under ₹1 read "… Paise Only" ("One Paisa Only" for a single paisa).
 * - Zero reads "Rupees Zero Only".
 * - Crores above 99 are written with the same system: 1,25,00,00,000 → "One Hundred
 *   Twenty-Five Crore". No "arab"/"kharab".
 *
 * Supported range: 0 to MAX_AMOUNT_PAISE (₹9,99,99,99,99,999.99). Anything else throws.
 */

const UNDER_TWENTY = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

/** 1–99 */
function wordsBelowHundred(n: number): string {
  if (n < 20) return UNDER_TWENTY[n] ?? "";
  const tens = TENS[Math.floor(n / 10)] ?? "";
  const ones = n % 10;
  return ones === 0 ? tens : `${tens}-${UNDER_TWENTY[ones]}`;
}

/** 1–999 */
function wordsBelowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${UNDER_TWENTY[hundreds]} Hundred`);
  if (rest > 0) parts.push(wordsBelowHundred(rest));
  return parts.join(" ");
}

/** Whole number ≥ 1 in Indian-system words. */
function indianWords(n: number): string {
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const belowThousand = n % 1000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${indianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${wordsBelowHundred(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${wordsBelowHundred(thousand)} Thousand`);
  if (belowThousand > 0) parts.push(wordsBelowThousand(belowThousand));
  return parts.join(" ");
}

/** Converts a whole number (0 or more) to Indian-system words, e.g. 150000 → "One Lakh Fifty Thousand". */
export function numberToIndianWords(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`Expected a non-negative whole number, received ${n}`);
  }
  return n === 0 ? "Zero" : indianWords(n);
}

/** Amount in words for documents, e.g. 2714050 → "Rupees Twenty-Seven Thousand One Hundred Forty and Fifty Paise Only". */
export function amountInWords(paise: number, field = "amount"): string {
  if (!Number.isSafeInteger(paise)) {
    throw new InvalidInputError("invalid_number", "Amount must be a whole number of paise.", field);
  }
  if (paise < 0) {
    throw new InvalidInputError(
      "negative",
      "Amount in words does not support negative amounts.",
      field,
    );
  }
  if (paise > MAX_AMOUNT_PAISE) {
    throw new InvalidInputError(
      "too_large",
      "Amount is larger than the maximum supported amount of ₹9,99,99,99,99,999.99.",
      field,
    );
  }

  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const paiseWords =
    remainder > 0 ? `${wordsBelowHundred(remainder)} ${remainder === 1 ? "Paisa" : "Paise"}` : "";

  if (rupees === 0 && remainder === 0) return "Rupees Zero Only";
  if (rupees === 0) return `${paiseWords} Only`;
  if (remainder === 0) return `Rupees ${indianWords(rupees)} Only`;
  return `Rupees ${indianWords(rupees)} and ${paiseWords} Only`;
}
