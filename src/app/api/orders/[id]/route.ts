export const runtime = "edge";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role !== "admin" && order.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      qty: orderItems.qty,
      unitPrice: orderItems.unitPrice,
      productId: orderItems.productId,
      sku: products.sku,
      name: products.name,
      image: productImages.url,
    })
    .from(orderItems)
    .innerJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(orderItems.orderId, id));

  return NextResponse.json({
    order: { ...order, quoteTotal: order.quoteTotal != null ? Number(order.quoteTotal) : null },
    items: items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) })),
  });
}

const patchSchema = z.object({
  action: z.enum(["quote", "ship"]),
  quoteTotal: z.number().optional(),
  trackingNo: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { action, quoteTotal, trackingNo } = parsed.data;

  if (action === "quote") {
    await db
      .update(orders)
      .set({
        quoteTotal: quoteTotal != null ? String(quoteTotal) : null,
        status: "pending_payment",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
  } else {
    await db
      .update(orders)
      .set({
        trackingNo: trackingNo ?? null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
  }

  return NextResponse.json({ ok: true });
}
