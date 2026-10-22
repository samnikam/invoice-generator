import type { Metadata } from "next";

import { getCalculator } from "@/config/calculators";
import { CalculatorLayout } from "@/features/calculators/components/calculator-layout";
import { MarginCalculator } from "@/features/calculators/margin-calculator";

const calculator = getCalculator("margin");

export const metadata: Metadata = {
  title: calculator.title,
  description: calculator.description,
};

export default function Page() {
  return (
    <CalculatorLayout slug="margin">
      <MarginCalculator />
    </CalculatorLayout>
  );
}
