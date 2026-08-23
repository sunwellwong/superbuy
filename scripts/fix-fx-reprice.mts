import "dotenv/config";
import { db } from "../src/lib/db";
import { sql } from "drizzle-orm";

// 1) 修正 settings 汇率：7.9 -> 0.127（与代码 DEFAULT_FX_RATE / 后台占位 0.1270 一致）
await db.execute(
  sql`UPDATE settings SET value = '0.127', updated_at = now() WHERE key = 'fxRateEurPerCny'`
);
console.log("✓ settings.fxRateEurPerCny -> 0.127");

// 2) 用同一 DDP 公式重算所有「按成本计价」的商品：
//    price = round((cost_cny + shipping_cny + profit_cny) * 0.127, 2)
const res = (await db.execute(
  sql`UPDATE products
      SET price = round((cost_cny + shipping_cny + profit_cny) * 0.127, 2)
      WHERE cost_cny IS NOT NULL
      RETURNING sku, cost_cny, price`
)) as any;
const rows = res.rows ?? [];
console.log(`✓ 重算价格完成，影响 ${rows.length} 条（cost_cny 非空）`);
for (const r of rows.slice(0, 8))
  console.log("   ", r.sku, "| cost=¥" + r.cost_cny, "-> price=EUR" + r.price);
