export const runtime = "nodejs";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";

const labels: Record<string, string> = {
  pending_quote: "Awaiting quote",
  pending_payment: "Awaiting payment",
  pending_shipment: "Awaiting shipment",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const dynamic = "force-dynamic";
export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt));

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>My Orders</h1>
      {rows.length === 0 && <p style={{ color: "#6b7280" }}>No orders yet.</p>}
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((o) => (
          <div key={o.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 500 }}>Order {o.id.slice(0, 8)}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {labels[o.status] ?? o.status} · {new Date(o.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              {o.quoteTotal != null && (
                <div style={{ fontWeight: 600 }}>
                  {Number(o.quoteTotal).toFixed(2)} {o.currency}
                </div>
              )}
              {o.trackingNo && <div style={{ fontSize: 12, color: "#16a34a" }}>Track: {o.trackingNo}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
