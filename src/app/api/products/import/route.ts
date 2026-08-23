export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { getFxRate, ddpEur } from "@/lib/pricing";

type Row = {
  sku: string;
  name: string;
  price: string;
  cost_cny: string;
  shipping_cny: string;
  profit_cny: string;
  currency: string;
  stock: string;
  description: string;
  image_url: string;
  category: string;
  brand: string;
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(rec: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = rec[k]?.trim() ?? "";
    if (v !== "") return v;
  }
  return "";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Missing csv field" }, { status: 400 });
  }

  const csvText: string = body.csv;
  if (csvText.trim().length === 0) {
    return NextResponse.json({ error: "CSV content is empty" }, { status: 400 });
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 });
  }

  const headers = rows[0].map(normalizeHeader);
  const hasNewFormat = headers.includes("cost_cny");
  const requiredHeaders = hasNewFormat
    ? ["sku", "name", "cost_cny"]
    : ["sku", "name", "price"];
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required CSV columns: ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const records: Row[] = rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = cells[i] ?? "";
    });
    return {
      sku: pick(rec, ["sku", "sku_"] as string[]),
      name: pick(rec, ["name", "title", "product_name"] as string[]),
      price: pick(rec, ["price", "selling_price"] as string[]),
      cost_cny: pick(rec, ["cost_cny", "cost", "factory_price"] as string[]),
      shipping_cny: pick(rec, ["shipping_cny", "shipping", "ship"] as string[]),
      profit_cny: pick(rec, ["profit_cny", "profit", "margin"] as string[]),
      currency: pick(rec, ["currency", "curr"] as string[]),
      stock: pick(rec, ["stock", "qty", "quantity"] as string[]),
      description: pick(rec, ["description", "desc"] as string[]),
      image_url: pick(rec, ["image_url", "image", "img_url", "img"] as string[]),
      category: pick(rec, ["category", "cat"] as string[]),
      brand: pick(rec, ["brand", "brand_name"] as string[]),
    } as Row;
  });

  const fx = await getFxRate();
  let imported = 0;

  for (const r of records) {
    if (!r.sku || !r.name) continue;
    const stock = r.stock ? parseInt(r.stock, 10) || 0 : 0;
    const cost = r.cost_cny ? Number(r.cost_cny) : null;
    const shipping = r.shipping_cny ? Number(r.shipping_cny) : 150;
    const profit = r.profit_cny ? Number(r.profit_cny) : 150;

    const price =
      cost != null && !Number.isNaN(cost)
        ? String(ddpEur(cost, shipping, profit, fx, r.price || 0))
        : r.price
          ? String(Number(r.price) || 0)
          : "0";

    const [upserted] = await db
      .insert(products)
      .values({
        sku: r.sku,
        name: r.name,
        description: r.description || null,
        price,
        costCny: cost != null ? String(cost) : null,
        shippingCny: String(shipping),
        profitCny: String(profit),
        currency: r.currency || "EUR",
        stock,
        category: r.category || null,
        brand: r.brand || null,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: r.name,
          price,
          costCny: cost != null ? String(cost) : null,
          shippingCny: String(shipping),
          profitCny: String(profit),
          currency: r.currency || "EUR",
          stock,
          description: r.description || null,
          category: r.category || null,
          brand: r.brand || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    imported++;

    if (r.image_url) {
      await db
        .insert(productImages)
        .values({ productId: upserted.id, url: r.image_url, embedding: null })
        .onConflictDoUpdate({
          target: productImages.productId,
          set: { url: r.image_url, embedding: null },
        });
    }
  }

  return NextResponse.json({ ok: true, imported });
}
