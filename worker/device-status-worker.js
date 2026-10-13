/**
 * Muyu 主页 · 电脑状态中转 Worker
 * ---------------------------------------------------------------------------
 * 纯静态主页（GitHub Pages / Caddy）看不到本机状态，所以由本机定时 POST 上报，
 * 页面再 GET 读取。
 *
 * 存储用的是 D1 而不是 KV：
 *   KV 免费额度每天只有 1000 次写入，而 30 秒一次心跳就是 2880 次，必然爆。
 *   实测 2026-10-13 当天写了 1117 次，Worker 随即开始返回
 *   "your account has reached the free usage limit for this operation for today"
 *   （HTTP 500），上报全线失败。
 *   D1 免费额度是每天 10 万行写入、500 万行读取，同样的用法只占几个百分点。
 *
 * 路由：
 *   POST /api/device/report   本机上报（需要 X-Report-Token）
 *   GET  /api/device/status   页面读取（公开，只读）
 *   GET  /api/device/health   探活
 *
 * 绑定：
 *   D1  DEVICE_DB     主存储（表 device_status，单行 id=1）
 *   KV  DEVICE_KV     可选。只作为读兜底（老数据仍在 KV 里），不再写入。
 *
 * 环境变量（Secret）：
 *   REPORT_TOKEN   上报口令，必须与本机脚本一致
 *
 * 部署见同目录 README.md。
 */

const D1_TABLE = "device_status";
const KV_KEY = "device:latest";

// 离线判定阈值（秒）。
//
// 阈值必须大于上报脚本对应状态的「心跳间隔」，否则会在两次心跳之间被误判成离线。
// 为了不用两头手动对齐，上报脚本会把当前心跳间隔（heartbeatSeconds）一起报上来，
// 这里按「心跳 × 容错倍数」自动算阈值：
//   online  心跳 300s → 阈值 600s
//   away    心跳 600s → 阈值 1200s
// 容错倍数取 2，让网络抖动、一次上报失败都不会立刻翻成离线。
//
// 下面的 STALE_AFTER_SECONDS 只是**兜底**：老版本脚本没报 heartbeatSeconds 时用它。
const STALE_AFTER_SECONDS = { online: 600, away: 900, locked: 900 };
const DEFAULT_STALE_AFTER_SECONDS = 600;
const STALE_TOLERANCE_FACTOR = 2;   // 阈值 = 心跳 × 该倍数
const MIN_STALE_MARGIN = 60;        // 阈值至少比心跳多这么多秒
const MIN_STALE_SECONDS = 120;      // 阈值下限，防止心跳过小导致误判
// 阈值上限。必须**大于**上报字段允许的最大心跳（86400s，见 report 里的 clamp），
// 否则极端心跳下阈值会被压到等于心跳，正常的心跳间隙又会被误判成离线。
const MAX_STALE_SECONDS = 86400 * 2 + 60;

/**
 * 由上报的心跳间隔推算离线阈值（秒）。
 *
 * 硬性不变量：返回值恒 > heartbeatSeconds，否则设备会在两次正常心跳之间
 * 被误判成离线。为此取 max(心跳×倍数, 心跳+余量) 而不是单纯乘倍数。
 */
function staleThresholdFor(record) {
    const state = record && record.state;
    const fallback = STALE_AFTER_SECONDS[state] || DEFAULT_STALE_AFTER_SECONDS;

    const heartbeat = Number(record && record.heartbeatSeconds);
    if (!Number.isFinite(heartbeat) || heartbeat <= 0) {
        return fallback;
    }

    const computed = Math.max(
        heartbeat * STALE_TOLERANCE_FACTOR,
        heartbeat + MIN_STALE_MARGIN,
    );
    return Math.max(MIN_STALE_SECONDS, Math.min(MAX_STALE_SECONDS, computed));
}

// 页面侧只读，所以放开通配符；写接口靠 token 保护。
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Report-Token",
    "Access-Control-Max-Age": "86400",
};

function json(data, status) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...CORS_HEADERS,
        },
    });
}

/** 恒定时间比较，避免 token 被按字符逐位爆破 */
function safeEqual(a, b) {
    const x = String(a || "");
    const y = String(b || "");
    if (x.length !== y.length) return false;
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
    return diff === 0;
}

function clampString(value, max) {
    const s = String(value == null ? "" : value);
    return s.length > max ? s.slice(0, max) : s;
}

/**
 * 建表。只在首次（或表被删）时真正执行一次，之后靠模块级标志短路。
 *
 * 之所以不把建表放在部署步骤里强制要求，是因为忘了执行 `wrangler d1 execute`
 * 会让整个上报静默失败 —— 这里自愈更省心。
 */
let schemaReady = false;
async function ensureSchema(db) {
    if (schemaReady) return;
    await db.prepare(
        `CREATE TABLE IF NOT EXISTS ${D1_TABLE} (
            id INTEGER PRIMARY KEY,
            state TEXT,
            app TEXT,
            process TEXT,
            quip TEXT,
            title TEXT,
            idle_seconds INTEGER,
            host TEXT,
            heartbeat_seconds INTEGER,
            reported_at INTEGER
        )`,
    ).run();
    schemaReady = true;
}

