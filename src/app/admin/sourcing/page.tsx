import { db } from "@/lib/db";
import { sourcingRequests, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SourcingReply } from "@/components/SourcingActions";

const labels: Record<string, string> = {
  open: "Open",
  quoted: "Quoted",
  converted: "Converted",
  closed: "Closed",
};

export const dynamic = "force-dynamic";
export default async function AdminSourcing() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/products");

  const rows = await db
    .select({
      id: sourcingRequests.id,
      email: users.email,
      description: sourcingRequests.description,
      specs: sourcingRequests.specs,
      qty: sourcingRequests.qty,
      imageUrl: sourcingRequests.imageUrl,
      status: sourcingRequests.status,
      adminReply: sourcingRequests.adminReply,
      createdAt: sourcingRequests.createdAt,
    })
    .from(sourcingRequests)
    .innerJoin(users, eq(sourcingRequests.userId, users.id))
    .orderBy(desc(sourcingRequests.createdAt))
    .limit(200);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sourcing Requests</h1>
      <div style={{ display: "grid", gap: 16 }}>
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{r.email}</strong>
              <span style={{ fontSize: 12, color: "#9333ea" }}>{labels[r.status] ?? r.status}</span>
            </div>
            <p style={{ margin: "8px 0" }}>{r.description}</p>
            {r.specs && <div style={{ fontSize: 13, color: "#6b7280" }}>{r.specs}</div>}
            {r.qty != null && <div style={{ fontSize: 13 }}>Qty: {r.qty}</div>}
            {r.imageUrl && (
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: "#f3f4f6",
                  borderRadius: 8,
                  marginTop: 8,
                  backgroundImage: `url(${r.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            )}
            {r.adminReply && (
              <div style={{ fontSize: 13, background: "#f5f3ff", padding: 8, borderRadius: 6, marginTop: 8 }}>
                {r.adminReply}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <SourcingReply requestId={r.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
