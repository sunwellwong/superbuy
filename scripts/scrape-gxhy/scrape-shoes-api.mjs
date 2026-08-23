// scrape-shoes-api.mjs — 直接调用 gxhy 商品流 API（AES-128-ECB 加解密，key=wxtdefgabcdawn12），
// 按 typeId=4（鞋靴）分页拉取，解密后做「系列去重」(同款不同色/型号只留一条)，生成可导入 CSV。
// 无需浏览器：用 cookies.json 里的登录态直接 POST。
//
// 用法:
//   node scrape-shoes-api.mjs                 # 拉鞋靴(typeId=4)，系列去重后写 gxhy-shoes-api.csv (上限 TARGET)
//   TARGET=120 node scrape-shoes-api.mjs     # 目标去重后条数（默认 100）
//   TYPE_ID=7  node scrape-shoes-api.mjs     # 其它分类（7=箱包 等）
//   OUT=xxx.csv node scrape-shoes-api.mjs    # 指定输出
import fs from "node:fs";
import crypto from "node:crypto";

const KEY = "wxtdefgabcdawn12";
const API = "https://gxhy1688.com/market/getMarketFriendsTimeLineV2HasTotal.action?marketCode=gz";
const COOKIES_FILE = process.env.COOKIES || "cookies.json";
const TYPE_ID = process.env.TYPE_ID || "4";          // 4 = 鞋靴
const TARGET = Number(process.env.TARGET || 100);
const PAGE_SIZE = 50;
const MAX_PAGES = Number(process.env.MAX_PAGES || 30);
const OUT = process.env.OUT || "gxhy-shoes-api.csv";
const STOCK = process.env.STOCK || 0;
const DESC_MAX = Number(process.env.DESC_MAX || 500);
// 鞋类不做品牌清洗：清洗会把 "LV 26ss"/"LV 25ss" 都变成 "26ss"，导致不同型号被错误合并。
const CLEAN_BRAND = false;

// gxhy1688 typeId → 类目名称（与前端分类 tab 一一对应）。
// 当 TYPE_ID 为空字符串时（"全部"），默认不填类目，可用 CATEGORY 环境变量覆盖。
const CATEGORY_MAP = {
  "": process.env.CATEGORY || "",
  "4": "鞋靴",
  "7": "箱包",
  "5": "服装",
  "27": "手表",
  "28": "配饰",
  "26": "皮带",
  "29": "美妆",
  "1": "母婴",
  "30": "电子数码",
  "16": "百货",
};

