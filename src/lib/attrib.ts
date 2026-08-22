import { useState, useEffect } from "react";

// Sales-rep attribution (silent): maps a rep's custom-link code to their
// personal WhatsApp number. A customer arriving via /?ref=repXX has the code
// captured first-touch into localStorage, and every on-site WhatsApp entry
// then routes to that rep's number. No UI change, no message-text change.
// Unknown / empty / tampered code -> falls back to the central number.
//
// Mirrors the vaplynk site's logic exactly. Add reps to REP_CONFIG below.

export const CENTRAL_WA = "8613065720219";

export interface RepConfig {
  wa: string;
  name: string;
}

export const REP_CONFIG: Record<string, RepConfig> = {
  // rep01: { wa: "8613000000000", name: "Sales Rep 1" },
};

const REF_STORAGE_KEY = "sbl_ref";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

// Read ?ref= / ?utm_source= / ?utm_campaign= from the URL, normalized.
export function readRefFromUrl(): string | null {
  if (!hasWindow()) return null;
  const p = new URLSearchParams(window.location.search);
  const raw = p.get("ref") || p.get("utm_source") || p.get("utm_campaign");
  if (!raw) return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return REP_CONFIG[code] ? code : null;
}

// Attribution resolution. Priority (last-touch):
//   1. A valid ?ref= in the CURRENT url always wins — so clicking a rep's
//      custom link re-routes to that rep even if another rep was visited before.
//   2. Otherwise the previously stored code (survives SPA navigation).
//   3. Otherwise null -> caller falls back to the central number.
// Returns the rep code or null.
export function getRef(): string | null {
  if (!hasWindow()) return null;
  const fromUrl = readRefFromUrl();
  if (fromUrl) {
    try {
      window.localStorage.setItem(REF_STORAGE_KEY, fromUrl);
    } catch {
      /* ignore */
    }
    return fromUrl;
  }
  const stored = window.localStorage.getItem(REF_STORAGE_KEY);
  return stored && REP_CONFIG[stored] ? stored : null;
}

// The WhatsApp number to use for any on-site WA entry. SSR-safe: returns the
// central number during prerender, the rep's number on the client once captured.
export function getWaNumber(): string {
  const ref = getRef();
  return ref ? REP_CONFIG[ref].wa : CENTRAL_WA;
}

// Client hook: starts at CENTRAL_WA (so SSR markup matches and there is no
// hydration mismatch) and swaps to the rep's number after mount.
export function useWaNumber(): string {
  const [num, setNum] = useState(CENTRAL_WA);
  useEffect(() => {
    setNum(getWaNumber());
  }, []);
  return num;
}
