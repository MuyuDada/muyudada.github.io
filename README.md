<div align="center">

<img src="static/img/favicon.gif" width="120" alt="logo" />

# Muyu の 主页

永远相信美好的事情即将发生 ————

个人主页源码,纯静态页面,无需构建,包含**两套风格迥异的主页**。

在线访问:[https://muyudada.github.io](https://muyudada.github.io)

</div>

## 📖 项目简介

一套仓库里放了两套主页,各有各的味道,右上角/卡片上互相一键切换:

| 主页 | 入口 | 风格 |
| --- | --- | --- |
| **主页 1 · 完整版** | [`index.html`](index.html) | 基于 [zyyo.cc](https://zyyo.cc) 模板魔改。左右分栏、毛玻璃卡片、明暗主题、渐变手写标题,信息密度高 |
| **主页 2 · 简洁版** | [`jianjie/index.html`](jianjie/index.html) | 深色卡片式 Dashboard,单列信息流 + 双列网格。纯黑灰配色 + 紫色点缀,支持 PWA 离线 |

> 主页 1 的工具栏里有一枚 <kbd>✨</kbd> 按钮跳转到主页 2;主页 2 的「站点合集」首卡与**右键菜单 → 模式**可切回主页 1。

## ✨ 功能特性

### 主页 1(完整版)

- **一言 Hitokoto**:打字机效果逐字显示,每 20 秒自动刷新
- **当地时间**:实时时钟 + 中文日期(含星期)与时段问候,每秒更新
- **天气预报**:基于[和风天气 QWeather](https://www.qweather.com),**自动定位访问者所在地**(浏览器 GPS → IP 定位 → 兜底城市,逐级回退);可展开今日详情(风力、能见度、体感温度、湿度、气压、空气质量、云量、紫外线、降水量、日出日落、污染物浓度)
- **电脑状态卡**:展示本机当前前台应用(中文名 + 吐槽文案 + 图标)、在线 / 离开 / 锁屏 / 离线状态与窗口标题。纯静态站点读不到本机信息,因此由本机 PowerShell 脚本以「变化驱动 + 心跳」的方式上报到 Cloudflare Worker(前台应用一换就立刻上报,不变时在线 5 分钟一次心跳),页面只读 KV。另有一条 GitHub Gist 备用通道,主通道读不到新鲜数据时自动兜底(见 [worker/README.md](worker/README.md))
- **音乐播放器**:自研播放器(原生 Audio API)+ Meting 接口加载网易云歌单,支持歌词、播放列表、音量、播放模式
- **主题设置**:明暗主题切换(Cookie 持久化),背景/卡片的透明度、模糊度与卡片颜色可调(localStorage 持久化)
- **GitHub 贡献贪吃蛇**:明暗两套 SVG 随主题切换
- **站点运行时长**:建站起每秒累计的天/时/分/秒
- **输入特效**:输入框火焰特效 + 鼠标星尘拖尾
- **FPS 实时显示**:页面帧率监测
- **其他**:加载动画、图片弹窗(QQ / 赞赏码)、访问统计、时间线、个人标签、站点与项目展示、移动端响应式适配

### 主页 2(简洁版)

- **卡片式布局**:个人资料卡(头像 + 别名 + 所在地 + 座右铭 + 标签)、一言卡、时间天气卡、音乐卡、最新文章卡
- **时间天气卡**:与主页 1 同源的定位链与和风天气数据,左右两列中间以分隔线对齐卡片几何中心
- **音乐卡**:与主页 1 同一套播放器逻辑(歌词抽屉 / 列表抽屉展开时,同排卡片自动等高)
- **最新文章卡**:读取本地文章快照 `data/posts.json`,条数不设上限;卡片高度固定,文章多则内部滚动
- **终端模式**:**双击头像卡片**进入,支持 `help` / `cd` / `visit` / `douyin` 等命令
- **右键菜单**:赞赏、全屏、刷新、返回、切换模式、联系方式、关闭
- **随机背景**:随机背景壁纸 + 随机前景人物立绘,配合 Parallax 视差与 NodeCursor 跟随光标
- **PWA 支持**:`manifest.json` + Service Worker 离线缓存(仅缓存本站自有资源,第三方接口/CDN 直接放行)
- **细节**:动态网页标题(切走/切回时变化)、加载动画、进入问候弹窗、隐藏式页脚(鼠标移到底部出现)、移动端响应式

## 📁 目录结构

```text
.
├── index.html                # 主页 1(完整版)
├── jianjie/                  # 主页 2(简洁版)
│   ├── index.html
│   ├── manifest.json         # PWA 清单
│   ├── service-worker.js     # 离线缓存
│   ├── css/
│   │   ├── main.css          # 基础样式(卡片、标题、布局)
│   │   ├── fonts.css         # 字体声明(复用主页 1 的字体文件)
│   │   ├── layout.css        # 卡片式布局与新增组件样式
│   │   ├── dashboard.css     # 时间天气卡样式
│   │   ├── music.css         # 音乐卡样式
│   │   └── ...               # terminal / tab / Text / Right / loading / fira_code
│   ├── js/
│   │   ├── dashboard.js      # 当地时间 + 天气预报
│   │   ├── music.js          # 音乐播放器
│   │   ├── layout.js         # 一言卡片(打字机)
│   │   ├── rss.js            # 最新文章卡片
│   │   ├── terminal.js       # 终端模式
│   │   └── ...               # main / tab / Text / Right / loading / suiji-picture 等
│   ├── data/posts.json       # 博客文章快照
│   └── static/img/           # 主页 2 自有图片(头像、二维码、图标)
├── static/                   # 主页 1 资源
│   ├── css/                  # style.css / root.css(主题变量)
│   ├── js/script.js          # 主页 1 全部逻辑
│   ├── img/                  # 图片资源
│   ├── svg/                  # 贪吃蛇 SVG、技能图等素材
│   └── fonts/                # 自托管字体(霞鹜文楷 / Pacifico / Ubuntu)
├── worker/                   # 电脑状态中转(Cloudflare Worker + KV)
│   ├── device-status-worker.js  # 上报 / 读取 / 探活三个接口
│   ├── wrangler.toml         # KV 绑定与 Worker 名称
│   └── README.md             # 部署四步 + 接口文档
├── tools/                    # 本机上报脚本(Windows PowerShell)
│   ├── report-device.ps1     # 取前台窗口 + 空闲时长,POST 上报,并同步一份快照到 Gist
│   ├── install-device-task.ps1   # 注册开机自启的计划任务
│   └── uninstall-device-task.ps1 # 卸载计划任务
├── Caddyfile                 # Caddy 服务器配置
├── Dockerfile                # 基于 caddy:alpine 的镜像
└── docker-compose.yaml       # Docker Compose 编排
```

> 两个主页**共用** `static/fonts/` 里的字体文件 —— 主页 2 的 `jianjie/css/fonts.css` 用 `../../static/fonts/` 引用,不重复占仓库体积。

## 🎨 字体

两套主页使用完全相同的字体体系(定义见 [`static/css/style.css`](static/css/style.css) 与 [`jianjie/css/fonts.css`](jianjie/css/fonts.css)):

| 字体变量 | 字族 | 用途 |
| --- | --- | --- |
| `--font-cn` | `"a"` → 霞鹜文楷 LXGW ZhenKai | 中文正文 |
| `--font-en` | `"b"` → Ubuntu | 英文与界面正文(`body` 默认) |
| `--font-title` | `"title"` → Pacifico | 标题手写体(主页 1 的 "Hello I' m Muyu"、主页 2 的 "Muyu") |

字体全部**自托管**,不依赖 Google Fonts 等外部 CDN。主页 2 的 `fonts.css` 必须排在 `main.css` **之后**引入,否则覆盖不掉 `main.css` 里的 `Microsoft YaHei`。

## 🚀 本地预览

纯静态页面,任选其一:

```bash
# 方式一:直接用浏览器打开 index.html

# 方式二:起一个本地静态服务(推荐,Service Worker / 相对路径更接近线上)
python -m http.server 8080
# 主页 1:http://localhost:8080/
# 主页 2:http://localhost:8080/jianjie/
```

> 一言、天气、音乐等接口需联网才能正常加载。
>
> ⚠️ 主页 2 的字体路径是 `../../static/fonts/`,**必须从仓库根目录起服务**。若在 `jianjie/` 目录内起服务,`static/` 会越出文档根导致字体 404。

## 📦 部署

### GitHub Pages

1. Fork 或推送到你的 `<用户名>.github.io` 仓库
2. 仓库 Settings → Pages,选择 `main` 分支保存即可

### Docker 自建

```bash
git clone https://github.com/MuyuDada/muyudada.github.io.git
cd muyudada.github.io
# 将 Caddyfile 中的 example.com 改为你的域名
docker compose up -d
```

## 🔧 个性化配置

### 主页 1

主要改动集中在 [`index.html`](index.html) 和 [`static/js/script.js`](static/js/script.js):

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| `musicPlaylistConfig.id` | `static/js/script.js` | 网易云歌单 ID(取歌单链接中的 id) |
| `weatherConfig` | `static/js/script.js` | 天气定位方式、兜底城市与刷新间隔(见下) |
| `deviceStatusConfig` | `static/js/script.js` | 电脑状态卡:Worker 地址、备用通道(Gist)地址、轮询间隔、进程名→图标映射。`endpoint` 与 `fallbackEndpoint` 都留空则整张卡片自动隐藏 |
| `siteStartTime` | `static/js/script.js` | 建站起始时间(运行时长统计) |
| 社交链接 / 时间线 / 标签 / 项目卡片 | `index.html` | 按需替换为自己的内容 |
| 页面标题 / 描述 / 关键词 / ICP 备案号 | `index.html` | `<head>` 与 `<footer>` 中修改 |
| 主题配色 | `static/css/root.css` | `--main_bg_color`、`--item_bg_color` 等变量 |

### 主页 2

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| `dwWeatherConfig` | `jianjie/js/dashboard.js` | 天气定位与和风天气 Key(与主页 1 同结构) |
| `musicPlaylistConfig.id` | `jianjie/js/music.js` | 网易云歌单 ID |
| 文章快照 | `jianjie/data/posts.json` | 最新文章卡的数据源,重新生成即可更新 |
| 随机背景 / 前景图 | `jianjie/js/suiji-picture.js` | 两组图片 URL 数组 |
| 社交链接 / 站点合集 / 个人项目 | `jianjie/index.html` | 按需替换 |
| PWA 名称与图标 | `jianjie/manifest.json` | 应用名、主题色、图标 |
| **缓存版本号** | `jianjie/service-worker.js` | 见下方注意事项 |

> ⚠️ **改了主页 2 的 CSS / JS 后,必须把 `jianjie/service-worker.js` 的 `cacheName` 版本号 +1**。
> 该 Service Worker 是 **cache-first** 且安装时预缓存全部样式与脚本,不升版本号线上用户会一直拿到旧文件。

### 天气定位说明

天气默认**显示访问者所在地**,定位链为:

```
浏览器 GPS(带跑偏校验) → IP 定位(多源轮询) → 兜底城市
```

```js
var weatherConfig = {
    locationMode: "auto",        // "auto" 定位访客所在地(默认) | "fixed" 永远用兜底城市
    fallbackCity: "涞源",         // 定位全部失败时的兜底城市
    fallbackLatitude: 39.3602,
    fallbackLongitude: 114.6940,
    maxAutoDistanceKm: 80,       // 定位点离兜底城市超过该公里数即判定跑偏，继续往下一级回退
    requestTimeoutMs: 8000,      // 单个请求超时
    locationDeadlineMs: 6000,    // 整条定位链的总时限(多级回退是串行的，必须封顶)
    refreshIntervalMinutes: 15,  // 天气自动刷新间隔
    ipApis: [                    // 备用 IP 定位源，按顺序轮询，都必须支持 CORS
        "https://v2.xxapi.cn/api/ip",
        "https://whois.pconline.com.cn/ipJson.jsp?json=true"
    ],

    // ===================== 和风天气(QWeather)=====================
    // 认证必须走请求头 X-QW-Api-Key；旧的 ?key= 查询参数已废弃。
    // API Host 是每个账号专属的，不是公共的 api.qweather.com
    // (官方公告：公共地址自 2026 年起逐步停服)，换账号时这两项都要改。
    qweatherApiKey: "你的和风天气 API Key",
    qweatherApiHost: "https://xxxxxxxxxx.re.qweatherapi.com"
};
```

想固定显示某个城市,把 `locationMode` 改成 `"fixed"` 即可(不依赖任何第三方定位接口)。

> ⚠️ 这是纯静态站点,Key 随仓库公开、任何人可见并可消耗你的额度。如需保密,必须改成自建后端代理,把 Key 留在服务端。

**设计要点**(改动前请先读,都是踩过的坑):

1. **取数只用坐标,不用地名反查。** 地名仅用于显示。中文地名库不可靠 —— 实测「保定」会命中云南的一个村,「涞源县」则完全查不到。和风 v1 直接吃经纬度,同样不需要反查。
2. **IP 定位必须多源轮询。** 国内宽带 IP 归属地会跨市漂移,实测同一个 IP 被不同 IP 库分别解析成涞源 / 保定 / 石家庄 / 承德(跨度 300 km)。任一源异常/超时都自动切下一个源。
3. **电脑端浏览器 GPS 其实是 WiFi 定位库**,经常偏到隔壁市,所以用 `maxAutoDistanceKm` 做距离校验,跑偏就忽略并改走 IP 定位。
4. **所有定位请求都必须带超时**,且整条链要有总时限 —— 否则接口挂住不返回时,页面会一直停在「正在定位...」。
5. 定位类接口偶发失败是常态,所以任何一级都不能是单点,最后一定要能回退到兜底城市。

### 电脑状态卡

纯静态站点没有后端,读不到「本机正在用什么软件」,所以这条链路是**本机主动上报 + 云端中转**:

```
本机 PowerShell(变化驱动+心跳)  ──POST──▶  Cloudflare Worker  ──▶  KV
        │           ▲                                            │
        │           └────────── 取前台窗口 / 空闲时长              ▼
        │                                     访客浏览器  ◀──GET── 读取
        │
        └──(每次成功上报后再写一份快照)──▶  GitHub Gist  ◀──GET── 主通道读不到时兜底
```

**部署四步**(详细说明见 [worker/README.md](worker/README.md)):

```bash
npm i -g wrangler
wrangler login
wrangler kv namespace create DEVICE_KV   # 把返回的 id 填进 worker/wrangler.toml
cd worker && wrangler deploy
wrangler secret put REPORT_TOKEN         # 自定义一个口令
```

> ⚠️ **不要把 `*.workers.dev` 地址填进来**。该域名在部分网络(尤其国内)会被 DNS 污染,解析到不可达的 IP,表现为「关掉代理就取不到状态」。所以 `worker/wrangler.toml` 里已经配好一条自定义域名路由,把 Worker 挂在自己已接入 Cloudflare 的域名下:
>
> ```toml
> routes = [
>   { pattern = "muyuhome.cc.cd/api/device/*", zone_name = "muyuhome.cc.cd" }
> ]
> ```
>
> 它只接管 `/api/device/*`,该域名的其他路径(整站页面)不受影响。换成自己的域名时改 `pattern` 与 `zone_name` 两处再重新 `wrangler deploy` 即可。

然后把 Worker 上报地址填进 `tools/report-device.ps1` 顶部的 `$Endpoint`,口令写进 `tools/report-token.local`(该文件已在 `.gitignore` 中,不会进公开仓库;也可以改用环境变量 `MUYU_REPORT_TOKEN`)。先 `-Once` 试跑,确认无误后注册开机自启:

```powershell
powershell -ExecutionPolicy Bypass -File tools\report-device.ps1 -Once
powershell -ExecutionPolicy Bypass -File tools\install-device-task.ps1
```

最后把 Worker 的读接口地址填进 `static/js/script.js` 的 `deviceStatusConfig.endpoint`:

```js
var deviceStatusConfig = {
    endpoint: "https://muyuhome.cc.cd/api/device/status",
    fallbackEndpoint: "https://gist.githubusercontent.com/<你>/<gist-id>/raw/device.json",  // 备用通道,留空则不用
    refreshIntervalSeconds: 60,     // 前端轮询间隔
    requestTimeoutMs: 8000,         // 单请求超时,超时按离线处理
    staleAfterSeconds: 600,         // 仅本地参考;权威值在 Worker 侧,由上报的心跳间隔自动推算
    iconMap: { ... },               // 进程名 → Font Awesome 图标
    keywordIcons: [ ... ]           // 没命中时的关键词兜底
};
```

> 注册计划任务时 `New-ScheduledTaskTrigger -AtLogOn` **必须带 `-User`**。不带 `-User` 的触发器属于「任意用户登录」,注册需要管理员权限,普通账户会直接报 `Access is denied (0x80070005)`;带上当前用户后普通账户即可注册。

#### 备用通道(GitHub Gist)

主通道整条链路都在 Cloudflare 上(域名被污染、Worker 故障、KV 额度耗尽都会失效),所以加了一条完全独立的兜底:

1. 建一个 **secret gist**,里面放一个 `device.json`(内容随意,会被覆盖);
2. 把 gist id 写进 `tools/gist-id.local`;
3. 让上报脚本能拿到一个**带 `gist` scope** 的 GitHub 令牌 —— 环境变量 `MUYU_GITHUB_TOKEN`,或写进 `tools/github-token.local`,或直接复用 git 凭据管理器里那个(脚本会自动去取)。

之后每次成功上报都会顺带把同一份 JSON `PATCH` 到 gist(最快 60 秒一次),前端在主通道读不到新鲜数据时改读它。三个 `.local` 文件都已在 `.gitignore` 里。加 `-NoSnapshot` 可整体关掉。

> 实测要点:GitHub raw 走 Fastly CDN,默认 `max-age=300`,但**给 URL 挂一个随机查询串就能让它回 MISS**(缓存键包含 query string),所以前端加了 `?t=<时间戳>` 来保鲜。即便如此仍会读快照里的 `reportedAt` 在本地判一次时效 —— 万一 CDN 还是发了旧副本,也不会把「早就离线」显示成「在线」。快照写入是尽力而为:失败只打一行黄字,绝不影响主通道。

**设计要点**:

1. **`endpoint` 留空 = 功能未启用**,JS 会直接把整张卡片 `hidden`,页面上不会留一块空白,所以没部署也可以安心提交。
2. **上报与展示的职责分离**:应用中文名与吐槽文案在**本机脚本**里映射(那张 100+ 条的 `$AppMap`),Worker 只做字段白名单与长度截断,前端不做业务映射 —— 想加新应用只改本机脚本,不用重新部署前端。
3. **状态分级**:`online`(在用)/ `away`(空闲 >5 分钟)/ `locked`(无前台窗口,已锁屏)/ `offline`(上报断流)。前三种由本机判断,`offline` 由 Worker 判定。**离线阈值不用手动同步**:上报脚本会把当前心跳间隔(`heartbeatSeconds`)一起报上来,Worker 按「心跳 × 2」自动推算,改心跳只需改本机脚本,两端不会失配;前端拿到 `online:false` 就渲染离线态。
4. **失败不清空**:请求失败时只把状态角标改成「离线」并保留上一次的内容,避免网络抖动让卡片闪成空白。
5. **后台标签页不轮询**:`document.visibilityState !== "visible"` 时跳过,切回前台若距上次成功超过 20 秒立刻补一次 —— 后台定时器会被浏览器降频,不能只依赖 `setInterval`。
6. **读接口公开、写接口带口令**:与常见做法一致 —— 访客要能看到状态,所以 `GET` 放开跨域;`POST` 必须带 `X-Report-Token`,Worker 侧用恒定时间比较避免逐位爆破。
7. **省 KV 额度靠「变化驱动」而非「拉长间隔」**:KV 免费额度瓶颈是**写**(每天 1000 次),固定 30 秒上报 = 2880 次/天,必然爆。所以本机每 15 秒读一次前台窗口(纯本地调用,零网络开销),只有应用身份变了才上报,不变时只发心跳(在线 5 分钟、空闲 10 分钟)。这样挂机约 288 写/天,而状态切换依然是**秒级实时**的 —— 拉长上报间隔会牺牲实时性,变化驱动不会。
8. **两条独立链路互为备份**:主通道走 Cloudflare,备用通道走 GitHub Gist。它们除了「都由本机写」之外没有任何共同依赖,同时挂掉的概率很低。降级判断有三层:主通道请求失败 → 走备用;主通道返回「离线」但备用有更新鲜的快照 → 以备用为准(避免 Cloudflare 那一段的问题被误报成「电脑关机」);两条都失败才显示离线,且**不清空**上次内容。

## 🧰 技术栈

原生 HTML / CSS / JavaScript,**无框架、无构建工具**,克隆下来就能跑。

- **音乐**:原生 `Audio` API + [Meting](https://github.com/metowolf/Meting) 接口解析网易云歌单(主页 1、主页 2 共用同一套逻辑)
- **图标**:Font Awesome 7(CDN,主页 1 异步加载不阻塞首屏)
- **字体**:全部自托管(霞鹜文楷 / Pacifico / Ubuntu)
- **天气**:和风天气 QWeather v1 API
- **PWA**:主页 2 使用 Service Worker + Web App Manifest
- **部署**:GitHub Pages 或 Caddy + Docker

## 🙏 鸣谢

- [zyyo.cc](https://zyyo.cc) — 主页 1 页面模板
- [Meting](https://github.com/metowolf/Meting) — 音乐接口解析
- [Hitokoto 一言](https://hitokoto.cn) — 一言数据
- [和风天气 QWeather](https://www.qweather.com) — 天气与空气质量数据
- [NodeCursor](https://github.com/hmongouachon/NodeCursor) — 主页 2 光标跟随效果
- [霞鹜文楷 LXGW WenKai](https://github.com/lxgw/LxgwWenKai) — 中文字体

---

Muyu © 2026 · 豫ICP备2026015852号-1 · 本仓库仅作个人使用与学习交流