function rowToRecord(row) {
    if (!row) return null;
    return {
        state: row.state || "unknown",
        app: row.app || "",
        process: row.process || "",
        quip: row.quip || "",
        title: row.title || "",
        idleSeconds: Number(row.idle_seconds) || 0,
        host: row.host || "",
        heartbeatSeconds: Number(row.heartbeat_seconds) || 0,
        reportedAt: Number(row.reported_at) || 0,
    };
}

/** 读兜底：D1 读失败时回落到 KV 里的老数据，避免状态凭空消失。 */
async function readFromKv(env) {
    if (!env.DEVICE_KV) return null;
    try {
        const raw = await env.DEVICE_KV.get(KV_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname.replace(/\/+$/, "") || "/";

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        // ---------------------------------------------------------------- 上报
        if (path === "/api/device/report" && request.method === "POST") {
            const token = request.headers.get("X-Report-Token") || "";
            if (!env.REPORT_TOKEN || !safeEqual(token, env.REPORT_TOKEN)) {
                return json({ success: false, code: "unauthorized" }, 401);
            }

            let body;
            try {
                body = await request.json();
            } catch (error) {
                return json({ success: false, code: "invalid_json" }, 400);
            }

            // 只保留需要的字段，避免表被塞垃圾
            const record = {
                state: clampString(body.state || "unknown", 24),
                app: clampString(body.app, 64),
                // 原始进程名，页面据此挑图标；没有映射时留空
                process: clampString(body.process, 64),
                // 吐槽文案，由本机脚本生成，页面直接展示
                quip: clampString(body.quip, 160),
                title: clampString(body.title, 160),
                idleSeconds: Math.max(0, Math.min(86400, Number(body.idleSeconds) || 0)),
                host: clampString(body.host, 64),
                // 上报脚本当前的心跳间隔（秒）。读取时据此推算离线阈值，
                // 这样改心跳只需要改本机脚本，Worker 自动跟随，不会两端失配。
                heartbeatSeconds: Math.max(0, Math.min(86400, Number(body.heartbeatSeconds) || 0)),
                // 时间戳以服务端为准，本机时钟不准也不影响判活
                reportedAt: Date.now(),
            };

            try {
                await ensureSchema(env.DEVICE_DB);
                await env.DEVICE_DB.prepare(
                    `INSERT INTO ${D1_TABLE}
                        (id, state, app, process, quip, title, idle_seconds, host, heartbeat_seconds, reported_at)
                     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(id) DO UPDATE SET
                        state = excluded.state,
                        app = excluded.app,
                        process = excluded.process,
                        quip = excluded.quip,
                        title = excluded.title,
                        idle_seconds = excluded.idle_seconds,
                        host = excluded.host,
                        heartbeat_seconds = excluded.heartbeat_seconds,
                        reported_at = excluded.reported_at`,
                ).bind(
                    record.state,
                    record.app,
                    record.process,
                    record.quip,
                    record.title,
                    record.idleSeconds,
                    record.host,
                    record.heartbeatSeconds,
                    record.reportedAt,
                ).run();
            } catch (error) {
                // 把真实原因回给上报脚本，否则本机只看到一句「500」无从排查
                return json({
                    success: false,
                    code: "storage_error",
                    message: String((error && error.message) || error),
                }, 500);
            }

            return json({ success: true, record: record });
        }

        // ---------------------------------------------------------------- 读取
        if (path === "/api/device/status") {
            let record = null;
            let source = "d1";

            try {
                await ensureSchema(env.DEVICE_DB);
                const row = await env.DEVICE_DB.prepare(
                    `SELECT * FROM ${D1_TABLE} WHERE id = 1`,
                ).first();
                record = rowToRecord(row);
            } catch (error) {
                // D1 故障时退回 KV 里的老数据，总比整卡显示「读不到」强
                source = "kv";
                record = await readFromKv(env);
            }

            if (!record) {
                if (source === "d1") {
                    // D1 通了但没数据，可能 KV 里还有历史记录
                    record = await readFromKv(env);
                }
                if (!record) {
                    return json({
                        success: true,
                        online: false,
                        stale: true,
                        reason: "no_report_yet",
                        record: null,
                    });
                }
            }

            // 离线判定：阈值由上报脚本报上来的心跳间隔自动推算，
            // 所以改心跳只需改本机脚本，这里自动跟随，不会两端失配。
            const ageSeconds = Math.round((Date.now() - (record.reportedAt || 0)) / 1000);
            const threshold = staleThresholdFor(record);
            const stale = ageSeconds > threshold;

            return json({
                success: true,
                online: !stale,
                stale: stale,
                ageSeconds: ageSeconds,
                staleAfterSeconds: threshold,
                source: source,
                record: record,
            });
        }

        if (path === "/api/device/health") {
            return json({ success: true, service: "device-status", time: Date.now() });
        }

        return json({ success: false, code: "not_found" }, 404);
    },
};
