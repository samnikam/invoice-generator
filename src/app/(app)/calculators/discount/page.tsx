import type { Metadata } from "next";

import { getCalculator } from "@/config/calculators";
import { CalculatorLayout } from "@/features/calculators/components/calculator-layout";
import { DiscountCalculator } from "@/features/calculators/discount-calculator";

const calculator = getCalculator("discount");

export const metadata: Metadata = {
  title: calculator.title,
  description: calculator.description,
};

export default function Page() {
  return (
    <CalculatorLayout slug="discount">
      <DiscountCalculator />
    </CalculatorLayout>
  );
}
