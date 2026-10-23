/**
 * BUSINESS LOGO
 * ═════════════
 * Optional logo for invoices, stored with the business profile in this browser.
 *
 * Safety and size rules:
 * - Only PNG and JPEG are accepted (no SVG, which can contain scripts).
 * - The image is decoded and redrawn on a canvas, then re-encoded. This shrinks it to at
 *   most 400 × 160 pixels and drops any hidden metadata from the original file (such as
 *   camera details or GPS location).
 * - The stored result must be under MAX_LOGO_BYTES, so it fits comfortably in browser
 *   storage next to drafts.
 * - Stored values are only ever used as an <img> source, and are re-checked with
 *   isValidLogoDataUrl whenever they are read back.
 */
export const LOGO_MAX_WIDTH = 400;
export const LOGO_MAX_HEIGHT = 160;
/** Largest accepted logo after resizing, in bytes of image data. */
export const MAX_LOGO_BYTES = 150_000;
/** Largest original file we try to process (it is resized afterwards). */
export const MAX_LOGO_UPLOAD_BYTES = 5_000_000;

const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Approximate decoded size of a base64 payload, in bytes. */
function base64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/** True for a well-formed PNG/JPEG data URL within the size limit. */
export function isValidLogoDataUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATA_URL.exec(value);
  if (!match || !match[2]) return false;
  return base64Bytes(match[2]) <= MAX_LOGO_BYTES;
}

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; message: string };

/** Pure check of the chosen file before any decoding work is done. */
export function checkLogoFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Choose a PNG or JPEG image.";
  }
  if (file.size > MAX_LOGO_UPLOAD_BYTES) {
    return "This image is too large (over 5 MB). Choose a smaller file.";
  }
  return null;
}

/** Scale (width, height) down to fit LOGO_MAX_WIDTH × LOGO_MAX_HEIGHT; never scales up. */
export function fitLogoSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, LOGO_MAX_WIDTH / width, LOGO_MAX_HEIGHT / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Browser only: decodes, resizes and re-encodes an uploaded logo.
 * PNGs stay PNG (keeps transparency); JPEGs are re-encoded as JPEG.
 */
export async function prepareLogo(file: File): Promise<LogoResult> {
  const problem = checkLogoFile(file);
  if (problem) return { ok: false, message: problem };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, message: "This file could not be read as an image." };
  }
  try {
    const { width, height } = fitLogoSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, message: "This browser could not process the image." };
    context.drawImage(bitmap, 0, 0, width, height);
    const dataUrl =
      file.type === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", 0.9);
    if (!isValidLogoDataUrl(dataUrl)) {
      return {
        ok: false,
        message:
          "This logo is still too large after resizing. Try a simpler image, or save it as a JPEG.",
      };
    }
    return { ok: true, dataUrl };
  } finally {
    bitmap.close();
  }
}
