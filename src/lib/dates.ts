import { InvalidInputError } from "@/lib/errors";

/**
 * Dates are handled as plain "YYYY-MM-DD" strings (the format of <input type="date">).
 * They are calendar dates, not moments in time, so no time zone is involved.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Validates a "YYYY-MM-DD" calendar date, rejecting impossible dates such as 2026-02-30. */
export function parseIsoDate(value: string, field = "date", label = "Date"): string {
  const text = value.trim();
  if (text === "") throw new InvalidInputError("required", `${label} is required.`, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new InvalidInputError("invalid_number", `${label} must be a valid date.`, field);
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2000 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new InvalidInputError("out_of_range", `${label} must be a valid date.`, field);
  }
  return text;
}

/** "2026-10-22" → "22 Oct 2026". Fixed format so server and browser render the same text. */
export function formatDisplayDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] ?? ""} ${match[1]}`;
}

/** Today's date in the user's own time zone as "YYYY-MM-DD". Call in the browser only. */
export function todayIsoDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
