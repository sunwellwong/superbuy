export const runtime = "edge";
import { db } from "@/lib/db";
import { sourcingRequests } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SourcingForm } from "@/components/SourcingActions";

const labels: Record<string, string> = {
  open: "Open",
  quoted: "Quoted",
  converted: "Converted",
  closed: "Closed",
};

export const dynamic = "force-dynamic";
export default async function SourcingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const rows = await db
    .select()
    .from(sourcingRequests)
    .where(eq(sourcingRequests.userId, user.id))
    .orderBy(desc(sourcingRequests.createdAt));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Sourcing Requests</h1>
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div style={{ fontWeight: 500 }}>{r.description}</div>
              {r.specs && <div style={{ fontSize: 13, color: "#6b7280" }}>{r.specs}</div>}
              {r.qty != null && <div style={{ fontSize: 13 }}>Qty: {r.qty}</div>}
              <div style={{ fontSize: 12, color: "#9333ea", marginTop: 4 }}>{labels[r.status] ?? r.status}</div>
              {r.adminReply && (
                <div style={{ fontSize: 13, background: "#f5f3ff", padding: 8, borderRadius: 6, marginTop: 6 }}>
                  Reply: {r.adminReply}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <p style={{ color: "#6b7280" }}>No requests yet.</p>}
        </div>
      </div>
      <SourcingForm />
    </div>
  );
}
