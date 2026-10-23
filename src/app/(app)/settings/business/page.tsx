import type { Metadata } from "next";

import { BusinessProfileForm } from "@/features/profile/business-profile-form";

export const metadata: Metadata = {
  title: "Business profile",
  description: "Save your business details once and reuse them on new documents.",
};

export default function BusinessProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Business profile</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Save your business details once. New invoices, quotations and receipts will be filled in
          with them automatically.
        </p>
      </div>
      <BusinessProfileForm />
    </div>
  );
}
