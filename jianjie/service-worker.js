/* Service Worker —— Muyu 简洁主页
 * 原模板预缓存了上游作者的 CDN 资源，这里改为仅缓存本站自有资源。
 */
var cacheName = 'Muyu-简洁主页-v1.0.8';

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
