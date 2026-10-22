"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  runDiscountCalculator,
  type DiscountInput,
  type DiscountKind,
} from "@/lib/calculators/discount-calculator";
import { formatPaise } from "@/lib/money/format";
import { formatBasisPointsAsPercent } from "@/lib/money/percent";

import { AmountInput } from "./components/amount-input";
import { CalculatorGrid } from "./components/calculator-layout";
import { FormField } from "./components/form-field";
import { Explanation, ResultList, ResultPanel, ResultRow } from "./components/result-panel";
import { useCalculatorForm } from "./components/use-calculator-form";

const INITIAL: DiscountInput = { price: "", kind: "percent", value: "" };

const KINDS: readonly { value: DiscountKind; label: string }[] = [
  { value: "percent", label: "Percentage (%)" },
  { value: "amount", label: "Fixed amount (₹)" },
];

export function DiscountCalculator() {
  const { values, setValue, markTouched, outcome, errorFor, reset } = useCalculatorForm(
    INITIAL,
    runDiscountCalculator,
  );
  const isPercent = values.kind === "percent";

  const form = (
    <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormField
        id="discount-price"
        label="Original price"
        hint="The price before discount."
        error={errorFor("price")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 2500"
            value={values.price}
            onChange={(e) => setValue("price", e.target.value)}
            onBlur={() => markTouched("price")}
          />
        )}
      </FormField>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Discount type</legend>
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((kind) => (
            <label
              key={kind.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-accent/50"
            >
              <input
                type="radio"
                name="discount-kind"
                value={kind.value}
                checked={values.kind === kind.value}
                onChange={() => setValue("kind", kind.value)}
                className="size-4 shrink-0 accent-primary"
              />
              {kind.label}
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        id="discount-value"
        label={isPercent ? "Discount percentage" : "Discount amount"}
        hint={
          isPercent
            ? "Between 0 and 100, up to 2 decimal places."
            : "In rupees. Cannot be more than the original price."
        }
        error={errorFor("value")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit={isPercent ? "%" : "₹"}
            placeholder={isPercent ? "e.g. 10" : "e.g. 250"}
            value={values.value}
            onChange={(e) => setValue("value", e.target.value)}
            onBlur={() => markTouched("value")}
          />
        )}
      </FormField>

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
            {outcome.ok ? (
              <ResultList>
                <ResultRow
                  label="Original price"
                  value={formatPaise(outcome.result.originalPaise)}
                  testId="original"
                />
                <ResultRow
                  label={
                    outcome.result.discount.kind === "percent"
                      ? `Discount (${formatBasisPointsAsPercent(outcome.result.discount.basisPoints)}%)`
                      : "Discount"
                  }
                  value={`− ${formatPaise(outcome.result.discountPaise)}`}
                  testId="discount"
                />
                <ResultRow
                  label="Price after discount"
                  value={formatPaise(outcome.result.finalPaise)}
                  emphasis
                  testId="final"
                />
              </ResultList>
            ) : null}
          </ResultPanel>
        }
      />
      <Explanation title="How this is calculated">
        <p>
          A percentage discount is the original price × percentage ÷ 100, rounded to the nearest
          paisa (half a paisa rounds up). A fixed discount is taken off as entered.
        </p>
        <p>
          On SmartBill invoices, discounts are applied before GST, so GST is charged on the price
          after discount.
        </p>
      </Explanation>
    </div>
  );
}
