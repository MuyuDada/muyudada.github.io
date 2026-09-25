# 项目长期记忆 — muyudada.github.io

## 项目性质

Muyu 的个人主页，基于 [zyyo.cc](https://zyyo.cc) 模板魔改的**纯静态页面**，无构建工具。
全部逻辑集中在 `static/js/script.js`（单文件），样式在 `static/css/`。
部署走 GitHub Pages，另有 Caddyfile / Dockerfile / docker-compose.yaml 可选自托管。

## 用户信息

- 称呼：Muyu（站点署名 MuyuDada）
- 所在地：**河北省保定市涞源县**（海拔约 859m，山区县城）—— 注意站点页面上写的是「中国-河北」
- 页面里的 ICP 备案号是「豫ICP备…」（河南），**不代表所在地**

## 天气模块约定

- 数据源：Open-Meteo（免 Key）
- **定位方式：显示访问者所在地**（`weatherConfig.locationMode = "auto"`）
  链路：浏览器 GPS（距离校验）→ IP 定位（多源轮询）→ 兜底城市涞源
- `weatherConfig` 里 `fallback*` 是兜底坐标（39.3602, 114.6940），**不是固定显示值**；
  想改成只显示自己，把 `locationMode` 置为 `"fixed"`
- **不要用城市名反查坐标** —— Open-Meteo 中文地名库会把「保定」解析到云南、「涞源县」查不到
- **IP 定位必须多源轮询** —— 单一 IP 源实测会把访客解析到隔壁市（同一 IP 被 5 个库
  解析成涞源/保定/石家庄/承德，跨度 300km）
- 多级回退是串行的，**必须有总时限**（`locationDeadlineMs`），否则逐个超时会拖到几十秒
- 相关排查经验已沉淀为 skill：`cn-weather-widget`

## 气象站实测层（可选，需自建反代）

- Open-Meteo 在中国区**不是实测值**（ECMWF IFS 0.25° 模式插值，未同化国内站点观测），
  所谓「天气不准」的另一半原因在这里
- 中国天气网实况接口：`https://d1.weather.com.cn/sk_2d/{6位编码}.html` → `var dataSK={...}`
- **该接口按 Referer 校验，只认 `www.weather.com.cn`；而 Referer 是 JS 禁止修改的 header，
  所以 GitHub Pages 纯静态托管无法直接调用** —— 只有自建反代能补 Referer（Caddyfile 已配好）
- 页面侧：`stationApiEnabled` 开关 → `probeStationApi()` 探测 → 按坐标匹配最近县级站点 → 取实测覆盖。
  **不可用时静默降级**回 Open-Meteo，不报错
- `stationCoords` 是 1325 个站点坐标（31 省级区划，区县级），构建时经省级边界框三重校验，0 越界
- 站点气压 `qy` 是**本站气压**（高原 900 多 hPa），不是海平面气压，**不要**拿去覆盖 `pressure_msl`

## 协作约定

- 交付前用无头 Chromium 实际渲染验证，不只看源码（skill：`local-html-headless-verify`）
- 改动保持原生 JS 风格（`var` + `function`），与现有代码一致，不引入框架
- 注释用中文
