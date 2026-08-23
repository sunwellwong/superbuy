// —— DDP (Delivered Duty Paid) pricing ——
// A product's selling price in EUR is derived, not stored:
//   ddpEur = (costCny + shippingCny + profitCny) * fxRateEurPerCny
// The EUR/CNY rate lives in the `settings` table (editable from the admin
// dashboard) so updating it instantly re-prices every product.
//
// Products created before cost tracking existed have costCny = NULL; for those
// we fall back to the legacy stored `price` column so nothing breaks.

import { db } from "./db";
import { settings } from "./schema";
import { eq } from "drizzle-orm";

export const FX_RATE_KEY = "fxRateEurPerCny";

// Default used only when no rate has been configured yet.
export const DEFAULT_FX_RATE = 0.127;

// In-memory cache for the FX rate. The rate changes rarely (only when an admin
// edits it in the dashboard), yet every product page / list / API currently
// re-queried the `settings` table on EVERY render — an extra ~360ms DB round
// trip per request on the edge runtime. Caching it here cuts that out.
// TTL is short enough that an admin FX change propagates within a minute.
const FX_CACHE_TTL_MS = 60_000;
let fxCache: { value: number; expires: number } | null = null;

export async function getFxRate(): Promise<number> {
  const now = Date.now();
  if (fxCache && fxCache.expires > now) return fxCache.value;
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, FX_RATE_KEY))
      .limit(1);
    const n = row?.value != null ? Number(row.value) : NaN;
    if (Number.isFinite(n) && n > 0) {
      fxCache = { value: n, expires: now + FX_CACHE_TTL_MS };
      return n;
    }
  } catch {
    // table may not exist yet on a very first boot; fall through to default
  }
  // On a cache miss that also fails to read, keep serving the stale value if we
  // have one rather than dropping to the default and mis-pricing everything.
  if (fxCache) return fxCache.value;
  return DEFAULT_FX_RATE;
}

// Compute the EUR DDP price for a product row.
// `costCny` may be null (legacy product) -> fall back to `fallbackPrice`.
export function ddpEur(
  costCny: number | string | null | undefined,
  shippingCny: number | string,
  profitCny: number | string,
  fxRate: number,
  fallbackPrice: number | string
): number {
  const cost = costCny == null ? null : Number(costCny);
  if (cost == null || Number.isNaN(cost)) {
    return Math.round(Number(fallbackPrice) * 100) / 100 || 0;
  }
  const total = cost + Number(shippingCny) + Number(profitCny);
  return Math.round(total * fxRate * 100) / 100;
}
