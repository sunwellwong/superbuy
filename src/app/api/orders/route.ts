import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cartItems, products, orders, orderItems, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows =
    user.role === "admin"
      ? await db
          .select({
            id: orders.id,
            userId: orders.userId,
            email: users.email,
            status: orders.status,
            quoteTotal: orders.quoteTotal,
            currency: orders.currency,
            trackingNo: orders.trackingNo,
            note: orders.note,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .innerJoin(users, eq(orders.userId, users.id))
          .orderBy(desc(orders.createdAt))
      : await db
          .select()
          .from(orders)
          .where(eq(orders.userId, user.id))
          .orderBy(desc(orders.createdAt));

  return NextResponse.json({
    orders: rows.map((o) => ({ ...o, quoteTotal: o.quoteTotal != null ? Number(o.quoteTotal) : null })),
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cart = await db
    .select({
      productId: cartItems.productId,
      qty: cartItems.qty,
      price: products.price,
      currency: products.currency,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, user.id));

  if (cart.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const currency = cart[0].currency;
  const [order] = await db
    .insert(orders)
    .values({ userId: user.id, status: "pending_quote", currency })
    .returning();

  await db.insert(orderItems).values(
    cart.map((c) => ({
      orderId: order.id,
      productId: c.productId,
      qty: c.qty,
      unitPrice: String(c.price),
    }))
  );

  await db.delete(cartItems).where(eq(cartItems.userId, user.id));

  return NextResponse.json({ order: { id: order.id, status: order.status } });
}
