// scrape-gxhy — 从 gxhy1688.com 批量采集商品，生成 superbuyluxe 可导入的 CSV
//
// 站点需要登录 + 有阿里云设备风控。工作流：
//   1) 首次：在你的 Mac 上用有头浏览器登录一次，cookie 存盘
//        HEADLESS=0 node scrape.mjs login
//   2) 之后：无头自动抓（会自动加载 cookies.json）
//        node scrape.mjs scrape
//   3) 定稿选择器前先用 inspect 看真实结构：
//        node scrape.mjs inspect
//
// 规则：
//   • 去重（按归一化名称）
//   • 只同步第一个首图
//   • 用 gxhy「出厂价」作为 cost_cny；shipping/profit 默认 150；网站自动算欧元 DDP
//
// 环境变量（均可覆盖）：
//   GXHY_SITE    站点地址            默认 https://gxhy1688.com/
//   START_URL    起始页面            默认 GXHY_SITE 首页
//   QUERY        搜索关键词          默认空（在首页搜索框输入）
//   OUT          CSV 输出            默认 gxhy-products.csv
//   HEADLESS     0=有头(登录用)      默认 1（无头）
//   LOGIN_WAIT   有头登录等待秒数     默认 120
//   COOKIES      cookie 文件         默认 cookies.json
//   STOCK        默认库存            默认 0
//   DESC_MAX     描述截断长度        默认 500
//   MAX_SCROLL   最大滚动次数        默认 20
//   CLEAN_BRAND  是否清洗品牌词      默认 1
//   TARGET       目标去重后条数       默认 0（不限制）

import { chromium } from "playwright";
import fs from "node:fs";
import crypto from "node:crypto";

const SITE = process.env.GXHY_SITE || "https://gxhy1688.com/";
const START_URL = process.env.START_URL || "";
const QUERY = process.env.QUERY || "";
const MODE = process.argv[2] || "";
const OUT = process.env.OUT || "gxhy-products.csv";
const HEADLESS = process.env.HEADLESS !== "0";
const LOGIN_WAIT = Number(process.env.LOGIN_WAIT || 120);
const STOCK = process.env.STOCK || 0;
const DESC_MAX = Number(process.env.DESC_MAX || 500);
const MAX_SCROLL = Number(process.env.MAX_SCROLL || 20);
const CLEAN_BRAND = process.env.CLEAN_BRAND !== "0";
const COOKIES_FILE = process.env.COOKIES || "cookies.json";
const TARGET = Number(process.env.TARGET || 0);
const FILTER = process.env.FILTER || "";

const STEALTH_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--disable-infobars",
  "--no-sandbox",
];
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function newStealthPage(browser) {
  const page = await browser.newPage({
    userAgent: DESKTOP_UA,
    viewport: { width: 1366, height: 900 },
    locale: "zh-CN",
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };
  });
  return page;
}

function loadCookies() {
  try {
    const c = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf8"));
    console.log(`✓ 已加载 ${c.length} 个 cookie (${COOKIES_FILE})`);
    return c;
  } catch {
    return [];
  }
}
function saveCookies(cookies) {
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2), "utf8");
  console.log(`✓ cookie 已保存 -> ${COOKIES_FILE}（${cookies.length} 个）`);
}

// 品牌词清洗（降低商标/IP 风险）
const BRAND_WORDS = [
  "LOUIS VUITTON", "LV", "PRADA", "YSL", "GUCCI", "CHANEL", "HERMÈS", "HERMES",
  "DIOR", "BURBERRY", "FENDI", "BALENCIAGA", "COACH", "MICHAEL KORS", "MK",
  "ARC'TERYX", "始祖鸟", "巴宝莉", "博柏利", "古驰", "香奈儿", "爱马仕", "普拉达",
  "迪奥", "路易威登", "巴黎世家", "寇驰",
];

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function cleanName(raw) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  if (!CLEAN_BRAND) return s;
  for (const b of BRAND_WORDS) {
    const re = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    s = s.replace(re, "");
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function normKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
}

