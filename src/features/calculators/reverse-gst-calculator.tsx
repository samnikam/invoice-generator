"use client";

import { Info, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  runReverseGstCalculator,
  type ReverseGstInput,
  type ReverseGstResult,
} from "@/lib/calculators/reverse-gst";
import { formatPaise } from "@/lib/money/format";
import { formatHalfRatePercent } from "@/lib/money/percent";

import { AmountInput } from "./components/amount-input";
import { CalculatorGrid } from "./components/calculator-layout";
import { FormField } from "./components/form-field";
import { Explanation, ResultList, ResultPanel, ResultRow } from "./components/result-panel";
import { GstRateSelect, ProvisionalRateNotice, StateSelect } from "./components/tax-selects";
import { useCalculatorForm } from "./components/use-calculator-form";
import { describeSupply } from "./gst-calculator";

const INITIAL: ReverseGstInput = {
  price: "",
  rateId: "",
  sellerState: "",
  placeOfSupply: "",
  recipientIsSez: false,
};

export function ReverseGstCalculator() {
  const { values, setValue, markTouched, outcome, errorFor, reset } = useCalculatorForm(
    INITIAL,
    runReverseGstCalculator,
  );

  const form = (
    <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormField
        id="rgst-price"
        label="Price including GST"
        hint="The final price the customer pays, with GST already included."
        error={errorFor("price")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 1180"
            value={values.price}
            onChange={(e) => setValue("price", e.target.value)}
            onBlur={() => markTouched("price")}
          />
        )}
      </FormField>

      <div className="space-y-3">
        <FormField id="rgst-rate" label="GST rate included in the price" error={errorFor("rateId")}>
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

      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          CGST / SGST or IGST breakdown{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <p className="text-xs text-muted-foreground">
          Select both states to see how the GST splits. Leave both empty to see the total GST only.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="rgst-seller-state" label="Seller's state" error={errorFor("sellerState")}>
            {(control) => (
              <StateSelect
                {...control}
                placeholder="Not selected"
                value={values.sellerState}
                onChange={(v) => setValue("sellerState", v, true)}
              />
            )}
          </FormField>
          <FormField id="rgst-place" label="Place of supply" error={errorFor("placeOfSupply")}>
            {(control) => (
              <StateSelect
                {...control}
                includeOutsideIndia
                placeholder="Not selected"
                value={values.placeOfSupply}
                onChange={(v) => setValue("placeOfSupply", v, true)}
              />
            )}
          </FormField>
        </div>
        <div className="flex items-start gap-2.5">
          <input
            id="rgst-sez"
            type="checkbox"
            checked={values.recipientIsSez}
            onChange={(e) => setValue("recipientIsSez", e.target.checked, true)}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <Label htmlFor="rgst-sez" className="leading-snug font-normal">
            The buyer is an SEZ unit or developer
          </Label>
        </div>
      </fieldset>

      <Button type="button" variant="ghost" onClick={reset}>
        <RotateCcw data-icon="inline-start" />
        Clear
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <CalculatorGrid
        form={form}
        result={
          <ResultPanel ready={outcome.ok}>
            {outcome.ok ? <ReverseGstResultView result={outcome.result} /> : null}
          </ResultPanel>
        }
      />
      <Explanation title="How this is calculated">
        <p>
          <strong className="text-foreground">Assumption:</strong> the price you enter already
          includes GST at the rate you select. The amount before GST is the price × 100 ÷ (100 + GST
          rate), rounded to the nearest paisa.
        </p>
        <p>
          GST is then calculated forwards on that amount in the same way as on SmartBill invoices.
          Because every figure is rounded to whole paise, a few prices cannot be split exactly; if
          so, the difference is shown rather than hidden.
        </p>
        <p>This calculator does not tell you which GST rate applies to a product or service.</p>
      </Explanation>
    </div>
  );
}

function ReverseGstResultView({ result }: { result: ReverseGstResult }) {
  const half = formatHalfRatePercent(result.rate.basisPoints);
  const supply = result.supplyType;
  const computedTotal = result.amountBeforeGstPaise + result.totalTaxPaise;
  const diff = result.differencePaise;

  return (
    <div className="space-y-4">
      {supply ? (
        <p className="text-sm font-medium text-primary" data-testid="supply-type">
          {describeSupply(supply)}
        </p>
      ) : null}
      <ResultList>
        <ResultRow
          label="Price including GST"
          value={formatPaise(result.pricePaise)}
          testId="price"
        />
        <ResultRow
          label="Amount before GST"
          value={formatPaise(result.amountBeforeGstPaise)}
          emphasis
          testId="amount-before-gst"
        />
        {supply?.kind === "intra-state" ? (
          <>
            <ResultRow
              label={`CGST @ ${half}%`}
              value={formatPaise(result.cgstPaise)}
              testId="cgst"
            />
            <ResultRow
              label={`${supply.stateTaxLabel} @ ${half}%`}
              value={formatPaise(result.sgstPaise)}
              testId="sgst"
            />
          </>
        ) : supply ? (
          <ResultRow
            label={`IGST @ ${result.rate.label}`}
            value={formatPaise(result.igstPaise)}
            testId="igst"
          />
        ) : null}
        <ResultRow
          label={`GST amount @ ${result.rate.label}`}
          value={formatPaise(result.totalTaxPaise)}
          testId="gst-amount"
        />
        {diff !== 0 ? (
          <ResultRow
            label="Amount before GST + GST"
            value={formatPaise(computedTotal)}
            testId="computed-total"
          />
        ) : null}
      </ResultList>
      {diff !== 0 ? (
        <div
          role="note"
          data-testid="rounding-note"
          className="flex gap-2.5 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm leading-relaxed text-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
          <div className="space-y-1">
            <p className="font-medium">
              These figures add up to {formatPaise(computedTotal)} — {Math.abs(diff)}{" "}
              {Math.abs(diff) === 1 ? "paisa" : "paise"} {diff < 0 ? "more" : "less"} than the{" "}
              {formatPaise(result.pricePaise)} you entered.
            </p>
            <p className="text-muted-foreground">
              GST has to be rounded to whole paise, and at {result.rate.label} no amount before GST
              adds up to exactly {formatPaise(result.pricePaise)}. Your entered price has not been
              changed.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
