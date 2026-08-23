import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/ProductActions";
import { getFxRate, ddpEur } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Single query: product + its (at most one) image via LEFT JOIN.
  // Previously this page ran 3 sequential DB round-trips (product, image,
  // fx-rate) on the edge runtime — ~1.3s of pure DB latency per open.
  const rows = await db
    .select({ product: products, imageUrl: productImages.url })
    .from(products)
    .leftJoin(productImages, eq(productImages.productId, products.id))
    .where(eq(products.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const p = row.product;

  const fx = await getFxRate();
  const ddp = ddpEur(p.costCny, p.shippingCny, p.profitCny, fx, p.price);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div
        style={{
          height: 360,
          background: "#f3f4f6",
          borderRadius: 12,
          backgroundImage: row.imageUrl ? `url(${row.imageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{p.name}</h1>
        <div style={{ color: "#4f46e5", fontWeight: 700, fontSize: 22 }}>
          {ddp.toFixed(2)} {p.currency} <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 500 }}>DDP</span>
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 16px" }}>SKU: {p.sku}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {p.category && (
            <span style={{ fontSize: 12, color: "#ef4444", background: "#fef2f2", padding: "4px 10px", borderRadius: 999 }}>
              {p.category}
            </span>
          )}
          {p.brand && (
            <span style={{ fontSize: 12, color: "#111827", background: "#f3f4f6", padding: "4px 10px", borderRadius: 999 }}>
              {p.brand}
            </span>
          )}
        </div>
        {p.description && <p style={{ color: "#374151", lineHeight: 1.6 }}>{p.description}</p>}
        <p style={{ fontSize: 13, color: "#6b7280" }}>Available stock: {p.stock}</p>
        <div style={{ marginTop: 16 }}>
          <AddToCart productId={p.id} />
        </div>
      </div>
    </div>
  );
}
