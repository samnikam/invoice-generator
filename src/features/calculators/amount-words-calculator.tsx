"use client";

import { RotateCcw } from "lucide-react";

import { AmountInput } from "@/components/forms/amount-input";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { runAmountWords } from "@/lib/calculators/amount-words";
import { formatPaise } from "@/lib/money/format";

import { CalculatorGrid } from "./components/calculator-layout";
import { CopyButton } from "./components/copy-button";
import { Explanation, ResultPanel } from "./components/result-panel";
import { useCalculatorForm } from "./components/use-calculator-form";

const INITIAL = { amount: "" };

export function AmountWordsCalculator() {
  const { values, setValue, markTouched, outcome, errorFor, reset } = useCalculatorForm(
    INITIAL,
    runAmountWords,
  );

  const form = (
    <form className="space-y-6" noValidate onSubmit={(e) => e.preventDefault()}>
      <FormField
        id="words-amount"
        label="Amount in rupees"
        hint="From ₹0 to ₹9,99,99,99,99,999.99, with up to 2 decimal places for paise. No commas."
        error={errorFor("amount")}
      >
        {(control) => (
          <AmountInput
            {...control}
            unit="₹"
            placeholder="e.g. 125000.50"
            value={values.amount}
            onChange={(e) => {
              setValue("amount", e.target.value);
              // Show problems as soon as something is typed: there is only one field.
              if (e.target.value !== "") markTouched("amount");
            }}
            onBlur={() => markTouched("amount")}
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
          <ResultPanel title="In words" ready={outcome.ok}>
            {outcome.ok ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground" data-testid="formatted-amount">
                  {formatPaise(outcome.result.amountPaise)}
                </p>
                <p
                  data-testid="words"
                  className="rounded-lg bg-muted/60 p-4 text-base leading-relaxed font-medium select-all"
                >
                  {outcome.result.words}
                </p>
                <CopyButton text={outcome.result.words} label="Copy words" />
              </div>
            ) : null}
          </ResultPanel>
        }
      />
      <Explanation title="About this converter">
        <p>
          Amounts are written in the Indian numbering system (thousand, lakh, crore), in the same
          style used on SmartBill documents — for example ₹1,50,000.50 is “Rupees One Lakh Fifty
          Thousand and Fifty Paise Only”.
        </p>
      </Explanation>
    </div>
  );
}
