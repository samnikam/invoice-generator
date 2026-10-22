import type { Metadata } from "next";

import { getCalculator } from "@/config/calculators";
import { CalculatorLayout } from "@/features/calculators/components/calculator-layout";
import { AmountWordsCalculator } from "@/features/calculators/amount-words-calculator";

const calculator = getCalculator("amount-in-words");

export const metadata: Metadata = {
  title: calculator.title,
  description: calculator.description,
};

export default function Page() {
  return (
    <CalculatorLayout slug="amount-in-words">
      <AmountWordsCalculator />
    </CalculatorLayout>
  );
}
