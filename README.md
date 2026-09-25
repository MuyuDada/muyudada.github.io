<div align="center">

<img src="static/img/favicon.gif" width="120" alt="logo" />

# Muyu の 主页

永远相信美好的事情即将发生 ————

个人主页源码,基于 [zyyo.cc](https://zyyo.cc) 模板魔改,纯静态页面,无需构建。

在线访问:[https://muyudada.github.io](https://muyudada.github.io)

</div>

## ✨ 功能特性

- **一言 Hitokoto**:打字机效果逐字显示,每 20 秒自动刷新
- **当地时间**:实时时钟 + 中文日期(含星期),每秒更新
- **天气预报**:基于 [Open-Meteo](https://open-meteo.com),免 API Key;**自动定位访问者所在地**(浏览器 GPS → IP 定位 → 兜底城市,逐级回退);可展开今日详情(风力、能见度、体感温度、湿度、气压、空气质量、云量、紫外线、降水量、日出日落、污染物浓度);自建反代后可进一步接入**中国天气网气象站实测值**(见[气象站实测数据](#气象站实测数据可选))
- **音乐播放器**:[APlayer](https://aplayer.js.org) + Meting API 加载网易云歌单,支持歌词与歌单面板
- **主题设置**:明暗主题切换(Cookie 持久化),背景/卡片的透明度、模糊度与卡片颜色可调(localStorage 持久化)
- **GitHub 贡献贪吃蛇**:明暗两套 SVG 随主题切换
- **站点运行时长**:建站起每秒累计的天/时/分/秒
- **FPS 实时显示**:页面帧率监测
- **其他**:加载动画、图片弹窗(QQ / 赞赏码)、访客统计、时间线、个人标签、站点与项目展示、移动端响应式适配

## 📁 目录结构

```text
├── index.html            # 主页面
├── static/
│   ├── css/              # 样式表(style.css / root.css)
│   ├── js/script.js      # 站点全部逻辑
│   ├── img/              # 图片资源
│   ├── svg/              # 贪吃蛇 SVG 等素材
│   └── fonts/            # 自托管字体(霞鹜文楷 / Pacifico / Ubuntu)
├── Caddyfile             # Caddy 服务器配置
├── Dockerfile            # 基于 caddy:alpine 的镜像
└── docker-compose.yaml   # Docker Compose 编排
```

## 🚀 本地预览

纯静态页面,任选其一:

```bash
# 方式一:直接用浏览器打开 index.html

# 方式二:起一个本地静态服务
python -m http.server 8080
# 访问 http://localhost:8080
```

> 一言、天气、音乐等接口需联网才能正常加载。

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

主要改动集中在 [index.html](index.html) 和 [static/js/script.js](static/js/script.js):

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| `musicPlaylistConfig.id` | `static/js/script.js` | 网易云歌单 ID(取歌单链接中的 id) |
| `weatherConfig` | `static/js/script.js` | 天气定位方式、兜底城市与刷新间隔(见下) |
| `siteStartTime` | `static/js/script.js` | 建站起始时间(运行时长统计) |
| 社交链接 / 时间线 / 标签 / 项目卡片 | `index.html` | 按需替换为自己的内容 |
| 页面标题 / 描述 / 关键词 / ICP 备案号 | `index.html` | `<head>` 与 `<footer>` 中修改 |

### 天气定位说明

天气默认**显示访问者所在地**，定位链为:

```
浏览器 GPS(带跑偏校验) → IP 定位(多源轮询) → 兜底城市
```

```js
var weatherConfig = {
    locationMode: "auto",        // "auto" 定位访客所在地(默认) | "fixed" 永远用兜底城市
    fallbackCity: "city",         // 定位全部失败时的兜底城市
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
    stationApiEnabled: true,     // 是否尝试用中国天气网气象站实测数据(需自建反代，见下)
    stationProxyPath: "/api/weather/"
};
```

想固定显示某个城市，把 `locationMode` 改成 `"fixed"` 即可(不依赖任何第三方定位接口)。

**设计要点**(改动前请先读，都是踩过的坑):

1. **取数只用坐标，不用地名反查。** 地名仅用于显示。Open-Meteo 的中文地名库不可靠 —— 实测「保定」会命中云南的一个村,「涞源县」则完全查不到。
2. **IP 定位必须多源轮询。** 国内宽带 IP 归属地会跨市漂移,实测同一个 IP 被不同 IP 库分别解析成涞源 / 保定 / 石家庄 / 承德(跨度 300 km)。任一源异常/超时都自动切下一个源。
3. **电脑端浏览器 GPS 其实是 WiFi 定位库**,经常偏到隔壁市,所以用 `maxAutoDistanceKm` 做距离校验,跑偏就忽略并改走 IP 定位。
4. **所有定位请求都必须带超时**,且整条链要有总时限 —— 否则接口挂住不返回时,页面会一直停在「正在定位...」。
5. 定位类接口偶发失败是常态,所以任何一级都不能是单点,最后一定要能回退到兜底城市。

### 气象站实测数据(可选)

Open-Meteo 在中国的 `current` 是**模式插值,不是实测** —— 中国区 `best_match` 走 ECMWF IFS 0.25°(约 25 km),
且未同化国内站点观测,所以会出现「气象台在下雨、页面显示晴」这类偏差。

要拿到**真实气象站实测值**(温度、天气现象、风向风力、能见度、湿度、站点气压、AQI),
可以自建一层反向代理接[中国天气网](https://www.weather.com.cn)的站点接口:

```
https://d1.weather.com.cn/sk_2d/{站点编号}.html   →   var dataSK={...}
```

**为什么必须自建反代**:该接口按 `Referer` 校验来源,且只认 `www.weather.com.cn`。
而 `Referer` 属于浏览器**禁止 JS 修改**的头部,纯静态托管(GitHub Pages)**无法**直接调用 —— 
只有走自建服务器加反代才能补上这个头。`Caddyfile` 里已给出现成配置:

```caddyfile
handle_path /api/weather/* {
    rewrite * /sk_2d{http.request.uri.path}.html
    reverse_proxy https://d1.weather.com.cn {
        header_up Referer "https://www.weather.com.cn/weather/index.shtml"
        header_up Host "d1.weather.com.cn"
        header_down Access-Control-Allow-Origin "*"
    }
}
```

配置好后页面会自动探测(`probeStationApi`)、按访问者坐标匹配最近的县级站点
(`stationProvinces` 省份边界框 + `stationCoords` 1325 个站点坐标取球面最近)、
取其实测值覆盖 Open-Meteo 的对应字段,并在详情里标注
「🛰️ 实况来自「XX」气象站实测 · HH:MM 观测」。

未自建反代 / 接口异常时会**静默降级**,继续显示 Open-Meteo 数据,不会报错也不会留空。

## 🧰 技术栈

原生 HTML / CSS / JavaScript,无框架、无构建工具;音乐播放使用 APlayer(CDN 引入),字体全部自托管。

## 🙏 鸣谢

- [zyyo.cc](https://zyyo.cc) — 页面模板
- [APlayer](https://github.com/DIYgod/APlayer) & [Meting](https://github.com/metowolf/Meting) — 音乐播放与解析
- [Hitokoto 一言](https://hitokoto.cn) — 一言数据
- [Open-Meteo](https://open-meteo.com) — 天气与空气质量数据
- [中国天气网](https://www.weather.com.cn) — 气象站实测数据(可选,需自建反代)

---

Muyu © 2026 · 豫ICP备2026015852号-1 · 本仓库仅作个人使用与学习交流