// ---------- 系列去重：同款不同色/不同型号只保留一条 ----------
const COLOR_WORDS = ["黑","白","红","粉","绿","蓝","黄","棕","紫","橙","灰","杏","咖","酒红","米色","驼色","藏青","天蓝","墨绿","浅","深","复古","黑武士","丹宁","牛仔","老花","油蜡皮","漆皮","绒面","麂皮","帆布","条纹","拼色","撞色","渐变","豹纹","斑马纹","棋盘格"];
const MATERIAL_WORDS = ["牛皮","羊皮","猪皮","PU","PVC","帆布","尼龙","涤纶","棉","麻","真皮","人造革","超纤","针织","编织","网面","麂皮","翻毛皮","磨砂皮"];
const GENERIC_WORDS = ["新款","新品","秋冬","春夏","更新","顶级","原单","版本","随意","对比","高级","轻奢","爆款","经典","时尚","百搭","通勤","休闲","女士","男士","男","女","中号","小号","大号","mini","迷你","中","小","大","短款","长款","加厚","薄款","宽松","修身","连帽","立领","圆领","V领","套头","开衫","拉链","系带","魔术贴","一脚蹬","高帮","低帮","中帮","板鞋","运动","跑步","篮球","足球","网球","老爹鞋","小白鞋","帆布鞋","拖鞋","凉鞋","靴子","短靴","长靴","雪地靴","马丁靴","工装靴"];
const KNOWN_SERIES = new Set(["EVELYN","JULIET","MOLLIE","MOLIE","FAYE","EMILY","ELODIE","SPEEDY","SEDY","CARRYALL","NEVERFULL","BARREL","LAUREL","EXPLORER","BANDOULIERE","BANDOULIER","IVY","WALLET","POCHETTE","BOUCHETTE","ONTHEGO","NOE","ALMA","KEEPALL","HANDBAG","TOTE","CROSSBODY","MESSENGER","BACKPACK","SHOULDER","CLUTCH"]);

function hash8(s) {
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 8).toUpperCase();
}

function extractModelCodes(s) {
  const re = /([A-Za-z][A-Za-z0-9]*\d+[A-Za-z0-9]*|\d+[A-Za-z][A-Za-z0-9]*)/g;
  return [...(s.match(re) || [])];
}

function cleanForSeries(raw) {
  let s = (raw || "")
    .replace(/💰\s*\d+(?:\.\d+)?/g, " ")
    .replace(/[￥$€]/g, " ")
    .replace(/[^\w\s\u4e00-\u9fa5]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const w of [...COLOR_WORDS, ...MATERIAL_WORDS, ...GENERIC_WORDS]) {
    s = s.split(w).join(" ");
  }
  return s.replace(/\s+/g, " ").trim();
}

function extractSeriesKey(desc) {
  const cleaned = cleanForSeries(desc);

  // 1) 已知系列名（最可靠）：同款不同色/不同型号只保留一条
  const upperClean = cleaned.toUpperCase();
  for (const k of KNOWN_SERIES) {
    if (upperClean.includes(k)) return k.toLowerCase();
  }

  // 2) 自动识别显著英文系列名（首字母大写/小写，≥3 位，且不是纯型号）
  const tokens = cleaned.match(/[A-Za-z][a-zA-Z]*\d*/g) || [];
  const seen = new Set();
  for (const t of tokens) {
    const bare = t.replace(/\d+$/, "");
    if (seen.has(bare)) continue;
    seen.add(bare);
    if (bare.length >= 3 && !/^\d+$/.test(bare) && (/[a-z]/.test(bare) || /^[A-Z]{4,}$/.test(bare))) {
      return bare.toLowerCase();
    }
  }

  // 3) 纯型号兜底
  const allCodes = extractModelCodes(cleaned);
  if (allCodes.length) return allCodes[0].toLowerCase();

  // 4) 完全无法识别：取前 16 个有效字符
  return normKey(cleaned).slice(0, 16) || hash8(cleaned);
}

function writeCsv(rows) {
  const header = ["sku", "name", "cost_cny", "shipping_cny", "profit_cny", "currency", "stock", "description", "image_url"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.sku, r.name, r.cost_cny, r.shipping_cny, r.profit_cny, r.currency, r.stock, r.description, r.image_url]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`✓ 写出 ${rows.length} 条 -> ${OUT}`);
}

