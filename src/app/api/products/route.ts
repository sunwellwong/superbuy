export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, ilike, desc } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const conditions = [eq(products.status, "active")];
  if (q) conditions.push(ilike(products.name, `%${q}%`));

  const rows = await db
    .select()
    .from(products)
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(200);

  return NextResponse.json({
    products: rows.map((p) => ({ ...p, price: Number(p.price) })),
  });
}

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.number(), z.string()]),
  currency: z.string().optional(),
  stock: z.number().int().optional(),
  imageUrl: z.string().optional(),
  // Optional precomputed CLIP vector (computed in the browser to stay
  // compatible with Cloudflare Pages — the server never runs the model).
  embedding: z.array(z.number()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { sku, name, description, price, currency, stock, imageUrl, embedding } = parsed.data;

  const [product] = await db
    .insert(products)
    .values({
      sku,
      name,
      description: description ?? null,
      price: String(price),
      currency: currency ?? "EUR",
      stock: stock ?? 0,
    })
    .returning();

  if (imageUrl) {
    await db
      .insert(productImages)
      .values({ productId: product.id, url: imageUrl, embedding: embedding ?? null })
      .onConflictDoUpdate({
        target: productImages.productId,
        set: { url: imageUrl, embedding: embedding ?? null },
      });
  }

  return NextResponse.json({ product: { ...product, price: Number(product.price) } });
}
