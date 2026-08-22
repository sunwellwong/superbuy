// ddp-price.mjs — 实时汇率把「采购价 + 运费150 + 利润150」换算成欧元 DDP 售价
//
// 公式（你的规则）：
//   DDP(人民币) = 采购价(CNY) + 运费 150 + 利润 150
//   DDP(欧元)  = DDP(人民币) × 实时 EUR/CNY 汇率
//
// 用法：
//   1) 单条试算：
//      node ddp-price.mjs 530
//      → 打印 DDP 人民币、实时汇率、DDP 欧元
//
//   2) 批量：把 scrape 出的 CSV 和你的人工采购价表合并，产出最终可导入 CSV
//      node ddp-price.mjs --in gxhy-products.csv --cost costs.csv --out gxhy-import.csv
//        costs.csv 需含列：sku,cost_cny   （cost_cny = 你从最优渠道拿到的采购价）
//      匹配到的行：price = DDP欧元，currency = EUR；未匹配的行 price 留空。
//
// 汇率源：open.er-api.com（免 key）。也可用 env RATE_CNY_EUR 强制指定。

const SHIPPING = 150;
const PROFIT = 150;
const RATE_URL = "https://open.er-api.com/v6/latest/CNY";

function csvParse(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (c === "\r") {} else cur += c; }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
}
function csvEscape(v) { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }

async function getRate() {
  if (process.env.RATE_CNY_EUR) return Number(process.env.RATE_CNY_EUR);
  const r = await fetch(RATE_URL);
  const j = await r.json();
  if (!j?.rates?.EUR) throw new Error("汇率获取失败");
  return Number(j.rates.EUR);
}

async function main() {
  const args = process.argv.slice(2);
  const rate = await getRate();
  console.log(`实时 EUR/CNY 汇率 ≈ ${rate}  (1 CNY = ${rate} EUR)`);

  // 单条试算
  if (args.length && !args[0].startsWith("--")) {
    const cny = Number(args[0]);
    const ddpCny = cny + SHIPPING + PROFIT;
    const eur = +(ddpCny * rate).toFixed(2);
    console.log(`采购价 CNY ${cny} + 运费 ${SHIPPING} + 利润 ${PROFIT} = DDP CNY ${ddpCny}`);
    console.log(`→ DDP 欧元售价: €${eur}`);
    return;
  }

  // 批量合并
  const get = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const inFile = get("--in"), costFile = get("--cost"), outFile = get("--out") || "gxhy-import.csv";
  if (!inFile || !costFile) { console.log("批量用法: node ddp-price.mjs --in gxhy-products.csv --cost costs.csv [--out gxhy-import.csv]"); return; }

  const inRows = csvParse(fs.readFileSync(inFile, "utf8"));
  const costRows = csvParse(fs.readFileSync(costFile, "utf8"));
  const costMap = new Map();
  const cHead = costRows[0].map((h) => h.trim());
  const ciSku = cHead.indexOf("sku"), ciCost = cHead.indexOf("cost_cny");
  for (const r of costRows.slice(1)) costMap.set((r[ciSku] || "").trim(), Number(r[ciCost]));

  const head = inRows[0].map((h) => h.trim());
  const iSku = head.indexOf("sku"), iPrice = head.indexOf("price"), iCur = head.indexOf("currency"), iName = head.indexOf("name");
  const out = [head];
  let filled = 0;
  for (const r of inRows.slice(1)) {
    const sku = (r[iSku] || "").trim();
    const cost = costMap.get(sku);
    if (cost != null && !isNaN(cost)) {
      const ddpCny = cost + SHIPPING + PROFIT;
      const eur = +(ddpCny * rate).toFixed(2);
      if (iPrice >= 0) r[iPrice] = String(eur);
      if (iCur >= 0) r[iCur] = "EUR";
      filled++;
    }
    out.push(r);
  }
  fs.writeFileSync(outFile, out.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n", "utf8");
  console.log(`✓ 合并完成 -> ${outFile}（已填欧元 DDP 价 ${filled} 条，未匹配 ${out.length - 1 - filled} 条留空）`);
}

import fs from "node:fs";
main().catch((e) => { console.error(e.message); process.exit(1); });
