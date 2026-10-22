import { describe, expect, it } from "vitest";

import { features } from "@/config/features";
import { appNav } from "@/config/navigation";

describe("feature catalogue", () => {
  it("has unique ids", () => {
    const ids = features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only gives a link to features that are available", () => {
    for (const feature of features) {
      if (feature.status === "available") {
        expect(feature.href, `${feature.id} is available but has no href`).toMatch(/^\//);
      } else {
        expect(feature.href, `${feature.id} is not available but has an href`).toBeUndefined();
      }
    }
  });

  it("sidebar never links to an unavailable feature", () => {
    const linkedHrefs = appNav.flatMap((g) => g.items).flatMap((i) => (i.href ? [i.href] : []));
    const unavailableHrefs = features.filter((f) => f.status !== "available").map((f) => f.href);
    for (const href of unavailableHrefs) {
      if (href) expect(linkedHrefs).not.toContain(href);
    }
    expect(linkedHrefs).toContain("/dashboard");
  });
});
