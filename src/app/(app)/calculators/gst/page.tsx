import type { Metadata } from "next";

import { getCalculator } from "@/config/calculators";
import { CalculatorLayout } from "@/features/calculators/components/calculator-layout";
import { GstCalculator } from "@/features/calculators/gst-calculator";

const calculator = getCalculator("gst");

export const metadata: Metadata = {
  title: calculator.title,
  description: calculator.description,
};

export default function Page() {
  return (
    <CalculatorLayout slug="gst">
      <GstCalculator />
    </CalculatorLayout>
  );
}
