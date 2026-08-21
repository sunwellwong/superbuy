export const runtime = "nodejs";
import { db } from "@/lib/db";
import { orders, users, orderItems, products } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { OrderActions } from "@/components/OrderActions";

const labels: Record<string, string> = {
  pending_quote: "Awaiting quote",
  pending_payment: "Awaiting payment",
  pending_shipment: "Awaiting shipment",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const dynamic = "force-dynamic";
export default async function AdminOrders() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/products");

  const rows = await db
    .select({
      id: orders.id,
      email: users.email,
      status: orders.status,
      quoteTotal: orders.quoteTotal,
      currency: orders.currency,
      trackingNo: orders.trackingNo,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(users, eq(orders.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(200);

  const ids = rows.map((o) => o.id);
  const itemsRows = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: products.name,
          qty: orderItems.qty,
          unitPrice: orderItems.unitPrice,
        })
        .from(orderItems)
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, ids))
    : [];

  const grouped: Record<string, typeof itemsRows> = {};
  itemsRows.forEach((it) => {
    (grouped[it.orderId] ||= []).push(it);
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Orders</h1>
      <div style={{ display: "grid", gap: 16 }}>
        {rows.map((o) => (
          <div key={o.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{o.email}</strong> · {labels[o.status] ?? o.status} ·{" "}
                {new Date(o.createdAt).toLocaleDateString()}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>#{o.id.slice(0, 8)}</div>
            </div>
            <ul style={{ fontSize: 13, margin: "10px 0" }}>
              {(grouped[o.id] ?? []).map((it, i) => (
                <li key={i}>
                  {it.name} × {it.qty} — {Number(it.unitPrice).toFixed(2)} {o.currency}
                </li>
              ))}
            </ul>
            {o.trackingNo && <div style={{ fontSize: 13, color: "#16a34a" }}>Tracking: {o.trackingNo}</div>}
            <div style={{ marginTop: 10 }}>
              <OrderActions orderId={o.id} currency={o.currency} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
