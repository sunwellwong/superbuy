export const runtime = "edge";
import { db } from "@/lib/db";
import { inviteCodes, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { InviteGen } from "@/components/AdminActions";

export const dynamic = "force-dynamic";
export default async function AdminInvite() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/products");

  const codes = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      usedBy: inviteCodes.usedBy,
      createdAt: inviteCodes.createdAt,
    })
    .from(inviteCodes)
    .orderBy(desc(inviteCodes.createdAt))
    .limit(200);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 16 }}>Invite Codes</h1>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6b7280" }}>
              <th style={{ padding: "6px 0" }}>Code</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={{ padding: "6px 0", fontFamily: "monospace" }}>{c.code}</td>
                <td>{c.role}</td>
                <td>{c.usedBy ? "used" : "active"}</td>
                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <InviteGen />
    </div>
  );
}
