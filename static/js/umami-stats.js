/**
 * 页脚 Umami 访问统计
 * ------------------------------------------------------------------
 * 数据来源：Umami 公开分享面板
 *   1) GET  {host}/api/share/{shareSlug}   → 拿到带权限的 JWT
 *   2) GET  {host}/api/websites/{id}/stats → 带 x-umami-share-token 请求头取汇总
 *
 * 令牌缓存在 sessionStorage（30 分钟），避免每次刷新都多打一次接口；
 * 接口失败时静默隐藏数字，不打扰页面其他内容。
 */
(function () {
    'use strict';

    var el = document.getElementById('footer-stats');
    if (!el) return;

    var host = el.getAttribute('data-umami-host') || 'https://umami.muyudada.dpdns.org';
    var shareSlug = el.getAttribute('data-umami-share');
    var websiteId = el.getAttribute('data-umami-website');
    if (!shareSlug || !websiteId) return;

    var viewsEl = document.getElementById('stats-views');
    var visitorsEl = document.getElementById('stats-visitors');
    var CACHE_KEY = 'umamiShareToken:' + shareSlug;
    var CACHE_TTL = 30 * 60 * 1000;

    host = host.replace(/\/+$/, '');

    function readTokenCache() {
        try {
            var raw = window.sessionStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || !data.token || Date.now() - data.ts > CACHE_TTL) return null;
            return data.token;
        } catch (error) {
            return null;
        }
    }

    function writeTokenCache(token) {
        try {
            window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ token: token, ts: Date.now() }));
        } catch (error) { /* 隐私模式下静默失败 */ }
    }

    function getToken() {
        var cached = readTokenCache();
        if (cached) return Promise.resolve(cached);
        return fetch(host + '/api/share/' + shareSlug, { credentials: 'omit' })
            .then(function (res) {
                if (!res.ok) throw new Error('share ' + res.status);
                return res.json();
            })
            .then(function (data) {
                if (!data || !data.token) throw new Error('share token missing');
                writeTokenCache(data.token);
                return data.token;
            });
    }

    function statsUrl(startAt, endAt) {
        return host + '/api/websites/' + websiteId + '/stats?startAt=' + startAt + '&endAt=' + endAt;
    }

    function fetchStats(token, startAt, endAt) {
        return fetch(statsUrl(startAt, endAt), {
            credentials: 'omit',
            headers: {
                'x-umami-share-token': token,
                'x-umami-share-context': '1'
            }
        })
            .then(function (res) {
                if (!res.ok) throw new Error('stats ' + res.status);
                return res.json();
            });
    }

    function formatNumber(value) {
        var num = Number(value) || 0;
        if (num >= 100000000) return (num / 100000000).toFixed(1).replace(/\.0$/, '') + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1).replace(/\.0$/, '') + '万';
        return num.toLocaleString('zh-CN');
    }

    function setNumber(node, value) {
        if (!node) return;
        node.textContent = formatNumber(value);
        node.setAttribute('data-value', String(Number(value) || 0));
    }

    function render(allStats) {
        setNumber(viewsEl, allStats.pageviews);
        setNumber(visitorsEl, allStats.visitors);
        el.classList.add('is-ready');
    }

    function fail() {
        el.classList.add('is-error');
    }

    function startOfToday() {
        var now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    }

    getToken()
        .then(function (token) {
            var now = Date.now();
            // 总浏览 / 访客：startAt 给一个足够早的时间点即等于建站以来全量
            return fetchStats(token, 1, now);
        })
        .then(render)
        .catch(fail);

    // 记录"今天"的浏览量，鼠标悬停在页脚统计上时展示（不占用默认排版）
    getToken()
        .then(function (token) {
            return fetchStats(token, startOfToday(), Date.now());
        })
        .then(function (today) {
            var todayViews = Number(today && today.pageviews) || 0;
            el.setAttribute('title', '今日浏览 ' + formatNumber(todayViews) + ' · 点击查看完整统计');
        })
        .catch(function () { /* 今日数据拿不到就沿用默认提示 */ });
})();
