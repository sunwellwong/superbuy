// —— Shared WhatsApp helper ——
// Single source of truth for the WhatsApp number and the pre-filled inquiry
// messages used across CTAs. Keeps every "tap -> WhatsApp" link consistent.
// Mirrors the vaplynk site's approach.

import { CENTRAL_WA } from "./attrib";

export const WA_NUMBER = CENTRAL_WA;

// `waNumber` resolves to the attributed rep's WhatsApp on the client, or the
// central number during SSR / for organic visitors. See lib/attrib.ts.
export function waHref(message: string, waNumber: string = CENTRAL_WA): string {
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
}

// Default inquiry from the floating WhatsApp entry.
export const WA_DEFAULT_TEXT = "Hi SuperBuyLuxe, I'd like to inquire about private B2B sourcing and pricing.";
