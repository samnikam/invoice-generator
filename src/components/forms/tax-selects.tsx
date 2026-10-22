import { TriangleAlert } from "lucide-react";

import { NativeSelect } from "@/components/ui/native-select";
import { OUTSIDE_INDIA } from "@/lib/calculators/place-of-supply";
import { GST_RATE_REVIEW, GST_RATES } from "@/lib/tax/gst-rates";
import { ACTIVE_GST_STATES } from "@/lib/tax/states";

import type { ControlProps } from "@/components/forms/form-field";

type SelectProps = ControlProps & { value: string; onChange: (value: string) => void };

/** GST rates from the central configuration. No rate is pre-selected. */
export function GstRateSelect({ value, onChange, ...control }: SelectProps) {
  return (
    <NativeSelect {...control} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select a GST rate</option>
      {GST_RATES.map((rate) => (
        <option key={rate.id} value={rate.id}>
          {rate.label}
          {rate.category === "special" ? " (special rate)" : ""}
        </option>
      ))}
    </NativeSelect>
  );
}

/** State / union territory picker. Nothing is pre-selected; codes are shown for clarity. */
export function StateSelect({
  value,
  onChange,
  includeOutsideIndia = false,
  placeholder,
  ...control
}: SelectProps & { includeOutsideIndia?: boolean; placeholder: string }) {
  return (
    <NativeSelect {...control} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {includeOutsideIndia ? <option value={OUTSIDE_INDIA}>Outside India (export)</option> : null}
      {ACTIVE_GST_STATES.map((state) => (
        <option key={state.code} value={state.code}>
          {state.code} – {state.name}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Must be shown wherever GST rates are offered (see GST_RATE_REVIEW in gst-rates.ts). */
export function ProvisionalRateNotice() {
  // Fixed formatting (not toLocaleDateString) so server and browser render identical text.
  const [year, month, day] = GST_RATE_REVIEW.researchedOn.split("-").map(Number);
  const months = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
  const researched = `${day} ${months[(month ?? 1) - 1]} ${year}`;
  return (
    <div
      data-testid="provisional-rate-notice"
      className="flex gap-2.5 rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs leading-relaxed text-foreground"
    >
      <TriangleAlert
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-warning-foreground"
      />
      <p>
        <span className="font-semibold">Rates not verified. </span>
        {GST_RATE_REVIEW.userNotice} Rate list last researched {researched}.
      </p>
    </div>
  );
}
