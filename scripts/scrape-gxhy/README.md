# gxhy1688.com → superbuyluxe 商品 CSV 采集工具

从 `https://gxhy1688.com/` 批量采集商品，生成 superbuyluxe 后台可直接导入的 CSV。

## 你的规则（已落实）
- **去重**：按款号 `model` / `id` / 归一化名称去重，只保留首次出现。
- **只同步首图**：每个商品只取图片列表里的**第一张**。
- **不同步价格**：`price` 列留空，由你后续人工填写（见下方 DDP 欧元价计算）。
- 品牌词默认清洗（降 IP 风险），可在 `scrape.mjs` 的 `BRAND_WORDS` 调整。

## 前置
```bash
npm i                 # 安装 playwright
npx playwright install chromium   # 下载无头浏览器（首次需要）
```

## 流水线
### 1) 侦察（先跑一次，把输出发我定稿）
```bash
node scrape.mjs inspect
```
会渲染站点、滚动加载，并打印：
- 候选商品卡片数 + 首张卡片 `outerHTML`
- 捕获到的所有 JSON 接口 URL 与字段名

> 因为沙箱无法渲染该 SPA，选择器是"按 SPA 通用结构"的初猜。把上面两段输出发我，我把 `scrape` 模式的选择器/接口定稿，你就能直接出 CSV。

### 2)（如需登录）有头模式手动登录
站点可能要求微信/手机号登录才出商品：
```bash
HEADLESS=0 LOGIN_WAIT=120 node scrape.mjs scrape
```
会在浏览器里等你登录 120 秒，再开始抓取。

### 3) 抓取 → 生成 CSV（价格留空）
```bash
node scrape.mjs scrape
# 产出 gxhy-products.csv：sku,name,price,currency,stock,description,image_url
# price 为空，currency 固定 EUR
```
可调环境变量：`MAX_PAGES`(默认50)、`STOCK`(默认0)、`DESC_MAX`(默认1000)、`CARD/TITLE/IMG/DESC/MODEL`(选择器)。

### 4) 你填采购价表 `costs.csv`
从最优渠道拿到每个 SKU 的采购价（CNY），建表：
```csv
sku,cost_cny
GXHY-M24707,530
GXHY-M46451,600
```

### 5) 算 DDP 欧元售价 → 最终导入 CSV
```bash
node ddp-price.mjs --in gxhy-products.csv --cost costs.csv --out gxhy-import.csv
```
公式（实时汇率）：
```
DDP(人民币) = 采购价 + 运费 150 + 利润 150
DDP(欧元)  = DDP(人民币) × 实时 EUR/CNY
```
匹配到的行 `price`=欧元 DDP 价、`currency`=EUR；未匹配行 `price` 留空。

单条试算：`node ddp-price.mjs 530`

### 6) 导入 superbuyluxe
把 `gxhy-import.csv` 贴到后台 `https://superbuyluxe.com/admin/products` 的 **Bulk import (CSV)** 框 → Import。
（后台导入按 SKU upsert；图片只存 URL、不算 CLIP 向量，故这些商品暂不进"以图搜图"。）

## 已知坑
- **图片热链**：gxhy 图片可能防盗链，外链易裂；如需稳定可改为下载图片自建图床（未在此工具内实现）。
- **以图搜图失效**：superbuyluxe 的 CSV 导入不计算图片向量，导入的商品不会出现在图搜结果（需再用单品表单补一次）。
- **合规**：源站多为复刻/原单奢侈品，品牌词已默认清洗；上架前仍请自行评估商标/IP 风险。
- **汇率源**：`open.er-api.com`（免 key）；可用 `RATE_CNY_EUR=0.123` 强制指定。