// 在浏览器里解析一张卡片
function parseCardInBrowser(node, idx) {
  const fullText = (node.innerText || "").replace(/\s+/g, " ").trim();
  const lines = (node.innerText || "").split(/\n/).map((s) => s.trim()).filter(Boolean);

  // 图片：el-image 懒加载后的 img
  const imgEl = node.querySelector('.el-image img[src^="http"]');
  const image_url = imgEl ? imgEl.src : "";

  // 价格：优先红色 ￥xxx，再取第一个 💰xxx
  let cost_cny = "";
  const redPriceMatch = fullText.match(/￥\s*(\d+(?:\.\d+)?)(?!.*￥)/); // 最后一个 ￥价格
  const emojiPriceMatch = fullText.match(/💰\s*(\d+(?:\.\d+)?)/);
  if (redPriceMatch) cost_cny = redPriceMatch[1];
  else if (emojiPriceMatch) cost_cny = emojiPriceMatch[1];

  // 商户名：头像旁那个小字
  const merchantEl = node.querySelector('img[style*="border-radius: 50%"]');
  let merchant = "";
  if (merchantEl && merchantEl.parentElement) {
    const next = merchantEl.nextElementSibling;
    merchant = next ? (next.innerText || "").trim() : "";
  }

  // 描述：去掉商户名和最后的价格行，取剩余文本
  let description = lines
    .filter((l) => !l.includes("￥") && l !== merchant && !/^\d+(\.\d+)?$/.test(l))
    .join(" ")
    .trim();

  // 如果没拿到描述，退而用 fullText
  if (!description) description = fullText;

  // 名称：描述前 80 字
  const name = description.slice(0, 80).trim();

  // SKU：基于名称哈希，稳定去重
  const key = normKey(description);
  const sku = key ? `GXHY-${hash8(key)}` : `GXHY-${String(idx).padStart(4, "0")}`;

  return {
    sku,
    name,
    cost_cny,
    shipping_cny: 150,
    profit_cny: 150,
    currency: "EUR",
    stock: 0,
    description: description.slice(0, DESC_MAX),
    image_url,
    _key: key,
  };
}

async function scrollUntilStable(page, opts = {}) {
  const maxScroll = opts.maxScroll || MAX_SCROLL;
  const waitMs = opts.waitMs || 3000;
  // 先等首屏渲染
  await page.waitForTimeout(5000);
  let lastCount = 0;
  let stable = 0;
  let reachedNonZero = false;
  for (let i = 0; i < maxScroll; i++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
      window.dispatchEvent(new Event("resize", { bubbles: true }));
    });
    await page.waitForTimeout(waitMs);
    const count = await page.evaluate(() => document.querySelectorAll('div[style*="width: 242px"]').length);
    const loaded = await page.evaluate(() => document.querySelectorAll('div[style*="width: 242px"] .el-image img[src^="http"]').length);
    console.log(`  滚动 ${i + 1}/${maxScroll}：${count} 张卡片，${loaded} 张已加载图片`);
    if (count > 0) reachedNonZero = true;
    if (count === lastCount) {
      stable++;
      if (reachedNonZero && stable >= 3 && loaded >= count) {
        await page.waitForTimeout(waitMs);
        break;
      }
      if (!reachedNonZero && stable >= 8) break;
    } else {
      stable = 0;
      lastCount = count;
    }
  }

  // 兜底：逐张卡片滚进视口，强制 el-image 懒加载
  let loaded = await page.evaluate(() => document.querySelectorAll('div[style*="width: 242px"] .el-image img[src^="http"]').length);
  if (loaded < lastCount) {
    console.log(`  逐张触发懒加载 (${loaded}/${lastCount})…`);
    const cards = await page.$$('div[style*="width: 242px"]');
    for (let i = 0; i < cards.length; i++) {
      await cards[i].evaluate((el) => {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        window.dispatchEvent(new Event("scroll", { bubbles: true }));
      }).catch(() => {});
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(3000);
  }
}

// ---------------- login 模式（有头，存 cookie）----------------
async function login() {
  const browser = await chromium.launch({ headless: false, channel: "chromium", args: STEALTH_ARGS });
  const page = await newStealthPage(browser);
  console.log("→ 打开登录页，请在浏览器里手动登录 gxhy1688.com");
  console.log(`  登录完成后保持页面打开，脚本会在 ${LOGIN_WAIT}s 后自动保存 cookie；或登录后按 Ctrl+C 取消。`);
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(LOGIN_WAIT * 1000);
  const cookies = await page.context().cookies();
  saveCookies(cookies);
  await browser.close();
  console.log("=== login 完成，之后可直接 node scrape.mjs scrape ===");
}

