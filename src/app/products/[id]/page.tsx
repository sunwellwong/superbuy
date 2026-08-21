export const runtime = "nodejs";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/ProductActions";

export const dynamic = "force-dynamic";
export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) notFound();

  const [img] = await db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, p.id))
    .limit(1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div
        style={{
          height: 360,
          background: "#f3f4f6",
          borderRadius: 12,
          backgroundImage: img ? `url(${img.url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div>
        <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{p.name}</h1>
        <div style={{ color: "#4f46e5", fontWeight: 700, fontSize: 22 }}>
          {Number(p.price).toFixed(2)} {p.currency}
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 16px" }}>SKU: {p.sku}</div>
        {p.description && <p style={{ color: "#374151", lineHeight: 1.6 }}>{p.description}</p>}
        <p style={{ fontSize: 13, color: "#6b7280" }}>Available stock: {p.stock}</p>
        <div style={{ marginTop: 16 }}>
          <AddToCart productId={p.id} />
        </div>
      </div>
    </div>
  );
}
