export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages, products } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  // Precomputed CLIP vector from the browser (server does not run the model).
  vector: z.array(z.number()).length(512),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid 512-d vector. Upload an image to search." },
      { status: 400 }
    );
  }

  const vec = `{${parsed.data.vector.join(",")}}`;

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
      currency: products.currency,
      stock: products.stock,
      image: productImages.url,
      distance: sql<number>`${productImages.embedding} <=> ${vec}::vector`,
    })
    .from(productImages)
    .innerJoin(products, eq(productImages.productId, products.id))
    .where(sql`${productImages.embedding} IS NOT NULL`)
    .orderBy(sql`${productImages.embedding} <=> ${vec}::vector`)
    .limit(12);

  return NextResponse.json({
    results: rows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      price: Number(r.price),
      currency: r.currency,
      stock: r.stock,
      image: r.image,
      score: Number(r.distance),
    })),
  });
}
