export const runtime = "edge";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { and, eq, ilike, desc } from "drizzle-orm";
import Link from "next/link";
import { NameSearch } from "@/components/SearchBox";

export const dynamic = "force-dynamic";
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim();
  const conditions = [eq(products.status, "active")];
  if (q) conditions.push(ilike(products.name, `%${q}%`));

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      price: products.price,
      currency: products.currency,
      stock: products.stock,
      image: productImages.url,
    })
    .from(products)
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(200);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Products</h1>
        <NameSearch />
      </div>

      {rows.length === 0 && (
        <p style={{ color: "#6b7280" }}>No products yet.</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        {rows.map((p) => (
          <Link key={p.id} href={`/products/${p.id}`} className="card" style={{ display: "block" }}>
            <div
              style={{
                height: 150,
                background: "#f3f4f6",
                borderRadius: 8,
                marginBottom: 10,
                backgroundImage: p.image ? `url(${p.image})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            <div style={{ color: "#4f46e5", fontWeight: 600, marginTop: 4 }}>
              {Number(p.price).toFixed(2)} {p.currency}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Stock: {p.stock}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
