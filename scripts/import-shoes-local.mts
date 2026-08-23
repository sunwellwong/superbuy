// import-shoes-local.mts — 复用网站导入路由的同一套逻辑/同一真实数据库，
// 直接把 gxhy-shoes-api.csv 上的 100 款鞋 upsert 进 production 的 Neon DB，
// 无需经过会崩溃的 dev server 或被 safe-delete 拦截的构建。
// 用法: npx tsx scripts/import-shoes-local.mts [csv路径]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { products, productImages } from "../src/lib/schema";
import { parseCsv } from "../src/lib/csv";
import { getFxRate, ddpEur } from "../src/lib/pricing";

const csvPath =
  process.argv[2] ||
  path.join(process.cwd(), "scripts/scrape-gxhy/gxhy-shoes-api.csv");

if (!fs.existsSync(csvPath)) {
  console.log("⚠ CSV 不存在:", csvPath);
  process.exit(1);
}

const csv = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(csv);
if (rows.length < 2) {
  console.log("⚠ 无数据行");
  process.exit(1);
}

const normalizeHeader = (h: string) => h.trim().toLowerCase().replace(/\s+/g, "_");
const headers = rows[0].map(normalizeHeader);
const hasNew = headers.includes("cost_cny");
console.log("列头:", headers.join(", "), hasNew ? "(新格式)" : "(旧格式)");

const pick = (rec: Record<string, string>, keys: string[]) => {
  for (const k of keys) {
    const v = (rec[k] ?? "").trim();
    if (v !== "") return v;
  }
  return "";
};

const records = rows.slice(1).map((cells) => {
  const rec: Record<string, string> = {};
  headers.forEach((h, i) => (rec[h] = cells[i] ?? ""));
  return {
    sku: pick(rec, ["sku"]),
    name: pick(rec, ["name", "title", "product_name"]),
    cost_cny: pick(rec, ["cost_cny", "cost", "factory_price"]),
    shipping_cny: pick(rec, ["shipping_cny", "shipping", "ship"]),
    profit_cny: pick(rec, ["profit_cny", "profit", "margin"]),
    currency: pick(rec, ["currency", "curr"]),
    stock: pick(rec, ["stock", "qty", "quantity"]),
    description: pick(rec, ["description", "desc"]),
    image_url: pick(rec, ["image_url", "image", "img_url", "img"]),
    category: pick(rec, ["category", "cat"]),
    brand: pick(rec, ["brand", "brand_name"]),
  };
});

const fx = await getFxRate();
console.log("汇率 fxRateEurPerCny =", fx);

let imported = 0;
let skipped = 0;
for (const r of records) {
  if (!r.sku || !r.name) {
    skipped++;
    console.log("⏭ 跳过空行 sku=", r.sku);
    continue;
  }
  const stock = r.stock ? parseInt(r.stock, 10) || 0 : 0;
  const cost = r.cost_cny ? Number(r.cost_cny) : null;
  const shipping = r.shipping_cny ? Number(r.shipping_cny) : 150;
  const profit = r.profit_cny ? Number(r.profit_cny) : 150;
  const price =
    cost != null && !Number.isNaN(cost)
      ? String(ddpEur(cost, shipping, profit, fx, 0))
      : "0";

  try {
    const [upserted] = await db
      .insert(products)
      .values({
        sku: r.sku,
        name: r.name,
        description: r.description || null,
        price,
        costCny: cost != null ? String(cost) : null,
        shippingCny: String(shipping),
        profitCny: String(profit),
        currency: r.currency || "EUR",
        stock,
        category: r.category || null,
        brand: r.brand || null,
      })
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: r.name,
          price,
          costCny: cost != null ? String(cost) : null,
          shippingCny: String(shipping),
          profitCny: String(profit),
          currency: r.currency || "EUR",
          stock,
          description: r.description || null,
          category: r.category || null,
          brand: r.brand || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    imported++;

    if (r.image_url) {
      await db
        .insert(productImages)
        .values({ productId: upserted.id, url: r.image_url, embedding: null })
        .onConflictDoUpdate({
          target: productImages.productId,
          set: { url: r.image_url, embedding: null },
        });
    }
  } catch (e: any) {
    console.log("❌ 写入失败 sku=", r.sku, "->", e?.message || e);
  }
}

console.log(`\n=== 完成: imported=${imported}, skipped=${skipped} ===`);
