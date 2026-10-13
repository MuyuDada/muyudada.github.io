/**
 * Muyu 主页 · 电脑状态中转 Worker
 * ---------------------------------------------------------------------------
 * 纯静态主页（GitHub Pages / Caddy）看不到本机状态，所以由本机定时 POST 上报，
 * 页面再 GET 读取。数据存在 Cloudflare KV 里。
 *
 * 路由：
 *   POST /api/device/report   本机上报（需要 X-Report-Token）
 *   GET  /api/device/status   页面读取（公开，只读）
 *   GET  /api/device/health   探活
 *
 * 绑定的 KV 命名空间变量名：DEVICE_KV
 * 环境变量（Secret）：
 *   REPORT_TOKEN   上报口令，必须与本机脚本一致
 *
 * 部署见同目录 README.md。
 */

const KV_KEY = "device:latest";

// 离线判定阈值（秒）。必须大于上报脚本对应状态的「心跳间隔」，否则会在两次
// 心跳之间被误判成离线。上报脚本的心跳：online 时 240s，away/locked 时 600s
// （人不在跟前，画面本来就不会变，没必要频繁写）。
const STALE_AFTER_SECONDS = { online: 300, away: 720, locked: 720 };
const DEFAULT_STALE_AFTER_SECONDS = 300;

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

            // 只保留需要的字段，避免 KV 被塞垃圾
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
                reportedAt: Date.now(),
            };

            await env.DEVICE_KV.put(KV_KEY, JSON.stringify(record));
            return json({ success: true, record: record });
        }

        // ---------------------------------------------------------------- 读取
        if (path === "/api/device/status") {
            const raw = await env.DEVICE_KV.get(KV_KEY);
            if (!raw) {
                return json({
                    success: true,
                    online: false,
                    stale: true,
                    reason: "no_report_yet",
                    record: null,
                });
            }

            let record;
            try {
                record = JSON.parse(raw);
            } catch (error) {
                return json({ success: false, code: "corrupt_record" }, 500);
            }

            // 离线判定：阈值随上报状态变化。上报脚本在「人不在跟前」时会拉长心跳，
            // 用一个固定阈值会把正常的心跳间隙误判成离线。
            const ageSeconds = Math.round((Date.now() - (record.reportedAt || 0)) / 1000);
            const threshold = STALE_AFTER_SECONDS[record.state] || DEFAULT_STALE_AFTER_SECONDS;
            const stale = ageSeconds > threshold;

            return json({
                success: true,
                online: !stale,
                stale: stale,
                ageSeconds: ageSeconds,
                staleAfterSeconds: threshold,
                record: record,
            });
        }

        if (path === "/api/device/health") {
            return json({ success: true, service: "device-status", time: Date.now() });
        }

        return json({ success: false, code: "not_found" }, 404);
    },
};
