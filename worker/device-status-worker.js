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

            // 超过 3 分钟没上报就认为本机掉线（上报间隔 30s，留足容错）
            const ageSeconds = Math.round((Date.now() - (record.reportedAt || 0)) / 1000);
            const stale = ageSeconds > 180;

            return json({
                success: true,
                online: !stale,
                stale: stale,
                ageSeconds: ageSeconds,
                record: record,
            });
        }

        if (path === "/api/device/health") {
            return json({ success: true, service: "device-status", time: Date.now() });
        }

        return json({ success: false, code: "not_found" }, 404);
    },
};