// 品牌识别表：按「具体/长名优先」顺序匹配，避免 "YSL" 覆盖 "Saint Laurent"。
const BRAND_PATTERNS = [
  ["Saint Laurent", /saint\s*laurent|ysl|圣罗兰/],
  ["Louis Vuitton", /louis\s*vuitton\b|\blv\b|路易威登/],
  ["Bottega Veneta", /bottega\s*veneta|\bbv\b|葆蝶家/],
  ["Maison Margiela", /maison\s*margiela|马吉拉/],
  ["Balenciaga", /balenciaga|巴黎世家/],
  ["Audemars Piguet", /audemars\s*piguet|\bap\b|爱彼/],
  ["Maurice Lacroix", /maurice\s*lacroix|艾美/],
  ["Alo Yoga", /alo\s*yoga|\balo\b/],
  ["Under Armour", /under\s*armour|安德玛/],
  ["New Balance", /new\s*balance|\bnb\b/],
  ["Acne Studios", /acne\s*studios/],
  ["Jimmy Choo", /jimmy\s*choo/],
  ["Miu Miu", /miu\s*miu/],
  ["Tory Burch", /tory\s*burch/],
  ["Vivienne Westwood", /vivienne\s*westwood/],
  ["Van Cleef", /van\s*cleef|梵克雅宝/],
  ["Golden Goose", /golden\s*goose/],
  ["Alexander McQueen", /alexander\s*mcqueen/],
  ["Alexander Wang", /alexander\s*wang/],
  ["Dolce & Gabbana", /dolce\s*(?:&|\+)?\s*gabbana|\bd&g\b|杜嘉班纳/],
  ["Hermès", /herm[eè]s|爱马仕/],
  ["Chanel", /chanel|香奈儿/],
  ["Dior", /\bdior\b|迪奥/],
  ["Gucci", /gucci|古驰/],
  ["Prada", /prada|普拉达/],
  ["Celine", /celine|思琳/],
  ["Givenchy", /givenchy|纪梵希/],
  ["Fendi", /fendi|芬迪/],
  ["Burberry", /burberry|博柏利/],
  ["Valentino", /valentino|华伦天奴/],
  ["Versace", /versace|范思哲/],
  ["Loewe", /loewe|罗意威/],
  ["Celine", /celine|赛琳/],
  ["Adidas", /adidas|阿迪达斯/],
  ["Nike", /\bnike\b|耐克/],
  ["Asics", /asics|亚瑟士|鬼冢虎/],
  ["Ecco", /ecco|爱步/],
  ["On", /\bon\b|昂跑/],
  ["AMI", /\bami\b/],
  ["AHC", /\bahc\b/],
  ["3CE", /\b3ce\b/],
  ["Kiehl's", /kiehl['’]?s|科颜氏/],
  ["Amiri", /amiri|阿米里/],
  ["MLB", /\bmlb\b|美国职业棒球大联盟/],
  ["Guerlain", /guerlain|娇兰/],
  ["Lancôme", /lanc[oô]me|兰蔻/],
  ["Estée Lauder", /est[eé]e\s*lauder|雅诗兰黛/],
  ["SK-II", /sk[-\s]?ii|sk2/],
  ["La Mer", /la\s*mer|海蓝之谜/],
  ["Sisley", /sisley|希思黎/],
  ["Fresh", /fresh|馥蕾诗/],
  ["MAC", /\bmac\b|魅可/],
  ["NARS", /\bnars\b/],
  ["Tom Ford", /tom\s*ford|汤姆福特/],
  ["YSL Beauty", /ysl|圣罗兰/],
  ["Armani", /armani|阿玛尼/],
  ["Golden Goose", /golden\s*goose|\bggdb\b|黄金鹅/],
  ["Lemaire", /lemaire/],
  ["Common Projects", /common\s*projects/],
  ["Rick Owens", /rick\s*owens/],
  ["Off-White", /off[-\s]?white/],
  ["Palm Angels", /palm\s*angels/],
  ["Moncler", /moncler|盟可睐/],
  ["Canada Goose", /canada\s*goose|加拿大鹅/],
  ["Max Mara", /max\s*mara/],
  ["Thom Browne", /thom\s*browne/],
  ["Chrome Hearts", /chrome\s*hearts|克罗心/],
  ["Goyard", /goyard|戈雅/],
  ["Moynat", /moynat|莫奈/],
  ["Delvaux", /delvaux|德尔沃/],
  ["Bally", /bally/],
  ["Tod's", /tod['’]?s|托德斯/],
  ["Birkenstock", /birkenstock|勃肯/],
  ["UGG", /\bugg\b/],
  ["Crocs", /crocs|卡骆驰/],
  ["Hoka", /hoka|霍伽/],
  ["Salomon", /salomon|萨洛蒙/],
  ["Balmain", /balmain|巴尔曼/],
  ["Marni", /marni/],
  ["Jil Sander", /jil\s*sander/],
  ["The Row", /the\s*row/],
  ["Totême", /tot[eê]me/],
  ["Loro Piana", /loro\s*piana/],
  ["Brunello Cucinelli", /brunello\s*cucinelli/],
  ["Zegna", /zegna|杰尼亚/],
  ["Berluti", /berluti/],
  ["John Lobb", /john\s*lobb/],
  ["Church's", /church['’]?s/],
  ["Santoni", /santoni/],
  ["Magnanni", /magnanni/],
];

const BRAND_FALLBACK_SKIP = new Set([
  "代购级","全新升级","26春夏","春夏","秋冬","全家福","原版开发","代购级品质",
  "基础色","今年","爆款","新配色","闭眼入","必备","单品","每一个","色","都","很","好看",
  "融入","水钻","铆钉","掌纹","涂鸦","刺绣","等","细节","让","简约","的","焕发","新意",
  "增加","更多","配搭","可能性","鞋面","垫脚","鞋底","意大利","a级","双层","真皮","大底",
  "跟高","size","包装","飞机盒","全套","定做","不退换","长期做货","订单询","订单询价",
  "现货","可调换","新款","高品质出厂","顶级代购","高版本","男女情侣款","情侣款",
  "男码","女码","可定做","高端勿扰","低端勿扰","原版","定制","开模","手工","打磨",
]);

const ENGLISH_BRAND_SKIP = new Set([
  "SIZE","CM","MM","KG","NEW","TOP","BEST","HOT","VIP","URL","HTTP","HTTPS","HTML",
  "GG","AA","AAA","VIP","UK","US","EU","CN","JP","VIP","SALE","BUY","NOW","OFF",
]);

function normalizeBrand(s) {
  return s.replace(/[^A-Za-z0-9\u4e00-\u9fa5&]/g, "").trim();
}

function extractBrand(desc, title) {
  const text = `${title || ""} ${desc || ""}`;
  for (const [name, re] of BRAND_PATTERNS) {
    // 统一按忽略大小写匹配（很多描述里品牌名是小写，如 ggdb、lv）
    const ci = new RegExp(re.source, re.flags.includes("i") ? re.flags : re.flags + "i");
    if (ci.test(text)) return name;
  }

  // 备选 1：抓取文本中的英文/英文组合品牌名（如 LEMAIRE、GGDB、GOLDEN GOOSE）
  const englishCandidates = text.match(/[A-Z][A-Z0-9&]*(?:\s+[A-Z][A-Z0-9&]*)+/gi) || [];
  for (const raw of englishCandidates) {
    const u = raw.trim().toUpperCase();
    if (u.length < 2 || /^\d+$/.test(u)) continue;
    if (ENGLISH_BRAND_SKIP.has(u)) continue;
    // 常见缩写归一化
    if (/\bGGDB\b/i.test(u)) return "Golden Goose";
    if (/\bBV\b/i.test(u)) return "Bottega Veneta";
    if (/\bLV\b/i.test(u)) return "Louis Vuitton";
    if (/\bYSL\b/i.test(u)) return "YSL Beauty";
    if (/\bNB\b/i.test(u)) return "New Balance";
    // 优先保留原始大小写形式
    return raw.trim().length > 30 ? raw.trim().slice(0, 30) : raw.trim();
  }

  // 备选 2：清理后取第一个非通用中文/英文 token
  const cleaned = (desc || title || "")
    .replace(/💰\s*\d+(?:\.\d+)?/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/[￥$€]/g, " ")
    .replace(/[^\w\s\u4e00-\u9fa5&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const firstLine = cleaned.split(/\n/)[0] || cleaned;
  const tokens = firstLine.split(/\s+/);
  for (const t of tokens) {
    const u = t.trim();
    if (!u || u.length < 2) continue;
    if (/^\d+$/.test(u)) continue;
    if (BRAND_FALLBACK_SKIP.has(u)) continue;
    if (/[A-Z]/.test(u) || /[\u4e00-\u9fa5]/.test(u)) {
      return u.length > 25 ? u.slice(0, 25) : u;
    }
  }
  return "";
}

function encrypt(obj) {
  const c = crypto.createCipheriv("aes-128-ecb", Buffer.from(KEY), null);
  c.setAutoPadding(true);
  return Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), "utf8")), c.final()]).toString("base64");
}
function decrypt(b64) {
  const ct = Buffer.from(b64, "base64");
  const d = crypto.createDecipheriv("aes-128-ecb", Buffer.from(KEY), null);
  d.setAutoPadding(true);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
function cookieHeader() {
  const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf8"));
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
async function fetchPage(pageIndex, typeId = TYPE_ID) {
  const body = encrypt({
    minPrice: "", pageSize: PAGE_SIZE, typeId, pageIndex,
    sourceType: 0, maxPrice: "", mediaType: 0, crowdId: null, serviceId: null,
  });
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/wxt;charset=UTF-8", Cookie: cookieHeader() },
    body,
  });
  const txt = await res.text();
  try { return JSON.parse(decrypt(txt)); }
  catch { console.log("⚠ 解密/解析失败，原始前80:", txt.slice(0, 80)); return { data: { list: [] } }; }
}

// ---------------- 系列去重 ----------------
const COLOR_WORDS = ["黑","白","红","粉","绿","蓝","黄","棕","紫","橙","灰","杏","咖","酒红","米色","驼色","藏青","天蓝","墨绿","浅","深","复古","黑武士","丹宁","牛仔","老花","油蜡皮","漆皮","绒面","麂皮","帆布","条纹","拼色","撞色","渐变","豹纹","斑马纹","棋盘格"];
const MATERIAL_WORDS = ["牛皮","羊皮","猪皮","PU","PVC","帆布","尼龙","涤纶","棉","麻","真皮","人造革","超纤","针织","编织","网面","麂皮","翻毛皮","磨砂皮"];
const GENERIC_WORDS = ["新款","新品","秋冬","春夏","更新","顶级","原单","版本","随意","对比","高级","轻奢","爆款","经典","时尚","百搭","通勤","休闲","女士","男士","男","女","中号","小号","大号","mini","迷你","中","小","大","短款","长款","加厚","薄款","宽松","修身","连帽","立领","圆领","V领","套头","开衫","拉链","系带","魔术贴","一脚蹬","高帮","低帮","中帮","板鞋","运动","跑步","篮球","足球","网球","老爹鞋","小白鞋","帆布鞋","拖鞋","凉鞋","靴子","短靴","长靴","雪地靴","马丁靴","工装靴"];
const KNOWN_SERIES = new Set(["EVELYN","JULIET","MOLLIE","MOLIE","FAYE","EMILY","ELODIE","SPEEDY","SEDY","CARRYALL","NEVERFULL","BARREL","LAUREL","EXPLORER","BANDOULIERE","BANDOULIER","IVY","WALLET","POCHETTE","BOUCHETTE","ONTHEGO","NOE","ALMA","KEEPALL","HANDBAG","TOTE","CROSSBODY","MESSENGER","BACKPACK","SHOULDER","CLUTCH"]);

function hash8(s) { return crypto.createHash("sha256").update(s).digest("hex").slice(0, 8).toUpperCase(); }
function normKey(s) { return (s || "").toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, ""); }
function extractModelCodes(s) { return [...(s.match(/([A-Za-z][A-Za-z0-9]*\d+[A-Za-z0-9]*|\d+[A-Za-z][A-Za-z0-9]*)/g) || [])]; }
function cleanForSeries(raw) {
  let s = (raw || "").replace(/💰\s*\d+(?:\.\d+)?/g, " ").replace(/[￥$€]/g, " ").replace(/[^\w\s\u4e00-\u9fa5]/g, " ").replace(/\s+/g, " ").trim();
  for (const w of [...COLOR_WORDS, ...MATERIAL_WORDS, ...GENERIC_WORDS]) s = s.split(w).join(" ");
  return s.replace(/\s+/g, " ").trim();
}
function extractSeriesKey(desc) {
  const cleaned = cleanForSeries(desc);
  const upperClean = cleaned.toUpperCase();
  for (const k of KNOWN_SERIES) if (upperClean.includes(k)) return k.toLowerCase();
  const tokens = cleaned.match(/[A-Za-z][a-zA-Z]*\d*/g) || [];
  const seen = new Set();
  for (const t of tokens) {
    const bare = t.replace(/\d+$/, "");
    if (seen.has(bare)) continue; seen.add(bare);
    if (bare.length >= 3 && !/^\d+$/.test(bare) && (/[a-z]/.test(bare) || /^[A-Z]{4,}$/.test(bare))) return bare.toLowerCase();
  }
  const allCodes = extractModelCodes(cleaned);
  if (allCodes.length) return allCodes[0].toLowerCase();
  return normKey(cleaned).slice(0, 16) || hash8(cleaned);
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function extractImage(item) {
  try {
    const pl = item?.pics?.picList;
    if (Array.isArray(pl) && pl.length) return pl[0];
  } catch {}
  if (Array.isArray(item.gVos) && item.gVos.length) {
    for (const g of item.gVos) if (g && (g.url || g.image || g.pic || g.file)) return g.url || g.image || g.pic || g.file;
  }
  return item.image || item.picture || item.coverImage || item.firstPicture || "";
}

(async () => {
  const categoryName = CATEGORY_MAP[TYPE_ID] ?? "";
  const seriesMap = new Map();
  let page = 0;
  while (seriesMap.size < TARGET && page < MAX_PAGES) {
    const j = await fetchPage(page, TYPE_ID);
    const list = (j?.data?.list) || [];
    if (!list.length) { console.log(`第 ${page} 页无数据，停止`); break; }
    let added = 0;
    for (const it of list) {
      const desc = (it.description || it.title || "").slice(0, DESC_MAX).trim();
      if (!desc) continue;
      const seriesKey = extractSeriesKey(desc);
      const existing = seriesMap.get(seriesKey);
      const cost = Number(it.price || 0);
      const img = extractImage(it);
      const brand = extractBrand(desc, it.title);
      // 同系列：有图优先；再选价低（基础款）
      if (!existing || (!!img && !existing._img) || (cost > 0 && (existing.cost_cny === "" || cost < Number(existing.cost_cny)))) {
        seriesMap.set(seriesKey, {
          sku: `GXHY-${hash8(seriesKey)}`,
          name: desc.slice(0, 80).trim(),
          cost_cny: it.price != null ? String(it.price) : "",
          shipping_cny: 150, profit_cny: 150, currency: "EUR", stock: STOCK,
          description: desc, image_url: img, _img: img,
          category: categoryName,
          brand,
        });
        added++;
      }
    }
    console.log(`第 ${page} 页: +${list.length} 原始, +${added} 新系列, 累计系列 ${seriesMap.size}`);
    if (list.length < PAGE_SIZE) { console.log("已到末页"); break; }
    page++;
  }

  let rows = [...seriesMap.values()];
  if (rows.length > TARGET) rows = rows.slice(0, TARGET);
  console.log(`\n去重后共 ${rows.length} 款鞋（目标 ${TARGET}）`);

  const header = ["sku", "name", "cost_cny", "shipping_cny", "profit_cny", "currency", "stock", "description", "image_url", "category", "brand"];
  const lines = [header.join(",")];
  let withImg = 0;
  for (const r of rows) {
    if (r.image_url) withImg++;
    lines.push([r.sku, r.name, r.cost_cny, r.shipping_cny, r.profit_cny, r.currency, r.stock, r.description, r.image_url, r.category, r.brand].map(csvEscape).join(","));
  }
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`✓ 写出 ${rows.length} 条 -> ${OUT}  (其中 ${withImg} 条带图)`);
})();
