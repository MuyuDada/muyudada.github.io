# 电脑状态通道 · Cloudflare Worker

主页是纯静态的，浏览器看不到你电脑上开着什么程序。所以链路是：

```
本机 PowerShell 脚本（变化驱动 + 心跳）
        │  POST /api/device/report   （带 X-Report-Token）
        ▼
Cloudflare Worker  ──写入──▶  Cloudflare KV
        ▲
        │  GET /api/device/status    （公开只读，带 CORS）
        │
主页 static/js/script.js（每 60 秒轮询）
```

KV 里只存一条记录（key = `device:latest`），永远覆盖，不累积历史。

---

## 一、部署 Worker

需要 Node.js（已装）和一个 Cloudflare 账号。

```bash
# 1. 安装 wrangler
npm install -g wrangler

# 2. 登录（会打开浏览器授权）
wrangler login

# 3. 建 KV 命名空间，记下输出里的 id
cd worker
wrangler kv namespace create DEVICE_KV
```

把返回的 id 填进 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "DEVICE_KV"
id = "刚刚返回的 id"
```

设置上报口令（自己随便编一串，别用弱口令）：

```bash
wrangler secret put REPORT_TOKEN
# 提示时输入，例如：k7Xm2pQ9vLz4Rt8Wn3Bc6Yd1
```

部署：

```bash
wrangler deploy
```

输出里会有一行 `https://muyu-device-status.<你的子域>.workers.dev`。

> ⚠️ **不要用这个 `*.workers.dev` 地址**。该域名在部分网络（尤其国内）会被
> DNS 污染，解析到不可达的 IP，表现为「不开代理就取不到状态 / 上报失败」。
> 本项目的 `wrangler.toml` 已经把 Worker 挂到自己接入 Cloudflare 的域名上：
>
> ```toml
> routes = [
>   { pattern = "muyuhome.cc.cd/api/device/*", zone_name = "muyuhome.cc.cd" }
> ]
> ```
>
> 这条路由只接管 `/api/device/*`，该域名的其他路径（整站页面）不受影响。
> 换成你自己的域名时，改这里的 `pattern` 与 `zone_name` 两处即可，
> 然后重新 `wrangler deploy`。

验证：

```bash
curl https://muyuhome.cc.cd/api/device/health
# → {"success":true,"service":"device-status","time":...}
```

---

## 二、配置本机上报

打开 `tools/report-device.ps1`，改开头的 `$Endpoint`：

```powershell
$Endpoint = "https://muyuhome.cc.cd/api/device/report"
```

口令**不要写进脚本**（本仓库是公开的）。改成写进 `tools/report-token.local`：

```powershell
# 内容就是一行口令，与 Worker 的 REPORT_TOKEN 一致
k7Xm2pQ9vLz4Rt8Wn3Bc6Yd1
```

该文件已在 `.gitignore` 中，不会被提交。也可以改用环境变量 `MUYU_REPORT_TOKEN`。

先手动跑一次验证：

```powershell
powershell -ExecutionPolicy Bypass -File tools\report-device.ps1 -Once
```

成功会输出 `已上报: online / Code`。然后去浏览器打开
`.../api/device/status` 看有没有数据。

确认无误后装成开机自启：

```powershell
powershell -ExecutionPolicy Bypass -File tools\install-device-task.ps1
```

它会注册一个登录时启动的计划任务，后台常驻、无窗口闪烁。上报节奏见下方「省额度设计」。

卸载：

```powershell
powershell -ExecutionPolicy Bypass -File tools\uninstall-device-task.ps1
```

---

## 三、配置主页

打开 `static/js/script.js`，找到 `deviceStatusConfig`，把 `endpoint` 换成你的 Worker 地址：

```js
var deviceStatusConfig = {
    endpoint: "https://muyuhome.cc.cd/api/device/status",
    ...
};
```

---

## 接口

### `POST /api/device/report`

请求头 `X-Report-Token: <REPORT_TOKEN>`，请求体：

```json
{
  "state": "online",
  "app": "VSCode 编辑器",
  "process": "code",
  "quip": "正在写代码！也可能在看 AI 写代码。",
  "title": "script.js - Visual Studio Code",
  "idleSeconds": 3,
  "host": "MUYU-PC"
}
```

`state` 取值：`online` / `locked` / `away` / `unknown`。

- `app` —— 展示用的中文应用名（由本机脚本的 `$AppMap` 映射）
- `process` —— 原始进程名，页面据此挑 Font Awesome 图标
- `quip` —— 吐槽文案，页面直接展示；为空时前端按状态给兜底文案

### `GET /api/device/status`

```json
{
  "success": true,
  "online": true,
  "stale": false,
  "ageSeconds": 12,
  "record": {
    "state": "online",
    "app": "VSCode 编辑器",
    "process": "code",
    "quip": "正在写代码！也可能在看 AI 写代码。",
    "title": "script.js - Visual Studio Code",
    "idleSeconds": 3,
    "host": "MUYU-PC",
    "reportedAt": 1791819124000
  }
}
```

超过阈值没有上报，`stale` 变为 `true`、`online` 变为 `false`，页面会显示「离线」。
阈值随上报状态动态调整（在线 300 秒、离开/锁屏 720 秒），并随响应里的
`staleAfterSeconds` 字段回传，便于前端与调试时确认。

---

## 安全说明

- 写接口靠 `REPORT_TOKEN` 保护，token 存在 Worker Secret 里，不进仓库。
- **读接口是公开的**——任何知道地址的人都能看到你当前开着什么程序。这跟 tonks.top 的做法一致（`/api/query` 也是公开的）。如果不想公开，把 `GET /api/device/status` 也加上 token 校验，但那样主页就得把 token 写进前端 JS，等于没保护；真要私密只能加一层登录。
- KV 免费额度：每天 10 万次**读**、1000 次**写**。写是瓶颈，读不是。
  固定 30 秒上报 = 2880 次写/天，会直接爆额度。所以上报脚本用的是
  **变化驱动 + 心跳**（见下），实测挂机约 288 写/天、正常使用约 400~600 写/天。

---

## 省额度设计

`tools/report-device.ps1` 不按固定间隔上报：

1. 本机每 **15 秒**轮询一次前台窗口（纯本地 Win32 调用，不产生任何网络请求）；
2. 只有「身份」变化（`state` / `app` / `process` 任一改变）才**立刻**上报；
3. 身份没变时只发心跳保活：**在线 5 分钟**一次，**离开/锁屏 10 分钟**一次。

窗口**标题**单独变化默认不触发上报 —— 浏览器翻页时标题一直在变，会疯狂消耗额度；
标题会在下一次心跳时顺带刷新。确实需要跟着标题走，加 `-TitleTriggersUpdate`，
代价是额度消耗显著上升。

可调参数（都有默认值，一般不用动）：

```powershell
-PollSeconds 15            # 本机轮询间隔，纯本地调用
-HeartbeatSeconds 300      # 在线时的心跳间隔
-IdleHeartbeatSeconds 600  # 离开/锁屏时的心跳间隔
-TitleTriggersUpdate       # 标题变化也上报（费额度）
-IntervalSeconds 0         # 显式指定则退化成旧的固定间隔模式
```

⚠️ **心跳间隔与 Worker 的离线阈值必须匹配。** Worker 的阈值随状态动态调整
（在线 300s、空闲 720s）。如果把 `-HeartbeatSeconds` 调得比 300 还大，
正常的心跳间隙就会被误判成离线。改心跳时记得同步改
`worker/device-status-worker.js` 里的 `STALE_AFTER_SECONDS`。

