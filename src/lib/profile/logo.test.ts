import { describe, expect, it } from "vitest";

import { checkLogoFile, fitLogoSize, isValidLogoDataUrl, MAX_LOGO_BYTES } from "@/lib/profile/logo";

describe("logo checks", () => {
  it("accepts only PNG and JPEG files up to 5 MB before resizing", () => {
    expect(checkLogoFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(checkLogoFile({ type: "image/jpeg", size: 5_000_000 })).toBeNull();
    expect(checkLogoFile({ type: "image/svg+xml", size: 1000 })).toBe(
      "Choose a PNG or JPEG image.",
    );
    expect(checkLogoFile({ type: "image/gif", size: 1000 })).toBe("Choose a PNG or JPEG image.");
    expect(checkLogoFile({ type: "image/png", size: 5_000_001 })).toMatch(/too large/);
  });

  it("shrinks to fit 400 × 160 without stretching, and never enlarges", () => {
    expect(fitLogoSize(800, 320)).toEqual({ width: 400, height: 160 });
    expect(fitLogoSize(1000, 100)).toEqual({ width: 400, height: 40 });
    expect(fitLogoSize(320, 640)).toEqual({ width: 80, height: 160 });
    expect(fitLogoSize(200, 80)).toEqual({ width: 200, height: 80 });
  });

  it("validates stored data URLs strictly", () => {
    expect(isValidLogoDataUrl(`data:image/png;base64,${"A".repeat(40)}`)).toBe(true);
    expect(isValidLogoDataUrl(`data:image/jpeg;base64,${"A".repeat(40)}==`)).toBe(true);
    for (const bad of [
      "",
      42,
      null,
      "data:image/svg+xml;base64,PHN2Zz4=",
      "data:image/png,not-base64",
      "data:image/png;base64,abc def",
      "javascript:alert(1)",
      "https://example.com/logo.png",
    ]) {
      expect(isValidLogoDataUrl(bad), String(bad)).toBe(false);
    }
  });

  it("rejects data URLs over the size limit", () => {
    const fits = "A".repeat(Math.floor((MAX_LOGO_BYTES * 4) / 3));
    expect(isValidLogoDataUrl(`data:image/png;base64,${fits}`)).toBe(true);
    expect(isValidLogoDataUrl(`data:image/png;base64,${fits}AAAA`)).toBe(false);
  });
});
