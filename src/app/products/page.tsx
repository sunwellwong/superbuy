export const runtime = "edge";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/schema";
import { and, eq, ilike, desc, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { NameSearch } from "@/components/SearchBox";
import { getFxRate, ddpEur } from "@/lib/pricing";

export const dynamic = "force-dynamic";

// 与 gxhy1688 共享货源分类 tab 保持一致
const CATEGORIES = ["全部", "鞋靴", "箱包", "服装", "手表", "配饰", "皮带", "美妆", "母婴", "电子数码", "百货"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; brand?: string }>;
}) {
  const { q: rawQ, cat: rawCat, brand: rawBrand } = await searchParams;
  const q = rawQ?.trim();
  const cat = rawCat?.trim() || "全部";
  const brand = rawBrand?.trim();

  const conditions = [eq(products.status, "active")];
  if (q) conditions.push(ilike(products.name, `%${q}%`));
  if (cat !== "全部") conditions.push(eq(products.category, cat));
  if (brand) conditions.push(eq(products.brand, brand));

  const brandConditions = [eq(products.status, "active"), isNotNull(products.brand)];
  if (cat !== "全部") brandConditions.push(eq(products.category, cat));

  const [rows, brandRows] = await Promise.all([
    db
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
        image: productImages.url,
      })
      .from(products)
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(products.createdAt))
      .limit(200),
    db
      .select({ brand: products.brand })
      .from(products)
      .where(and(...brandConditions))
      .groupBy(products.brand)
      .orderBy(products.brand),
  ]);

  const brands = brandRows.map((r) => r.brand).filter(Boolean) as string[];
  const fx = await getFxRate();
  const productsView = rows.map((p) => ({
    ...p,
    ddpEur: ddpEur(p.costCny, p.shippingCny, p.profitCny, fx, p.price),
  }));

  function qs(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    Object.entries(params).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
  }

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

      {/* 分类 tab */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>分类</div>
        <div
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
          }}
        >
          {CATEGORIES.map((c) => {
            const active = c === cat;
            return (
              <Link
                key={c}
                href={`/products${qs({ cat: c === "全部" ? undefined : c, brand: undefined })}`}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 999,
                  fontSize: 14,
                  textDecoration: "none",
                  background: active ? "#ef4444" : "#f3f4f6",
                  color: active ? "#fff" : "#374151",
                  border: "1px solid " + (active ? "#ef4444" : "transparent"),
                }}
              >
                {c}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 品牌筛选 */}
      {brands.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>品牌</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <Link
              href={`/products${qs({ cat: cat === "全部" ? undefined : cat, brand: undefined })}`}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                fontSize: 13,
                textDecoration: "none",
                background: !brand ? "#111827" : "#f3f4f6",
                color: !brand ? "#fff" : "#374151",
              }}
            >
              全部品牌
            </Link>
            {brands.map((b) => {
              const active = b === brand;
              return (
                <Link
                  key={b}
                  href={`/products${qs({ cat: cat === "全部" ? undefined : cat, brand: active ? undefined : b })}`}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 13,
                    textDecoration: "none",
                    background: active ? "#111827" : "#f3f4f6",
                    color: active ? "#fff" : "#374151",
                    border: "1px solid " + (active ? "#111827" : "transparent"),
                  }}
                >
                  {b}
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
        {productsView.map((p) => (
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
              {p.ddpEur.toFixed(2)} {p.currency} <span style={{ fontSize: 11, color: "#9ca3af" }}>DDP</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {p.category && (
                <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                  {p.category}
                </span>
              )}
              {p.brand && (
                <span style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>
                  {p.brand}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Stock: {p.stock}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
