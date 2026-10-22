import type { Metadata } from "next";

import { getCalculator } from "@/config/calculators";
import { CalculatorLayout } from "@/features/calculators/components/calculator-layout";
import { ReverseGstCalculator } from "@/features/calculators/reverse-gst-calculator";

const calculator = getCalculator("reverse-gst");

export const metadata: Metadata = {
  title: calculator.title,
  description: calculator.description,
};

export default function Page() {
  return (
    <CalculatorLayout slug="reverse-gst">
      <ReverseGstCalculator />
    </CalculatorLayout>
  );
}
