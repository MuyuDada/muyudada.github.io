/* Service Worker —— Muyu 简洁主页
 * 原模板预缓存了上游作者的 CDN 资源，这里改为仅缓存本站自有资源。
 *
 * 策略：
 *   - 静态资源（HTML / CSS / JS / 图片）走「缓存优先」，省流量、离线可用。
 *   - data/ 下的快照走「网络优先」，否则文章列表更新了用户也看不到。
 *
 * 改了预缓存清单或想强制刷新时，把下面的版本号 +1 即可 ——
 * 文件内容一变，浏览器就会装新 SW，activate 里会删掉旧缓存。
 */
var cacheName = 'Muyu-简洁主页-v1.0.9';

var urlsToCache = [
    './index.html',
    './css/main.css',
    './css/fonts.css',
    './css/terminal.css',
    './css/loading.css',
    './css/Text.css',
    './css/Right.css',
    './css/tab.css',
    './css/dashboard.css',
    './css/layout.css',
    './css/music.css',
    './js/dashboard.js',
    './js/layout.js',
    './js/music.js',
    './data/posts.json',
    'static/img/favicon.gif',
    'static/img/muyu.png',
    'static/img/avatar.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(cacheName).then(function (cache) {
            // 单个资源 404 不应导致整个安装失败
            return Promise.all(
                urlsToCache.map(function (url) {
                    return cache.add(url).catch(function (err) {
                        console.warn('[SW] 跳过缓存失败资源:', url, err);
                    });
                })
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (key) {
                    return key !== cacheName;
                }).map(function (key) {
                    return caches.delete(key);
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    var url = new URL(request.url);
    // 只接管同源请求，第三方接口 / CDN 直接放行
    if (url.origin !== self.location.origin) return;

    // data/ 下的快照是会变的内容（文章列表由定时任务更新）。
    // 对这些请求必须「网络优先」，否则缓存优先会让用户一直看到旧文章，
    // 快照更新了也白搭。网络失败时才退回缓存。
    var isMutableData = /\/data\//.test(url.pathname);

    if (isMutableData) {
        event.respondWith(
            fetch(request).then(function (response) {
                if (response && response.status === 200 && response.type === 'basic') {
                    var copy = response.clone();
                    caches.open(cacheName).then(function (cache) {
                        cache.put(request, copy);
                    });
                }
                return response;
            }).catch(function () {
                return caches.match(request);
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(function (cached) {
            var network = fetch(request).then(function (response) {
                if (response && response.status === 200 && response.type === 'basic') {
                    var copy = response.clone();
                    caches.open(cacheName).then(function (cache) {
                        cache.put(request, copy);
                    });
                }
                return response;
            }).catch(function () {
                return cached;
            });
            return cached || network;
        })
    );
});