// ---------------- inspect 模式 ----------------
async function inspect() {
  const browser = await chromium.launch({ headless: HEADLESS, channel: "chromium", args: STEALTH_ARGS });
  const page = await newStealthPage(browser);
  const cookies = loadCookies();
  if (cookies.length) await page.context().addCookies(cookies);

  console.log("→ 打开", SITE);
  await page.goto(SITE, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  if (!HEADLESS) { console.log(`⏳ 需登录：请在浏览器里登录，等待 ${LOGIN_WAIT}s…`); await page.waitForTimeout(LOGIN_WAIT * 1000); }

  await scrollUntilStable(page, { maxScroll: 10, waitMs: 2500 });

  const cards = await page.$$('div[style*="width: 242px"]');
  console.log(`\n=== DOM 探测 ===`);
  console.log(`候选商品卡片数: ${cards.length}`);
  if (cards[0]) {
    const html = (await cards[0].evaluate((el) => el.outerHTML)).slice(0, 1200);
    console.log(`\n首张卡片 outerHTML:\n${html}\n`);
    const ex = await cards[0].evaluate((el, descMax) => {
      const fullText = (el.innerText || "").replace(/\s+/g, " ").trim();
      const lines = (el.innerText || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
      const imgEl = el.querySelector('.el-image img[src^="http"]');
      const image_url = imgEl ? imgEl.src : "";
      let cost_cny = "";
      // 优先取批发价 💰xxx（成本），没有则取红色零售价 ￥xxx
      const emojiPriceMatch = fullText.match(/💰\s*(\d+(?:\.\d+)?)/);
      const redPriceMatch = fullText.match(/￥\s*(\d+(?:\.\d+)?)(?!.*￥)/);
      if (emojiPriceMatch) cost_cny = emojiPriceMatch[1];
      else if (redPriceMatch) cost_cny = redPriceMatch[1];
      const merchantEl = el.querySelector('img[style*="border-radius: 50%"]');
      let merchant = "";
      if (merchantEl && merchantEl.parentElement) {
        const next = merchantEl.nextElementSibling;
        merchant = next ? (next.innerText || "").trim() : "";
      }
      let description = lines
        .filter((l) => !l.includes("￥") && l !== merchant && !/^\d+(\.\d+)?$/.test(l))
        .join(" ")
        .trim();
      if (!description) description = fullText;
      return { name: description.slice(0, 80), cost_cny, image_url: image_url.slice(0, 120), description: description.slice(0, descMax) };
    }, DESC_MAX);
    console.log(`首张卡片解析示例: ${JSON.stringify(ex, null, 2)}`);
  }
  console.log(`\n提示：如果卡片结构正确，可直接运行 node scrape.mjs scrape`);
  await browser.close();
}

// ---------------- scrape 模式（DOM）----------------
async function scrape() {
  const browser = await chromium.launch({ headless: HEADLESS, channel: "chromium", args: STEALTH_ARGS });
  const page = await newStealthPage(browser);
  const cookies = loadCookies();
  if (cookies.length) await page.context().addCookies(cookies);

  const startUrl = START_URL || SITE;
  console.log("→ 打开", startUrl, QUERY ? `(搜索词: ${QUERY})` : "");
  await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

  // 首页登录兜底
  if (!HEADLESS && cookies.length === 0) { console.log(`⏳ 需登录：等待 ${LOGIN_WAIT}s…`); await page.waitForTimeout(LOGIN_WAIT * 1000); }

  // 若指定了搜索词，尝试在页面搜索框输入
  if (QUERY) {
    await performSearch(page, QUERY);
  }

  await scrollUntilStable(page);

  const rawRows = await page.evaluate((descMax) => {
    const cards = Array.from(document.querySelectorAll('div[style*="width: 242px"]'));
    return cards.map((node, idx) => {
      const fullText = (node.innerText || "").replace(/\s+/g, " ").trim();
      const lines = (node.innerText || "").split(/\n/).map((s) => s.trim()).filter(Boolean);
      const imgEl = node.querySelector('.el-image img[src^="http"]');
      const image_url = imgEl ? imgEl.src : "";

      let cost_cny = "";
      // 优先取批发价 💰xxx（成本），没有则取红色零售价 ￥xxx
      const emojiPriceMatch = fullText.match(/💰\s*(\d+(?:\.\d+)?)/);
      const redPriceMatch = fullText.match(/￥\s*(\d+(?:\.\d+)?)(?!.*￥)/);
      if (emojiPriceMatch) cost_cny = emojiPriceMatch[1];
      else if (redPriceMatch) cost_cny = redPriceMatch[1];

      const merchantEl = node.querySelector('img[style*="border-radius: 50%"]');
      let merchant = "";
      if (merchantEl && merchantEl.parentElement) {
        const next = merchantEl.nextElementSibling;
        merchant = next ? (next.innerText || "").trim() : "";
      }

      let description = lines
        .filter((l) => !l.includes("￥") && l !== merchant && !/^\d+(\.\d+)?$/.test(l))
        .join(" ")
        .trim();
      if (!description) description = fullText;

      return { idx, description, cost_cny, image_url, fullText };
    });
  }, DESC_MAX);

  // 系列去重：同款不同色/不同型号只保留一条
  const seriesMap = new Map();
  for (const r of rawRows) {
    const description = (r.description || "").slice(0, DESC_MAX).trim();
    if (!description) continue;
    const seriesKey = extractSeriesKey(description);
    const existing = seriesMap.get(seriesKey);
    // 保留：有图优先；同系列选价格最低（基础款）
    if (!existing ||
        (!!r.image_url && !existing.image_url) ||
        (Number(r.cost_cny || 0) < Number(existing.cost_cny || 0))) {
      seriesMap.set(seriesKey, r);
    }
  }

  let rows = [];
  for (const [seriesKey, r] of seriesMap) {
    const description = (r.description || "").slice(0, DESC_MAX).trim();
    const name = description.slice(0, 80).trim();
    rows.push({
      sku: `GXHY-${hash8(seriesKey)}`,
      name: cleanName(name),
      cost_cny: r.cost_cny,
      shipping_cny: 150,
      profit_cny: 150,
      currency: "EUR",
      stock: STOCK,
      description: cleanName(description),
      image_url: r.image_url,
      _seriesKey: seriesKey,
    });
  }

  // FILTER：按关键词过滤（如 FILTER=鞋 只保留描述含“鞋”的商品）
  if (FILTER) {
    const re = new RegExp(FILTER, "i");
    rows = rows.filter((r) => re.test(r.description) || re.test(r.name));
    console.log(`  应用 FILTER "${FILTER}" 后：${rows.length} 条`);
  }

  console.log(`\n=== 抓取结果 ===`);
  console.log(`原始卡片：${rawRows.length}，系列去重后：${rows.length}`);
  if (!rows.length) {
    console.log("⚠ 没有抓到有效商品。请先运行 node scrape.mjs inspect 检查页面结构。");
  }
  writeCsv(rows);
  await browser.close();
}

async function performSearch(page, query) {
  console.log(`→ 尝试搜索 "${query}"...`);
  await page.waitForTimeout(2000);

  // 策略 1：gxhy1688 首页搜索框 + 搜索按钮
  const input = await page.$('#input_jd');
  if (input) {
    try {
      await input.fill('');
      await input.fill(query);
      const searchBtn = await page.$('.Sharesourceindex_search');
      if (searchBtn) {
        await searchBtn.click();
        console.log(`  ✓ 通过首页搜索框+按钮提交`);
      } else {
        await input.press('Enter');
        console.log(`  ✓ 通过首页搜索框+Enter 提交`);
      }
      await page.waitForTimeout(4000);
      return;
    } catch (e) {
      // continue
    }
  }

  // 策略 2：通用搜索框兜底
  const searchSelectors = [
    'input[type="search"]',
    'input[placeholder*="搜索" i]',
    'input[placeholder*="Search" i]',
    'input.el-input__inner',
  ];
  for (const sel of searchSelectors) {
    const fallbackInput = await page.$(sel);
    if (fallbackInput) {
      try {
        await fallbackInput.fill(query);
        await fallbackInput.press('Enter');
        await page.waitForTimeout(3000);
        console.log(`  ✓ 通过通用搜索框 "${sel}" 提交`);
        return;
      } catch (e) {
        // continue
      }
    }
  }

  console.log("  ⚠ 搜索未生效，将抓取当前页内容");
}

// ---------------- 入口 ----------------
if (MODE === "inspect") await inspect();
else if (MODE === "scrape") await scrape();
else if (MODE === "login") await login();
else {
  console.log("用法: node scrape.mjs [inspect|scrape|login]");
  console.log("  inspect  渲染站点并打印真实 DOM 结构 / 商品接口（定稿选择器用）");
  console.log("  scrape   抓取商品写 CSV（自动加载 cookies.json）");
  console.log("  login    有头模式打开浏览器，手动登录后存 cookie（首次运行）");
  process.exit(1);
}
