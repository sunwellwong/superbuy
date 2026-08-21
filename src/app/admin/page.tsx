import { db } from "@/lib/db";
import { products, orders, sourcingRequests } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, sql, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/products");

  const [{ count: productCount }] = await db.select({ count: sql<number>`count(*)` }).from(products);
  const [{ count: quoteCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "pending_quote"));
  const [{ count: sourcingCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sourcingRequests)
    .where(eq(sourcingRequests.status, "open"));

  const stats = [
    { label: "Products", value: Number(productCount), href: "/admin/products" },
    { label: "Orders awaiting quote", value: Number(quoteCount), href: "/admin/orders" },
    { label: "Open sourcing requests", value: Number(sourcingCount), href: "/admin/sourcing" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Admin Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card" style={{ display: "block" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#4338ca" }}>{s.value}</div>
            <div style={{ color: "#6b7280", fontSize: 13 }}>{s.label}</div>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 24 }}>
        <Link href="/admin/invite" className="btn btn-primary">
          Manage invite codes
        </Link>
      </div>
    </div>
  );
}
