import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { parseCsv, csvToRecords } from "@/lib/csv";

type Row = {
  sku: string;
  name: string;
  price: string;
  currency: string;
  stock: string;
  description: string;
  image_url: string;
  category: string;
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.csv) {
    return NextResponse.json({ error: "Missing csv field" }, { status: 400 });
  }

  const rows = parseCsv(body.csv as string);
  if (rows.length < 2) {
    return NextResponse.json({ error: "No data rows found" }, { status: 400 });
  }

  const records = csvToRecords<Row>(rows, [
    "sku",
    "name",
    "price",
    "currency",
    "stock",
    "description",
    "image_url",
    "category",
  ]);

  let imported = 0;

  for (const r of records) {
    if (!r.sku || !r.name) continue;
    const price = r.price ? String(Number(r.price) || 0) : "0";
    const stock = r.stock ? parseInt(r.stock, 10) || 0 : 0;

    const [upserted] = await db
      .insert(products)
      .values({
        sku: r.sku,
        name: r.name,
        description: r.description || null,
        price,
        currency: r.currency || "EUR",
        stock,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: r.name,
          price,
          currency: r.currency || "EUR",
          stock,
          description: r.description || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    imported++;

    // Note: CSV import stores the image URL but does NOT compute a CLIP vector
    // (the model runs in the browser). Image search will match these once an
    // embedding is added via the single-product form, or you can re-embed later.
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
