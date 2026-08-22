// scrape-gxhy — 从 gxhy1688.com 批量采集商品，生成 superbuyluxe 可导入的 CSV
//
// 规则（按你的要求）：
//   • 去重（按款号 model / id / 归一化名称）
//   • 只同步商品「第一个首图」
//   • 不同步价格（price 列留空，你后续人工填写；DDP 欧元价用 ddp-price.mjs 算）
//
// 用法：
//   node scrape.mjs inspect     # 渲染站点，自动打印真实接口 + 字段名 + 首张卡片 HTML（先跑这个，把输出发我定稿）
//   node scrape.mjs scrape      # 按下方 CONFIG 选择器抓取，写 gxhy-products.csv
//
// 环境变量（均可覆盖）：
//   GXHY_SITE   站点地址        默认 https://gxhy1688.com/
//   OUT         输出 CSV        默认 gxhy-products.csv
//   HEADLESS    0=有头(需登录)  默认 1（无头）
//   LOGIN_WAIT  需登录时等待秒数 默认 90（HEADLESS=0 时生效）
//   CARD/TITLE/IMG/DESC/MODEL   选择器（inspect 后微调）
//   STOCK       默认库存值       默认 0
//   DESC_MAX    描述截断长度     默认 1000
//   API_ENDPOINT/API_PAGE_PARAM/API_PAGE_SIZE/API_METHOD  # 若用接口直采（可选）

import { chromium } from "playwright";
import fs from "node:fs";

const SITE = process.env.GXHY_SITE || "https://gxhy1688.com/";
const MODE = process.argv[2] || "inspect";
const OUT = process.env.OUT || "gxhy-products.csv";
const HEADLESS = process.env.HEADLESS !== "0";
const LOGIN_WAIT = Number(process.env.LOGIN_WAIT || 90);
const STOCK = process.env.STOCK || 0;
const DESC_MAX = Number(process.env.DESC_MAX || 1000);

// ====== 选择器配置（inspect 后按真实结构微调）======
const CARD = process.env.CARD || ".product-item, .goods-item, [class*='productItem'], [class*='goodsItem'], [class*='ProductCard']";
const TITLE_SEL = process.env.TITLE || ".title, .name, [class*='title'], [class*='name']";
const IMG_SEL = "img";
const DESC_SEL = process.env.DESC || ".desc, .content, [class*='desc'], [class*='content'], [class*='detail']";
const MODEL_SEL = process.env.MODEL || ".model, .style-no, [class*='model'], [class*='styleNo'], [class*='sku']";
// ===================================================

