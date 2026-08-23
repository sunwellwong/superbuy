export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, ilike, desc } from "drizzle-orm";
import { z } from "zod";
import { getFxRate, ddpEur } from "@/lib/pricing";

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

  const fx = await getFxRate();

  return NextResponse.json({
    products: rows.map((p) => ({
      ...p,
      price: Number(p.price),
      ddpEur: ddpEur(p.costCny, p.shippingCny, p.profitCny, fx, p.price),
    })),
  });
}

const createSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  costCny: z.union([z.number(), z.string()]).optional(),
  shippingCny: z.union([z.number(), z.string()]).optional(),
  profitCny: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  stock: z.number().int().optional(),
  imageUrl: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
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
  const { sku, name, description, price, costCny, shippingCny, profitCny, currency, stock, imageUrl, category, brand, embedding } =
    parsed.data;

  const fx = await getFxRate();
  // Derive the stored EUR price from cost inputs when present; otherwise keep
  // the explicitly-provided price (legacy / single-price products).
  const ddp =
    costCny != null
      ? ddpEur(costCny, shippingCny ?? 150, profitCny ?? 150, fx, price ?? 0)
      : Number(price ?? 0);

  const [product] = await db
    .insert(products)
    .values({
      sku,
      name,
      description: description ?? null,
      price: String(ddp),
      costCny: costCny != null ? String(costCny) : null,
      shippingCny: shippingCny != null ? String(shippingCny) : "150",
      profitCny: profitCny != null ? String(profitCny) : "150",
      currency: currency ?? "EUR",
      stock: stock ?? 0,
      category: category ?? null,
      brand: brand ?? null,
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
