# 电脑状态通道 · Cloudflare Worker

主页是纯静态的，浏览器看不到你电脑上开着什么程序。所以链路是：

```
本机 PowerShell 脚本（变化驱动 + 心跳）
        │  POST /api/device/report   （带 X-Report-Token）
        ▼
Cloudflare Worker  ──写入──▶  Cloudflare D1
        ▲
        │  GET /api/device/status    （公开只读，带 CORS）
        │
主页 static/js/script.js（每 60 秒轮询）
```

D1 里只存一条记录（表 `device_status`，固定 `id = 1`），每次覆盖，不累积历史。

> **为什么用 D1 而不是 KV**
>
> KV 免费额度每天只有 1000 次**写**，而 30 秒一次心跳就是 2880 次，必然撞上限。
> 实测 2026-10-13 当天写了 1117 次后，Worker 开始返回
> `your account has reached the free usage limit for this operation for today`
> （HTTP 500），上报全线失败。
>
> D1 免费额度是每天 10 万行写入、500 万行读取，同样的用法只占百分之几。
> KV 绑定保留着，但只作为**读兜底**（历史数据还在里面），不再写入。

---

## 一、部署 Worker

需要 Node.js（已装）和一个 Cloudflare 账号。

```bash
# 1. 安装 wrangler
npm install -g wrangler

# 2. 登录（会打开浏览器授权）
wrangler login

# 3. 建 D1 数据库，记下输出里的 database_id
cd worker
wrangler d1 create muyu-device-status
```

把返回的 id 填进 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DEVICE_DB"
database_name = "muyu-device-status"
database_id = "刚刚返回的 database_id"
```

表结构**不用手动建**：Worker 首次写入时会 `CREATE TABLE IF NOT EXISTS` 自愈，
忘了执行 `wrangler d1 execute` 也不会让上报静默失败。

设置上报口令（自己随便编一串，别用弱口令）：

```bash
wrangler secret put REPORT_TOKEN
# 提示时输入，例如：k7Xm2pQ9vLz4Rt8Wn3Bc6Yd1
```

部署：

```bash
# 必须在这个 worker/ 目录里执行！
wrangler deploy
```

> ⚠️ **一定要在 `worker/` 目录里跑 `wrangler deploy`，不要在仓库根目录跑。**
>
> 根目录没有 wrangler 配置，wrangler 会**自动生成**一个
> （`assets.directory = "."`）并部署一个「纯静态资源」Worker，把**整个工作目录**
> 当成网站传上去。`.gitignore` 只对 git 生效，**对 wrangler 完全无效**，所以
> `tools/report-token.local`、`tools/gist-id.local`、`.git/config`、`.wrangler/`
> 这些被 git 忽略的本地文件会一起挂到公网 URL 上。
>
> 2026-10-14 就这么翻过一次车（暴露约 2.5 分钟，事后删 Worker + 轮换口令）。
> 仓库根目录现在放了一个 `.assetsignore` 兜底，但**根本的防线是别在根目录部署**。
> 自检：部署后 `curl <worker地址>/tools/report-token.local` 应当返回 404。

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

它会注册**两条独立的自启路径**：一个登录时启动的计划任务（后台常驻、无窗口闪烁），
以及启动文件夹里的一个快捷方式。脚本内有单实例保护，两条同时生效也不会重复上报。
上报节奏见下方「省额度设计」，排错见下方「自启与排错」。

卸载（会同时清掉两条自启路径和正在运行的实例）：

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
  "staleAfterSeconds": 600,
  "source": "d1",
  "record": {
    "state": "online",
    "app": "VSCode 编辑器",
    "process": "code",
    "quip": "正在写代码！也可能在看 AI 写代码。",
    "title": "script.js - Visual Studio Code",
    "idleSeconds": 3,
    "host": "MUYU-PC",
    "heartbeatSeconds": 300,
    "reportedAt": 1791819124000
  }
}
```

`source` 表示这次数据是从哪里读的：`d1`（正常）或 `kv`（D1 读失败时回落到 KV 里的
历史数据）。D1 通了但表里没数据时，也会再去 KV 找一次，避免刚迁移完出现空窗。

超过阈值没有上报，`stale` 变为 `true`、`online` 变为 `false`，页面会显示「离线」。

**离线阈值是自动算出来的，不用手动同步。** 上报脚本会把当前状态的心跳间隔
（`heartbeatSeconds`）一起报上来，Worker 按 `阈值 = 心跳 × 2`（再保证至少比心跳
多 60 秒，并夹到 `[120s, 2×86400+60s]`）推算，并通过响应里的 `staleAfterSeconds`
字段回传，便于前端与调试时确认。

这样改心跳**只需要改本机脚本**，Worker 会自动跟随，不会出现「心跳调大了但阈值没跟上，
正常心跳间隙被误判成离线」的两头失配。老版本脚本没报 `heartbeatSeconds` 时，
回落到 `STALE_AFTER_SECONDS`（在线 600s、离开/锁屏 900s）。

---

## 安全说明

- 写接口靠 `REPORT_TOKEN` 保护，token 存在 Worker Secret 里，不进仓库。
- **读接口是公开的**——任何知道地址的人都能看到你当前开着什么程序。这跟 tonks.top 的做法一致（`/api/query` 也是公开的）。如果不想公开，把 `GET /api/device/status` 也加上 token 校验，但那样主页就得把 token 写进前端 JS，等于没保护；真要私密只能加一层登录。
- **存储额度**：D1 免费额度是每天 **10 万行写**、500 万行读。上报脚本用的是
  **变化驱动 + 心跳**（见下），实测挂机约 288 写/天、正常使用约 400~600 写/天，
  只占百分之几，不会撞上限。（早先用 KV 当主存储时每天只有 1000 次写，
  30 秒固定上报必然爆额度，所以才迁到 D1。）

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
-NoSnapshot                # 关掉 GitHub Gist 备用通道
-IntervalSeconds 0         # 显式指定则退化成旧的固定间隔模式
```

⚠️ **改心跳不用改 Worker。** 上报脚本会把当前心跳间隔一起报上来
（`heartbeatSeconds` 字段），Worker 按「心跳 × 2」自动推算离线阈值，
所以调 `-HeartbeatSeconds` / `-IdleHeartbeatSeconds` 后**无需**改动
`worker/device-status-worker.js`，两端不会失配。

---

## 自启与排错

`install-device-task.ps1` 会注册**两条独立的自启路径**：

1. 计划任务 `MuyuDeviceStatusReporter`（登录时触发）；
2. 启动文件夹里的快捷方式 `MuyuDeviceStatusReporter.lnk`。

之所以要两条：计划任务曾经在毫无征兆的情况下凭空消失过一次（`Tasks` 目录下的
文件没了），上报静默中断两小时。两条路径不会重复上报 —— `report-device.ps1`
里有命名互斥体做单实例保护，后来的实例会立刻退出。

计划任务是无窗口运行的，出问题时控制台什么都没留下，所以脚本会把启动、上报失败、
快照失败写进本地日志（超过 512KB 自动轮转）：

```
%LOCALAPPDATA%\muyu-device-status\reporter.log
```

排查顺序：先看这个日志 → 再看 `GET /api/device/status` 返回的 `ageSeconds`
→ 最后才怀疑 Worker。

