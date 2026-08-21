export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cartItems, products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await db
    .select({
      id: cartItems.id,
      qty: cartItems.qty,
      product: {
        id: products.id,
        sku: products.sku,
        name: products.name,
        price: products.price,
        currency: products.currency,
        stock: products.stock,
        image: productImages.url,
      },
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(cartItems.userId, user.id));

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      qty: i.qty,
      product: { ...i.product, price: Number(i.product.price) },
    })),
  });
}

const addSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).default(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { productId, qty } = parsed.data;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await db
    .insert(cartItems)
    .values({ userId: user.id, productId, qty })
    .onConflictDoUpdate({
      target: [cartItems.userId, cartItems.productId],
      set: { qty },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "Missing productId" }, { status: 400 });

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.userId, user.id), eq(cartItems.productId, productId)));

  return NextResponse.json({ ok: true });
}
