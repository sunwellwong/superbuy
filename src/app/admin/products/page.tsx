export const runtime = "edge";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ProductForm, CsvImport } from "@/components/ProductActions";
import { getFxRate, ddpEur } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export default async function AdminProducts() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/products");

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
      costCny: products.costCny,
      shippingCny: products.shippingCny,
      profitCny: products.profitCny,
      currency: products.currency,
      stock: products.stock,
      category: products.category,
      brand: products.brand,
      status: products.status,
    })
    .from(products)
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .orderBy(desc(products.createdAt))
    .limit(200);

  const fx = await getFxRate();

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Products</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        <div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6b7280" }}>
                <th style={{ padding: "6px 0" }}>SKU</th>
                <th>Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Cost</th>
                <th>DDP</th>
                <th>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: "6px 0" }}>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.category ?? "—"}</td>
                  <td>{p.brand ?? "—"}</td>
                  <td>{p.costCny != null ? `${Number(p.costCny).toFixed(0)} CNY` : "—"}</td>
                  <td>
                    {ddpEur(p.costCny, p.shippingCny, p.profitCny, fx, p.price).toFixed(2)} {p.currency}
                  </td>
                  <td>{p.stock}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "grid", gap: 16 }}>
          <ProductForm />
          <CsvImport />
        </div>
      </div>
    </div>
  );
}
