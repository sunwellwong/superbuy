# gxhy1688.com → superbuyluxe 商品 CSV 采集工具

从 `https://gxhy1688.com/` 批量采集商品，生成 superbuyluxe 后台可直接导入的 CSV。

> ⚠️ **gxhy1688 实测需要登录 + 阿里云设备风控**。无头直接打首页会被打成空白（只返回备案号），
> 且首页是空壳、没有任何商品链接。必须**先拿到登录态**才能看到商品目录。
> 本工具已实现「一次有头登录、cookie 存盘、之后自动抓」的工作流。

## 你的规则（已落实）
- **去重**：按归一化名称去重，只保留首次出现；相同描述不同颜色的 variant 会被合并。
- **只同步首图**：每个商品只取卡片里懒加载后的**第一张**图。
- **成本价来源**：优先抓取 gxhy 的批发价 `💰xxx` 作为 `cost_cny`，没有则取红色零售价 `￥xxx`；
  `shipping_cny`/`profit_cny` 默认 150；网站后台会自动按 `(成本+运费+利润)×汇率` 算欧元 DDP 售价。
- 品牌词默认清洗（降 IP 风险），可在 `scrape.mjs` 的 `BRAND_WORDS` 调整或 `CLEAN_BRAND=0` 关闭。

## 前置
```bash
npm i                          # 安装 playwright
# 浏览器用已下好的完整 chromium（脚本里 channel:"chromium"），
# 无需再下卡死的 chrome-headless-shell
```

## 流水线
### 1) 首次：有头登录一次，cookie 存盘
在你**自己的 Mac** 上跑（需要有显示器、且你已在 gxhy1688 有账号）：
```bash
HEADLESS=0 LOGIN_WAIT=120 node scrape.mjs login
```
会弹出一个浏览器窗口 → 手动登录 gxhy1688 → 等 120 秒（或登录后直接关窗口）→
`cookies.json` 已保存。之后抓取会自动加载它。

### 2) 侦察真实结构（可选）
```bash
node scrape.mjs inspect
```
渲染站点、滚动加载，打印：候选商品卡片数 + 首张卡片解析示例。
如果输出正常，说明可以直接 scrape。

### 3) 抓取 → 生成 CSV
```bash
# 无头模式（默认，快，但图片可能部分加载失败）
node scrape.mjs scrape

# 有头模式（弹出窗口，图片加载率更高，但需显示器）
HEADLESS=0 LOGIN_WAIT=0 node scrape.mjs scrape

# 产出 gxhy-products.csv：
# sku,name,cost_cny,shipping_cny,profit_cny,currency,stock,description,image_url
```
可调环境变量：
- `MAX_SCROLL`  最大滚动次数，默认 20
- `STOCK`         默认库存，默认 0
- `DESC_MAX`      描述截断长度，默认 500
- `COOKIES`       cookie 文件，默认 cookies.json
- `CLEAN_BRAND`   是否清洗品牌词，默认 1
- `OUT`           输出 CSV，默认 gxhy-products.csv

### 4) 导入 superbuyluxe
把 `gxhy-products.csv` 贴到后台 `https://superbuyluxe.com/admin/products` 的 **Bulk import (CSV)** 框 → Import。
后台导入按 `sku` upsert 去重。

## 已知坑
- **图片懒加载**：gxhy 使用 Element UI 的 `el-image` 懒加载，无头模式下图片加载率不稳定（可能只有部分或为空）。
  如需图片，建议用 `HEADLESS=0 LOGIN_WAIT=0 node scrape.mjs scrape`；或导入后去商品详情页手动补图。
- **图片热链**：gxhy 图片可能防盗链，外链易裂；如需稳定可改为下载图片自建图床（未实现）。
- **以图搜图失效**：CSV 导入不计算图片向量，导入的商品不会出现在图搜结果。
- **合规**：源站多为复刻/原单奢侈品，品牌词已默认清洗；上架前仍请自行评估商标/IP 风险。
- **设备风控**：已用 `--disable-blink-features=AutomationControlled` + 去 webdriver 特征绕过；
  若仍被拦截，多半是登录态过期，重跑 `login` 刷新 cookie 即可。

## 文件
- `scrape.mjs` — 主程序（login / inspect / scrape 三模式）
- `stealth.mjs` — 反检测共享配置
- `dump.mjs`   — 排查用：打印首页链接 + 候选卡片 HTML
- `ddp-price.mjs` — （旧流程）手工算 DDP 的备用工具，当前抓取已直接产出 cost_cny，一般不再需要
