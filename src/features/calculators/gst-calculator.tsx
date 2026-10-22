"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  runGstCalculator,
  TREATMENT_OPTIONS,
  type GstCalculatorInput,
  type GstCalculatorResult,
} from "@/lib/calculators/gst-calculator";
import { formatPaise } from "@/lib/money/format";
import { formatHalfRatePercent } from "@/lib/money/percent";
import type { SupplyType } from "@/lib/tax/supply-type";

import { AmountInput } from "./components/amount-input";
import { CalculatorGrid } from "./components/calculator-layout";
import { describedBy, FieldError, FormField } from "./components/form-field";
import { Explanation, ResultList, ResultPanel, ResultRow } from "./components/result-panel";
import { GstRateSelect, ProvisionalRateNotice, StateSelect } from "./components/tax-selects";
import { useCalculatorForm } from "./components/use-calculator-form";

const INITIAL: GstCalculatorInput = {
  amount: "",
  treatment: "",
  rateId: "",
  sellerState: "",
  placeOfSupply: "",
  recipientIsSez: false,
};

export function describeSupply(supply: SupplyType): string {
  if (supply.kind === "intra-state") return `Intra-state supply (${supply.state.name})`;
  if (supply.reason === "export") return "Export — inter-state supply";
  if (supply.reason === "sez") return "Supply to an SEZ — inter-state supply";
  return "Inter-state supply";
}

export function GstCalculator() {
  const { values, setValue, markTouched, outcome, errorFor, reset } = useCalculatorForm(
    INITIAL,
    runGstCalculator,
  );
  const treatmentError = errorFor("treatment");

  const form = (
    <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormField
        id="gst-amount"
        label="Amount before GST"
        hint="The taxable value, without GST. Up to 2 decimal places, no commas."
        error={errorFor("amount")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 10000"
            value={values.amount}
            onChange={(e) => setValue("amount", e.target.value)}
            onBlur={() => markTouched("amount")}
          />
        )}
      </FormField>

      <fieldset
        className="space-y-2"
        aria-describedby={describedBy("gst-treatment", undefined, treatmentError)}
      >
        <legend className="text-sm font-medium">How GST applies</legend>
        <div className="grid gap-2">
          {TREATMENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent/50"
            >
              <input
                type="radio"
                name="gst-treatment"
                value={option.value}
                checked={values.treatment === option.value}
                onChange={() => setValue("treatment", option.value, true)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="gst-treatment" error={treatmentError} />
      </fieldset>

      {values.treatment === "taxable" ? (
        <div className="space-y-3">
          <FormField id="gst-rate" label="GST rate" error={errorFor("rateId")}>
            {(control) => (
              <GstRateSelect
                {...control}
                value={values.rateId}
                onChange={(v) => setValue("rateId", v, true)}
              />
            )}
          </FormField>
          <ProvisionalRateNotice />
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <FormField
          id="gst-seller-state"
          label="Seller's state"
          hint="Where the seller is registered."
          error={errorFor("sellerState")}
        >
          {(control) => (
            <StateSelect
              {...control}
              placeholder="Select state"
              value={values.sellerState}
              onChange={(v) => setValue("sellerState", v, true)}
            />
          )}
        </FormField>
        <FormField
          id="gst-place-of-supply"
          label="Place of supply"
          hint="Decides CGST + SGST/UTGST or IGST. Check the GST rules for your supply."
          error={errorFor("placeOfSupply")}
        >
          {(control) => (
            <StateSelect
              {...control}
              includeOutsideIndia
              placeholder="Select place of supply"
              value={values.placeOfSupply}
              onChange={(v) => setValue("placeOfSupply", v, true)}
            />
          )}
        </FormField>
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id="gst-sez"
          type="checkbox"
          checked={values.recipientIsSez}
          onChange={(e) => setValue("recipientIsSez", e.target.checked, true)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <Label htmlFor="gst-sez" className="leading-snug font-normal">
          The buyer is an SEZ unit or developer (supplies to an SEZ are treated as inter-state)
        </Label>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        A GSTIN is not needed for this calculator, and none is checked. When you create an invoice,
        the seller&apos;s GSTIN format will be checked — format only, not registration.
      </p>

      <Button type="button" variant="ghost" onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        Clear
      </Button>
    </form>
  );

  const result = (
    <ResultPanel ready={outcome.ok} formError={!outcome.ok ? outcome.errors.form : undefined}>
      {outcome.ok ? <GstResult result={outcome.result} /> : null}
    </ResultPanel>
  );

  return (
    <div className="space-y-6">
      <CalculatorGrid form={form} result={result} />
      <Explanation title="How this is calculated">
        <p>
          Within one state or union territory, GST is split into CGST and SGST (or UTGST in union
          territories without a legislature), each at half the rate. Between states, for exports and
          for supplies to an SEZ, the full rate is charged as IGST.
        </p>
        <p>
          Each tax is rounded to the nearest paisa (half a paisa rounds up), exactly as on SmartBill
          invoices. This calculator does not decide which rate or place of supply applies to your
          item — please confirm these for your situation.
        </p>
      </Explanation>
    </div>
  );
}

function GstResult({ result }: { result: GstCalculatorResult }) {
  const supply = result.supplyType;
  const rate = result.rate;
  const half = rate ? formatHalfRatePercent(rate.basisPoints) : "";
  const stateLabel = supply.kind === "intra-state" ? supply.stateTaxLabel : "SGST";
  const treatmentLabel = TREATMENT_OPTIONS.find((o) => o.value === result.treatment)?.label;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-primary" data-testid="supply-type">
        {describeSupply(supply)}
      </p>
      <ResultList>
        <ResultRow
          label="Taxable amount"
          value={formatPaise(result.amountPaise)}
          testId="taxable"
        />
        {rate === null ? (
          <ResultRow label="GST" value={`None — ${treatmentLabel}`} testId="no-gst" />
        ) : supply.kind === "intra-state" ? (
          <>
            <ResultRow
              label={`CGST @ ${half}%`}
              value={formatPaise(result.cgstPaise)}
              testId="cgst"
            />
            <ResultRow
              label={`${stateLabel} @ ${half}%`}
              value={formatPaise(result.sgstPaise)}
              testId="sgst"
            />
          </>
        ) : (
          <ResultRow
            label={`IGST @ ${rate.label}`}
            value={formatPaise(result.igstPaise)}
            testId="igst"
          />
        )}
        <ResultRow label="Total GST" value={formatPaise(result.totalTaxPaise)} testId="total-gst" />
        <ResultRow
          label="Amount including GST"
          value={formatPaise(result.totalWithGstPaise)}
          emphasis
          testId="total"
        />
      </ResultList>
    </div>
  );
}