// 品牌词清洗（降低 IP / 商标风险，可改）
const BRAND_WORDS = [
  "LOUIS VUITTON", "LV", "PRADA", "YSL", "GUCCI", "CHANEL", "HERMÈS", "HERMES",
  "DIOR", "BURBERRY", "FENDI", "BALENCIAGA", "COACH", "MICHAEL KORS", "MK",
];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cleanName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  for (const b of BRAND_WORDS) {
    const re = new RegExp(`\\b${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    s = s.replace(re, "");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function firstImageOf(imgs) {
  if (!imgs) return "";
  let arr = Array.isArray(imgs) ? imgs : String(imgs).split(/[,;|]/).map((x) => x.trim());
  arr = arr.filter(Boolean);
  return arr[0] || ""; // 只取第一个首图
}

function normKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function writeCsv(rows) {
  const header = ["sku", "name", "price", "currency", "stock", "description", "image_url"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.sku, r.name, r.price, r.currency, r.stock, r.description, r.image_url].map(csvEscape).join(","));
  }
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`✓ 写出 ${rows.length} 条 -> ${OUT}`);
}

async function extractCard(card) {
  const name = cleanName(await safeText(card, TITLE_SEL));
  const desc = (await safeText(card, DESC_SEL)).slice(0, DESC_MAX);
  const model = (await safeText(card, MODEL_SEL)).trim();
  const img = firstImageOf(await safeAttrAll(card, IMG_SEL, "src"));
  const id = (await card.getAttribute("data-id")) || "";
  const sku = (model ? "GXHY-" + model : "GXHY-" + (id || normKey(name).slice(0, 12) || "x"));
  return { sku, name, price: "", currency: "EUR", stock: STOCK, description: desc, image_url: img, _key: normKey(model) || normKey(id) || normKey(name) };
}

async function safeText(scope, sel) {
  try { const e = await scope.$(sel); return e ? (await e.innerText()).trim() : ""; } catch { return ""; }
}
async function safeAttrAll(scope, sel, attr) {
  try { const els = await scope.$$(sel); return (await Promise.all(els.map((e) => e.getAttribute(attr).catch(() => "")))).filter(Boolean); } catch { return []; }
}

// ---------------- inspect 模式 ----------------
async function inspect() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" });
  const apis = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] || "";
    if (ct.includes("application/json")) {
      try {
        const j = await res.json();
        const sample = Array.isArray(j) ? j[0] : j?.result?.records?.[0] || j?.records?.[0] || j?.data?.[0] || j?.rows?.[0] || j?.content?.[0] || j?.result?.[0];
        apis.push({ url: res.url(), status: res.status(), keys: sample ? Object.keys(sample) : Object.keys(j || {}) });
      } catch { /* ignore */ }
    }
  });

  console.log("→ 打开", SITE);
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  if (!HEADLESS) { console.log(`⏳ 需登录：请在浏览器里登录，等待 ${LOGIN_WAIT}s…`); await page.waitForTimeout(LOGIN_WAIT * 1000); }
  // 滚动触发懒加载
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 2500).catch(() => {}); await page.waitForTimeout(1200); }

  const cards = await page.$$(CARD);
  console.log(`\n=== DOM 探测 ===`);
  console.log(`候选商品卡片数 (选择器 "${CARD}"): ${cards.length}`);
  if (cards[0]) {
    const html = (await cards[0].evaluate((el) => el.outerHTML)).slice(0, 1500);
    console.log(`\n首张卡片 outerHTML（请发我这段，我据此定稿选择器）:\n${html}\n`);
    const ex = await extractCard(cards[0]);
    console.log(`首张卡片解析示例: ${JSON.stringify(ex, null, 2)}`);
  }

  console.log(`\n=== 捕获到的 JSON 接口（前 15 个）===`);
  for (const a of apis.slice(0, 15)) {
    console.log(`[${a.status}] ${a.url}\n   字段: ${a.keys.slice(0, 25).join(", ")}`);
  }
  console.log(`\n提示：把上面「JSON 接口」里疑似商品列表的那个 URL 和字段发我，或把首张卡片 HTML 发我，我就能把 scrape 模式的选择器/接口定稿。`);
  await browser.close();
}

// ---------------- scrape 模式（DOM） ----------------
async function scrape() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1" });
  await page.goto(SITE, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  if (!HEADLESS) { console.log(`⏳ 需登录：等待 ${LOGIN_WAIT}s…`); await page.waitForTimeout(LOGIN_WAIT * 1000); }

  const seen = new Set();
  const rows = [];
  let pageNo = 0;
  const MAX_PAGES = Number(process.env.MAX_PAGES || 50);

  while (pageNo < MAX_PAGES) {
    pageNo++;
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 2500).catch(() => {}); await page.waitForTimeout(1000); }
    const cards = await page.$$(CARD);
    let added = 0;
    for (const c of cards) {
      const ex = await extractCard(c);
      if (!ex._key && !ex.name) continue;
      if (seen.has(ex._key)) continue; // 去重
      seen.add(ex._key);
      rows.push(ex);
      added++;
    }
    console.log(`第 ${pageNo} 屏：本屏 ${cards.length} 张卡片，新增 ${added}，累计 ${rows.length}`);

    // 翻页：点“下一页”或无限滚动到底则退出
    const next = await page.$(process.env.NEXT || ".next, [class*='next'], [class*='Next']");
    if (next) { const ok = await next.click().catch(() => false); if (!ok) break; await page.waitForTimeout(1500); }
    else if (added === 0 && pageNo > 1) break; // 无更多
  }
  writeCsv(rows);
  await browser.close();
}

// ---------------- 入口 ----------------
if (MODE === "inspect") await inspect();
else if (MODE === "scrape") await scrape();
else { console.log("用法: node scrape.mjs [inspect|scrape]"); process.exit(1); }
