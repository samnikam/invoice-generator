"use client";

import { RotateCcw } from "lucide-react";

import { AmountInput } from "@/components/forms/amount-input";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import {
  formatSignedPercent,
  runMarginCalculator,
  type MarginInput,
  type MarginResult,
} from "@/lib/calculators/margin-markup";
import { formatPaise } from "@/lib/money/format";

import { CalculatorGrid } from "./components/calculator-layout";
import { Explanation, ResultList, ResultPanel, ResultRow } from "./components/result-panel";
import { useCalculatorForm } from "./components/use-calculator-form";

const INITIAL: MarginInput = { cost: "", sellingPrice: "" };

export function MarginCalculator() {
  const { values, setValue, markTouched, outcome, errorFor, reset } = useCalculatorForm(
    INITIAL,
    runMarginCalculator,
  );

  const form = (
    <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormField
        id="margin-cost"
        label="Cost price"
        hint="What the item costs you."
        error={errorFor("cost")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 800"
            value={values.cost}
            onChange={(e) => setValue("cost", e.target.value)}
            onBlur={() => markTouched("cost")}
          />
        )}
      </FormField>
      <FormField
        id="margin-selling"
        label="Selling price"
        hint="What you sell it for. Use the same basis as the cost (both with or both without GST)."
        error={errorFor("sellingPrice")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 1000"
            value={values.sellingPrice}
            onChange={(e) => setValue("sellingPrice", e.target.value)}
            onBlur={() => markTouched("sellingPrice")}
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
            {outcome.ok ? <MarginResultView result={outcome.result} /> : null}
          </ResultPanel>
        }
      />
      <Explanation title="Margin and markup are different">
        <p>
          <strong className="text-foreground">Margin</strong> = profit ÷ selling price × 100. It
          shows how much of each sale is profit.
        </p>
        <p>
          <strong className="text-foreground">Markup</strong> = profit ÷ cost × 100. It shows how
          much you added on top of your cost.
        </p>
        <p>
          Example: cost ₹80 and selling price ₹100 give a profit of ₹20 — a 20% margin but a 25%
          markup. When you sell below cost, the loss and both percentages are shown as negative.
          Percentages are rounded to 2 decimal places.
        </p>
      </Explanation>
    </div>
  );
}

function MarginResultView({ result }: { result: MarginResult }) {
  const profitLabel =
    result.outcome === "loss"
      ? "Loss"
      : result.outcome === "profit"
        ? "Profit"
        : "Profit (break-even)";
  return (
    <div className="space-y-4">
      {result.outcome === "loss" ? (
        <p role="note" className="text-sm font-medium text-destructive" data-testid="loss-note">
          Selling price is below cost — this sale makes a loss.
        </p>
      ) : null}
      <ResultList>
        <ResultRow
          label={profitLabel}
          value={formatPaise(Math.abs(result.profitPaise))}
          emphasis
          testId="profit"
        />
        <ResultRow
          label="Profit margin"
          value={
            result.marginBasisPoints === null
              ? "Not defined (selling price is ₹0)"
              : formatSignedPercent(result.marginBasisPoints)
          }
          testId="margin"
        />
        <ResultRow
          label="Markup"
          value={
            result.markupBasisPoints === null
              ? "Not defined (cost is ₹0)"
              : formatSignedPercent(result.markupBasisPoints)
          }
          testId="markup"
        />
      </ResultList>
    </div>
  );
}
