import Link from "next/link";
import { ReceiptIndianRupee } from "lucide-react";
import { cn } from "cn";

import { siteConfig } from "@/config/site";

type LogoProps = {
  href?: string;
  className?: string;
};

/** SmartBill brand mark: icon tile + product name. Links home by default. */
export function Logo({ href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
      >
        <ReceiptIndianRupee className="size-[18px]" />
      </span>
      <span className="text-[1.05rem]">{siteConfig.name}</span>
    </Link>
  );
}
