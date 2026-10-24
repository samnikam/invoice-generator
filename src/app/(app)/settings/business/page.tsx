import type { Metadata } from "next";

import { BusinessProfileForm } from "@/features/profile/business-profile-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Business profile",
  description: "Save your business details once and reuse them on new documents.",
};

export default function BusinessProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Business profile"
        description="Save your business details once. New invoices, quotations and receipts will be filled in with them automatically."
      />
      <BusinessProfileForm />
    </div>
  );
}
