import { describe, expect, it } from "vitest";

import { siteConfig } from "@/config/site";

// Smoke test: proves Vitest, TypeScript and the "@/" import alias are wired up.
describe("siteConfig", () => {
  it("defines the product name and Indian locale defaults", () => {
    expect(siteConfig.name).toBe("SmartBill");
    expect(siteConfig.locale).toBe("en-IN");
    expect(siteConfig.currency).toBe("INR");
  });
});
