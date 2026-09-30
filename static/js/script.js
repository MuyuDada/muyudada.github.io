console.log('%cCopyright © 2024 zyyo.net',
    'background-color: #ff00ff; color: white; font-size: 24px; font-weight: bold; padding: 10px;'
);
console.log('%c   /\\_/\\', 'color: #8B4513; font-size: 20px;');
console.log('%c  ( o.o )', 'color: #8B4513; font-size: 20px;');
console.log(' %c  > ^ <', 'color: #8B4513; font-size: 20px;');
console.log('  %c /  ~ \\', 'color: #8B4513; font-size: 20px;');
console.log('  %c/______\\', 'color: #8B4513; font-size: 20px;');

// 修改这里的 id 即可替换为自己的网易云歌单（歌单链接中的 id）。
var musicPlaylistConfig = {
    server: "netease",
    type: "playlist",
    id: "3778678",
    api: "https://api.qijieya.cn/meting/?server=:server&type=:type&id=:id"
};

// 天气数据来自和风天气（QWeather），需要 API Key，见下方 weatherConfig 末尾。
//
// 【定位策略】weatherConfig.locationMode
//   "auto"  —— 默认。定位访问者所在地：浏览器 GPS（带跑偏校验）→ IP 定位 → 兜底城市。
//   "fixed" —— 不做任何定位，永远显示下面写死的兜底城市。
//
// 关于定位可靠性（踩过的坑，别改回去）：
//   1) 浏览器 GPS 在电脑端其实是 WiFi 定位库，经常偏到隔壁市 → 用 maxAutoDistanceKm 校验；
//   2) 国内宽带 IP 归属地会跨市漂移，实测同一个 IP 被不同 IP 库分别解析成
//      涞源 / 保定 / 石家庄 / 承德，跨度 300 km → 所以地名只用于「显示」，
//      取数一律用 IP 库返回的经纬度，不用地名反查坐标；
//   3) 中文地名库不可靠（「保定」会命中云南的一个村，「涞源县」查不到），
//      绝不要用城市名反查坐标；和风 v1 也是直接吃经纬度，同样不需要反查；
//   4) 定位类接口偶尔会挂住不返回 → 必须有超时，否则页面永远停在「正在定位...」。
//
// fallback* 是「所有定位手段都失败」时的兜底坐标，也是 fixed 模式使用的坐标。
var weatherConfig = {
    locationMode: "auto",
    fallbackCity: "涞源",
    fallbackLatitude: 39.3602,
    fallbackLongitude: 114.6940,
    // 定位点离兜底城市超过该公里数即判定为跑偏，继续往下一级回退
    maxAutoDistanceKm: 80,
    // 单个定位/天气请求的超时（毫秒），避免页面一直卡在「正在定位...」
    requestTimeoutMs: 8000,
    // 整个定位链的总时限（毫秒）。多级回退是串行的，
    // 若每个源都挂住不返回，累加会把「正在定位...」拖到十几秒，所以必须封顶。
    locationDeadlineMs: 6000,
    // 天气自动刷新间隔（分钟）；切回前台时若已过期也会立即刷新
    refreshIntervalMinutes: 15,
    // 备用 IP 定位源：主源失败或返回坐标明显跑偏时依次尝试（都必须支持 CORS 跨域）
    // 注意：ip-api.com 的 HTTPS 需付费、ipinfo.io 免费额度有限，故未启用
    ipApis: [
        "https://v2.xxapi.cn/api/ip",
        "https://whois.pconline.com.cn/ipJson.jsp?json=true"
    ],

    // ===================== 和风天气（QWeather）=====================
    // 认证必须走请求头 X-QW-Api-Key；旧的 ?key= 查询参数已废弃。
    // API Host 是每个账号专属的，不是公共的 api.qweather.com
    // （官方公告：公共地址自 2026 年起逐步停服），换账号时这两项都要改。
    //
    // ⚠️ 这是纯静态站点，Key 随仓库公开、任何人可见并可消耗你的额度。
    //    如需保密，必须改成自建后端代理，把 Key 留在服务端。
    qweatherApiKey: "88ae3e30712d4c7ea92e8b8b209949fb",
    qweatherApiHost: "https://n27p3u5uhf.re.qweatherapi.com"
};

function timePeriodText(hour) {
    if (hour < 5) {
        return "凌晨";
    }
    if (hour < 9) {
        return "早上";
    }
    if (hour < 12) {
        return "上午";
    }
    if (hour < 14) {
        return "中午";
    }
    if (hour < 18) {
        return "下午";
    }
    if (hour < 19) {
        return "傍晚";
    }
    return "晚上";
}

function updateLocalTime() {
    var timeElement = document.getElementById("local-time-main");
    var secondsElement = document.getElementById("local-time-seconds");
    var periodElement = document.getElementById("time-period");
    var dateElement = document.getElementById("local-date");

    if (!timeElement || !dateElement) {
        return;
    }

    var pad = function (value) {
        return String(value).padStart(2, "0");
    };
    var now = new Date();

    timeElement.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
    if (secondsElement) {
        secondsElement.textContent = ":" + pad(now.getSeconds());
    }
    if (periodElement) {
        periodElement.textContent = timePeriodText(now.getHours());
    }
    dateElement.textContent = now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
    });
}

// ===================== 和风天气（QWeather）字段映射 =====================
// 和风 v1 的 condition.text 已经是本地化中文，直接展示即可；
// condition.code 只在挑图标时当兜底（官方图标代码见 dev.qweather.com/docs/resource/icons/）。
function weatherIconByText(text, code) {
    var t = String(text || "");
    if (/霾|浮尘|扬沙|沙尘/.test(t)) return "😷";
    if (/雷/.test(t)) return "⛈️";
    if (/雪|米雪/.test(t)) return "🌨️";
    if (/雨/.test(t)) return "🌧️";
    if (/雾/.test(t)) return "🌫️";
    if (/阴/.test(t)) return "☁️";
    if (/多云|少云/.test(t)) return "⛅";
    if (/晴/.test(t)) return "☀️";
    return weatherIconByCode(code);
}

// condition.code 兜底：按官方代码段归类
function weatherIconByCode(code) {
    var n = parseInt(code, 10);
    if (!Number.isFinite(n)) return "🌡️";
    if ((n >= 100 && n <= 103) || (n >= 150 && n <= 153)) return "☀️";
    if (n === 104) return "☁️";
    if (n >= 200 && n <= 213) return "🌬️";
    if (n >= 300 && n <= 399) return "🌧️";
    if (n >= 400 && n <= 499) return "🌨️";
    if (n >= 500 && n <= 515) return "🌫️";
    return "🌡️";
}

function windDirection(degrees) {
    var directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    return directions[Math.round(degrees / 45) % 8];
}

function formatWeatherTime(value) {
    return value ? value.slice(11, 16) : "--:--";
}

function formatAirValue(value, unit) {
    var num = Number(value);
    if (value == null || !Number.isFinite(num)) {
        return "暂无数据";
    }
    // CO 这类浓度很小（mg/m³），四舍五入会变成 0，所以小于 10 时保留一位小数
    var text = num >= 10 ? String(Math.round(num)) : num.toFixed(1);
    return text + " " + (unit || "μg/m³");
}

// 取当前天气现象的中文描述：和风直接给本地化文本
function currentWeatherText(current) {
    return (current && current.condition && current.condition.text) || "天气未知";
}

// 天气现象对应的图标：先按中文关键字挑，挑不到再按 condition.code 归类
function currentWeatherIcon(current) {
    var code = current && current.condition ? current.condition.code : null;
    return weatherIconByText(currentWeatherText(current), code);
}

// 记录最近一次成功解析出的取数点，供定时刷新复用
var resolvedWeatherLocation = null;
var lastWeatherFetchAt = 0;

// 和风 API Host 是账号专属的，末尾可能带斜杠，统一去掉
function qweatherUrl(path) {
    var host = String(weatherConfig.qweatherApiHost || "").replace(/\/+$/, "");
    return host + path;
}

// 和风 v1 的数值字段统一是 { value, unit } 对象，取标量
function pickValue(node) {
    if (node && typeof node === "object" && node.value !== undefined) {
        return node.value;
    }
    return node;
}

// 判断取到的值是不是可用数字。
// 不能直接用 Number.isFinite(Number(v))：Number(null) 和 Number("") 都是 0，
// 会把「字段缺失」误判成真实的 0，详情卡片就会显示 0% / 0 hPa 这种假数据。
function isNum(value) {
    return value !== null && value !== undefined && value !== "" &&
        Number.isFinite(Number(value));
}

// 污染物浓度表：code -> { value, unit }。单位随污染物而变（CO 是 mg/m³，其余多为 μg/m³）
function airQualityMap(airData) {
    var map = {};
    var list = (airData && airData.pollutants) || [];
    for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item || !item.code) {
            continue;
        }
        map[item.code] = {
            value: item.concentration ? item.concentration.value : null,
            unit: item.concentration ? item.concentration.unit : null
        };
    }
    return map;
}

// 取 AQI：优先中国标准 cn-mee，没有就退到第一个指数
function airQualityIndex(airData) {
    var list = (airData && airData.indexes) || [];
    var chosen = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].code === "cn-mee") {
            chosen = list[i];
            break;
        }
    }
    if (!chosen) {
        chosen = list[0];
    }
    return chosen || null;
}

function loadWeather(latitude, longitude, locationName) {
    var weatherElement = document.getElementById("weather-info");
    var forecastElement = document.getElementById("weather-forecast");
    var locationElement = document.getElementById("weather-location");

    if (!weatherElement) {
        return;
    }

    resolvedWeatherLocation = {
        latitude: latitude,
        longitude: longitude,
        name: locationName
    };
    lastWeatherFetchAt = Date.now();

    // 和风 v1 的路径参数：纬度在前、经度在后，最多两位小数
    var coord = Number(latitude).toFixed(2) + "/" + Number(longitude).toFixed(2);
    var timeout = weatherConfig.requestTimeoutMs;
    var authInit = { headers: { "X-QW-Api-Key": weatherConfig.qweatherApiKey } };

    var currentRequest = fetchWithTimeout(
        qweatherUrl("/weather/v1/current/" + coord + "?localTime=true"),
        timeout, undefined, authInit
    ).then(function (response) {
        return response.json();
    });

    // 每日预报只用于日出日落和降水概率，失败时降级为「暂无数据」，
    // 不该把整个天气卡片拖成不可用
    var dailyRequest = fetchWithTimeout(
        qweatherUrl("/weather/v1/daily/" + coord + "?days=1&localTime=true"),
        timeout, undefined, authInit
    ).then(function (response) {
        return response.json();
    }).catch(function (error) {
        console.warn("每日预报获取失败，日出日落与降水概率显示暂无数据", error);
        return null;
    });

    // 空气质量是锦上添花，失败不该拖垮整个天气卡片
    var airRequest = fetchWithTimeout(
        qweatherUrl("/airquality/v1/current/" + coord),
        timeout, undefined, authInit
    ).then(function (response) {
        return response.json();
    }).catch(function (error) {
        console.warn("空气质量获取失败，详情中显示暂无数据", error);
        return null;
    });

    Promise.all([currentRequest, dailyRequest, airRequest])
        .then(function (results) {
            var current = results[0];
            var daily = results[1];
            var air = results[2];

            // 气温是必填项：拿不到就当作整个请求失败，走兜底文案
            var temp = pickValue(current && current.temperature);
            if (!isNum(temp)) {
                throw new Error("和风天气未返回有效气温");
            }
            var text = currentWeatherText(current);
            var icon = currentWeatherIcon(current);

            if (locationElement && locationName) {
                locationElement.textContent = "⌖ " + locationName;
            }
            weatherElement.classList.remove("is-muted");
            weatherElement.innerHTML =
                "<div class=\"weather-main\"><span class=\"weather-icon\">" +
                icon + "</span><strong>" +
                Math.round(Number(temp)) + "°</strong><span>" +
                text + "</span></div>";

            if (!forecastElement) {
                return;
            }

            var day = daily && daily.days ? daily.days[0] : null;
            var astro = (day && day.astro) || {};
            var pollutants = airQualityMap(air);
            var index = airQualityIndex(air);

            // 实时接口没有降水概率，取今天白天/夜间两者的较大值
            var dayProb = day && day.daytime && day.daytime.precipitation
                ? Number(day.daytime.precipitation.probability) : null;
            var nightProb = day && day.nighttime && day.nighttime.precipitation
                ? Number(day.nighttime.precipitation.probability) : null;
            var prob = Math.max(
                Number.isFinite(dayProb) ? dayProb : 0,
                Number.isFinite(nightProb) ? nightProb : 0
            );

            // 湿度、云量、降水概率在和风 v1 里都是 [0,1] 小数
            var humidity = pickValue(current.humidity);
            var cloudCover = pickValue(current.cloudCover);
            var visibility = pickValue(current.visibility);
            var feelsLike = pickValue(current.feelsLike);
            var pressure = pickValue(current.pressure);
            var precipAmount = current.precipitation
                ? pickValue(current.precipitation.amount) : null;
            var windDegree = current.wind && current.wind.direction
                ? current.wind.direction.degree : null;
            var windScale = current.wind ? current.wind.scale : null;

            // 注意 Number(null) 是 0，所以必须先判空再转数字，否则缺字段会显示「北风 null级」
            var windText = (windDegree != null && windScale != null)
                ? windDirection(Number(windDegree)) + "风 " + windScale + "级"
                : "暂无数据";

            // 空气质量卡片只显示 AQI 与等级，具体污染物浓度统一放下面的「污染物浓度」块
            var pm25 = pollutants.pm2p5 || {};
            var airText = "暂无数据";
            if (index) {
                airText = "AQI " + (index.aqiDisplay != null ? index.aqiDisplay : index.aqi) +
                    (index.category ? " " + index.category : "");
            }

            // 和风要求标注数据来源。attributions 给的是 URL，做成可点链接更友好；
            // 但这是外部数据，必须转义后再拼进 innerHTML。
            var attributions = (current.metadata && current.metadata.attributions) || [];
            var sourceNote = "<div class=\"weather-station-note\">🌤️ 数据来源：";
            if (attributions.length) {
                sourceNote += attributions.map(function (item) {
                    var text = String(item);
                    return /^https?:\/\//.test(text)
                        ? "<a href=\"" + escapeHtml(text) + "\" target=\"_blank\" rel=\"noopener noreferrer\">和风天气 QWeather</a>"
                        : escapeHtml(text);
                }).join(" / ");
            } else {
                sourceNote += "和风天气 QWeather";
            }
            sourceNote += "</div>";

            forecastElement.innerHTML =
                "<div class=\"weather-detail-heading\">今日天气详情" +
                "<span>" + text + " " + icon + "</span></div>" +
                "<div class=\"weather-detail-grid\">" +
                "<div class=\"weather-detail-card\"><i>🌬️</i><span><em>风力</em><b>" + windText + "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>👁️</i><span><em>能见度</em><b>" +
                (isNum(visibility) ? (Number(visibility) / 1000).toFixed(1) + " km" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>🌡️</i><span><em>体感温度</em><b>" +
                (isNum(feelsLike) ? Math.round(Number(feelsLike)) + "°" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>💧</i><span><em>湿度</em><b>" +
                (isNum(humidity) ? Math.round(Number(humidity) * 100) + "%" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>⏱️</i><span><em>气压</em><b>" +
                (isNum(pressure) ? Math.round(Number(pressure)) + " hPa" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>🍃</i><span><em>空气质量</em><b>" + airText + "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>☁️</i><span><em>云量</em><b>" +
                (isNum(cloudCover) ? Math.round(Number(cloudCover) * 100) + "%" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>☀️</i><span><em>紫外线</em><b>" +
                (isNum(current.uvIndex) ? Number(current.uvIndex).toFixed(1) : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>🌧️</i><span><em>降水量</em><b>" +
                (isNum(precipAmount) ? Number(precipAmount).toFixed(1) + " mm" : "暂无数据") +
                "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>☔</i><span><em>降水概率</em><b>" +
                Math.round(prob * 100) + "%</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>🌅</i><span><em>日出</em><b>" + formatWeatherTime(astro.sunrise) + "</b></span></div>" +
                "<div class=\"weather-detail-card\"><i>🌇</i><span><em>日落</em><b>" + formatWeatherTime(astro.sunset) + "</b></span></div>" +
                "</div>" +
                "<div class=\"air-quality-title\">污染物浓度</div>" +
                "<div class=\"pollutant-grid\">" +
                "<span><i>PM2.5</i><b>" + formatAirValue(pm25.value, pm25.unit) + "</b></span>" +
                "<span><i>PM10</i><b>" + formatAirValue((pollutants.pm10 || {}).value, (pollutants.pm10 || {}).unit) + "</b></span>" +
                "<span><i>O₃</i><b>" + formatAirValue((pollutants.o3 || {}).value, (pollutants.o3 || {}).unit) + "</b></span>" +
                "<span><i>NO₂</i><b>" + formatAirValue((pollutants.no2 || {}).value, (pollutants.no2 || {}).unit) + "</b></span>" +
                "<span><i>SO₂</i><b>" + formatAirValue((pollutants.so2 || {}).value, (pollutants.so2 || {}).unit) + "</b></span>" +
                "<span><i>CO</i><b>" + formatAirValue((pollutants.co || {}).value, (pollutants.co || {}).unit) + "</b></span>" +
                "</div>" +
                sourceNote;
        })
        .catch(function (error) {
            console.error(error);
            weatherElement.textContent = "天气暂时无法获取";
            weatherElement.classList.add("is-muted");
        });
}

// 带超时的 fetch：定位类接口偶尔会挂住不返回，没有超时页面会永远停在「正在定位...」
// deadlineMs 是调用方给的剩余总时限，取它和 requestTimeoutMs 的较小值，
// 保证整条回退链不会因为多个源逐个超时而越拖越久。
// init 用于附加请求头（和风的 X-QW-Api-Key 必须走头，不能用查询参数）。
function fetchWithTimeout(url, timeoutMs, deadlineMs, init) {
    var limit = timeoutMs || weatherConfig.requestTimeoutMs;
    if (typeof deadlineMs === "number" && deadlineMs < limit) {
        limit = deadlineMs;
    }
    if (limit <= 0) {
        return Promise.reject(new Error("定位总时限已到，跳过：" + url));
    }

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
        controller.abort();
    }, limit);

    var options = init || {};
    options.signal = controller.signal;

    return fetch(url, options).then(function (response) {
        window.clearTimeout(timer);
        if (!response.ok) {
            throw new Error("请求失败 " + response.status + "：" + url);
        }
        return response;
    }, function (error) {
        window.clearTimeout(timer);
        throw error;
    });
}

// 两点间大圆距离（公里），用于判断浏览器定位有没有跑偏
function haversineKm(lat1, lon1, lat2, lon2) {
    var toRad = function (deg) {
        return deg * Math.PI / 180;
    };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 兜底城市：所有定位手段都失败（或 fixed 模式）时使用
function loadFallbackWeatherLocation() {
    loadWeather(weatherConfig.fallbackLatitude,
        weatherConfig.fallbackLongitude,
        weatherConfig.fallbackCity);
}

function showWeatherUnavailable() {
    var weatherElement = document.getElementById("weather-info");
    if (weatherElement) {
        weatherElement.textContent = "天气暂时无法获取";
        weatherElement.classList.add("is-muted");
    }
}

// 把 IP 库的地址串统一成「省市区」：
//   「中国河北省保定市涞源县」→「河北省保定市涞源县」
//   「河北省保定市 联通」      →「河北省保定市」（pconline 会把 ISP 拼在后面）
function pickCityName(address) {
    var name = String(address || "").replace(/^中国/, "").trim();
    name = name.split(/\s+/)[0];
    return name.replace(/(联通|移动|电信|铁通|广电|教育网|鹏博士)$/, "");
}

// 各 IP 定位源返回结构不同，统一归一化成 { latitude, longitude, name }
// 返回 null 表示该源不可用，继续尝试下一个源
function parseIpLocation(sourceIndex, data) {
    if (!data) {
        return null;
    }

    // 源 0：v2.xxapi.cn
    if (sourceIndex === 0) {
        var loc = data.data;
        var lat = loc && Number(loc.lat);
        var lng = loc && Number(loc.lng);
        if (data.code !== 200 || !loc ||
            !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
        }
        return { latitude: lat, longitude: lng, name: pickCityName(loc.address) };
    }

    // 源 1：whois.pconline.com.cn（GBK 返回，靠 fetch 的 charset 自动解码）
    if (sourceIndex === 1) {
        var lat2 = Number(data.lat);
        var lng2 = Number(data.lng);
        if (!Number.isFinite(lat2) || !Number.isFinite(lng2)) {
            return null;
        }
        var name = pickCityName(data.addr) ||
            [data.pro, data.city].filter(Boolean).join("");
        return { latitude: lat2, longitude: lng2, name: name };
    }

    return null;
}

// 依次尝试各个 IP 定位源；成功一个就立刻用，全部失败才回退兜底城市。
// 整条链共享 locationDeadlineMs 总时限，防止逐个超时把等待时间越拖越长。
function loadLocalWeather() {
    var apis = weatherConfig.ipApis || [];
    var deadline = Date.now() + weatherConfig.locationDeadlineMs;
    var index = 0;

    function tryNext() {
        var remaining = deadline - Date.now();
        if (index >= apis.length || remaining <= 0) {
            console.warn("IP 定位源均不可用，回退到兜底城市");
            loadFallbackWeatherLocation();
            return;
        }

        var current = index++;
        fetchWithTimeout(apis[current], remaining, remaining)
            .then(function (response) {
                return response.json();
            })
            .then(function (data) {
                var result = parseIpLocation(current, data);
                if (!result) {
                    throw new Error("IP 定位源返回内容无效：" + apis[current]);
                }
                loadWeather(result.latitude, result.longitude,
                    result.name || "当前位置");
            })
            .catch(function (error) {
                console.warn(error);
                tryNext();
            });
    }

    tryNext();
}

function loadBrowserWeather() {
    if (!navigator.geolocation) {
        loadLocalWeather();
        return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;

        // 电脑端的「GPS」其实是 WiFi 定位库，经常偏到隔壁市，用距离做一次兜底校验
        var drift = haversineKm(latitude, longitude,
            weatherConfig.fallbackLatitude, weatherConfig.fallbackLongitude);
        if (Number.isFinite(drift) && drift > weatherConfig.maxAutoDistanceKm) {
            console.warn("浏览器定位偏离兜底城市 " + Math.round(drift) + " km，已忽略");
            loadLocalWeather();
            return;
        }

        // 地名仅用于显示；取数始终用定位坐标本身，不做地名反查
        loadWeather(latitude, longitude, weatherConfig.fallbackCity);
    }, function () {
        loadLocalWeather();
    }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
    });
}

// 按配置选择定位方式：auto（默认，定位访客所在地）/ fixed（永远用兜底坐标）
function initWeather() {
    if (weatherConfig.locationMode === "fixed") {
        loadFallbackWeatherLocation();
        return;
    }

    loadBrowserWeather();
}

// 定时刷新，避免页面挂久了显示的还是几小时前的数据
function refreshWeather() {
    if (!resolvedWeatherLocation) {
        return;
    }

    loadWeather(resolvedWeatherLocation.latitude,
        resolvedWeatherLocation.longitude,
        resolvedWeatherLocation.name);
}

function isWeatherStale() {
    return Date.now() - lastWeatherFetchAt >=
        weatherConfig.refreshIntervalMinutes * 60 * 1000;
}

updateLocalTime();
window.setInterval(updateLocalTime, 1000);
initWeather();

window.setInterval(function () {
    if (document.visibilityState === "visible" && isWeatherStale()) {
        refreshWeather();
    }
}, 60 * 1000);

document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && isWeatherStale()) {
        refreshWeather();
    }
});

// 网站运行时间：修改这里即可更换建站起始时间（当前对应时间线里的“本站搭建成功 2026.9”）。
var siteStartTime = new Date("2026-09-01T00:00:00+08:00");

function updateSiteRuntime() {
    var runtimeElement = document.getElementById("site-runtime");

    if (!runtimeElement) {
        return;
    }

    var elapsed = Date.now() - siteStartTime.getTime();
    if (elapsed < 0) {
        elapsed = 0;
    }

    var days = Math.floor(elapsed / 86400000);
    var hours = Math.floor(elapsed / 3600000) % 24;
    var minutes = Math.floor(elapsed / 60000) % 60;
    var seconds = Math.floor(elapsed / 1000) % 60;

    runtimeElement.textContent = days + " 天 " + hours + " 时 " + minutes + " 分 " + seconds + " 秒";
}

updateSiteRuntime();
window.setInterval(updateSiteRuntime, 1000);

var weatherToggle = document.getElementById("weather-toggle");
var weatherForecast = document.getElementById("weather-forecast");
if (weatherToggle && weatherForecast) {
    weatherForecast.classList.add("weather-forecast-collapsed");
    weatherToggle.setAttribute("aria-expanded", "false");
    weatherToggle.addEventListener("click", function () {
        var expanded = weatherToggle.getAttribute("aria-expanded") === "true";
        weatherToggle.setAttribute("aria-expanded", String(!expanded));
        weatherForecast.classList.toggle("weather-forecast-collapsed", expanded);
    });
}

// ===== 音乐组件（参考 muyudada.dpdns.org 左侧音乐布局，图标使用 Font Awesome 免费图标） =====
var musicPlayer = {
    audio: null,
    playlist: [],
    index: 0,
    mode: "all",
    lrc: [],
    lrcIndex: -1,
    seeking: false
};

function formatMusicTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    var total = Math.floor(seconds);
    var minutes = Math.floor(total / 60);
    return minutes + ":" + String(total % 60).padStart(2, "0");
}

function parseLrc(text) {
    var lines = [];
    String(text || "").split(/\r\n|\n|\r/).forEach(function (raw) {
        var matches = raw.match(/\[\d{1,2}:\d{1,2}(?:[.:]\d{1,3})?\]/g);
        if (!matches) {
            return;
        }
        var content = raw.replace(/\[[^\]]*\]/g, "").trim();
        if (!content) {
            return;
        }
        matches.forEach(function (tag) {
            var parts = tag.slice(1, -1).split(/[:.]/);
            var minutes = parseInt(parts[0], 10);
            var seconds = parseInt(parts[1], 10);
            var fraction = parts[2] ? parseInt(parts[2], 10) / Math.pow(10, parts[2].length) : 0;
            lines.push({ time: minutes * 60 + seconds + fraction, text: content });
        });
    });
    return lines.sort(function (a, b) {
        return a.time - b.time;
    });
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
    });
}

function musicElements() {
    return {
        widget: document.getElementById("music-widget"),
        title: document.getElementById("mw-title"),
        artist: document.getElementById("mw-artist"),
        cover: document.getElementById("mw-cover-img"),
        playButton: document.getElementById("mw-play"),
        playIcon: document.querySelector("#mw-play .mw-icon-play"),
        pauseIcon: document.querySelector("#mw-play .mw-icon-pause"),
        prevButton: document.getElementById("mw-prev"),
        nextButton: document.getElementById("mw-next"),
        modeButton: document.getElementById("mw-mode"),
        muteButton: document.getElementById("mw-mute"),
        volumeIcon: document.querySelector("#mw-mute .mw-icon-vol"),
        muteIcon: document.querySelector("#mw-mute .mw-icon-mute"),
        volumeTrack: document.getElementById("mw-volume"),
        volumeBar: document.getElementById("mw-volume-bar"),
        progress: document.getElementById("mw-progress"),
        progressBar: document.getElementById("mw-progress-bar"),
        progressThumb: document.querySelector("#mw-progress .mw-progress-thumb"),
        currentTime: document.getElementById("mw-time-current"),
        totalTime: document.getElementById("mw-time-total"),
        lrcToggle: document.getElementById("mw-lrc-toggle"),
        lrcDrawer: document.getElementById("mw-lrc-drawer"),
        lrcContainer: document.getElementById("mw-lrc"),
        listToggle: document.getElementById("mw-list-toggle"),
        listDrawer: document.getElementById("mw-list-drawer"),
        playlist: document.getElementById("mw-playlist"),
        status: document.getElementById("music-player-status")
    };
}

function setMusicStatus(elements, message, isError) {
    if (!elements.status) {
        return;
    }
    if (!message) {
        elements.status.remove();
        return;
    }
    elements.status.textContent = message;
    elements.status.classList.toggle("is-error", Boolean(isError));
    elements.status.hidden = false;
}

function updatePlayIcon(elements) {
    var playing = musicPlayer.audio && !musicPlayer.audio.paused;
    elements.playIcon.hidden = playing;
    elements.pauseIcon.hidden = !playing;
    elements.playButton.title = playing ? "暂停" : "播放";
    elements.playButton.setAttribute("aria-label", playing ? "暂停" : "播放");
    elements.widget.classList.toggle("is-playing", Boolean(playing));
}

function updateProgress(elements) {
    var audio = musicPlayer.audio;
    if (!audio || musicPlayer.seeking) {
        return;
    }
    var duration = audio.duration;
    var percent = duration ? (audio.currentTime / duration) * 100 : 0;
    elements.progressBar.style.width = percent + "%";
    elements.progressThumb.style.left = percent + "%";
    elements.currentTime.textContent = formatMusicTime(audio.currentTime);
    elements.totalTime.textContent = formatMusicTime(duration);
    elements.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function updateVolumeUI(elements) {
    var audio = musicPlayer.audio;
    if (!audio) {
        return;
    }
    var muted = audio.muted || audio.volume === 0;
    elements.volumeIcon.hidden = muted;
    elements.muteIcon.hidden = !muted;
    elements.muteButton.title = muted ? "取消静音" : "静音";
    elements.muteButton.setAttribute("aria-label", muted ? "取消静音" : "静音");
    var percent = audio.muted ? 0 : audio.volume * 100;
    elements.volumeBar.style.width = percent + "%";
    elements.volumeTrack.setAttribute("aria-valuenow", String(Math.round(percent)));
}

function updateModeUI(elements) {
    elements.widget.classList.remove("mode-one", "mode-shuffle");
    if (musicPlayer.mode === "one") {
        elements.widget.classList.add("mode-one");
        elements.modeButton.title = "单曲循环";
    } else if (musicPlayer.mode === "shuffle") {
        elements.widget.classList.add("mode-shuffle");
        elements.modeButton.title = "随机播放";
    } else {
        elements.modeButton.title = "列表循环";
    }
}

function highlightPlaylist(elements) {
    if (!elements.playlist) {
        return;
    }
    var items = elements.playlist.children;
    for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle("current", i === musicPlayer.index);
    }
}

function renderLyrics(elements) {
    musicPlayer.lrcIndex = -1;
    if (!musicPlayer.lrc.length) {
        elements.lrcContainer.innerHTML = "<div class=\"mw-lrc-empty\">暂无歌词</div>";
        return;
    }
    elements.lrcContainer.innerHTML = musicPlayer.lrc.map(function (line, i) {
        return "<p class=\"mw-lrc-line\" data-lrc-index=\"" + i + "\">" + escapeHtml(line.text) + "</p>";
    }).join("");
}

function updateLyric(elements) {
    var lines = musicPlayer.lrc;
    if (!lines.length) {
        return;
    }
    var time = musicPlayer.audio.currentTime;
    var index = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].time <= time) {
            index = i;
        } else {
            break;
        }
    }
    if (index === musicPlayer.lrcIndex) {
        return;
    }
    musicPlayer.lrcIndex = index;
    var nodes = elements.lrcContainer.children;
    for (var j = 0; j < nodes.length; j++) {
        nodes[j].classList.toggle("current", j === index);
    }
    if (index >= 0 && nodes[index]) {
        var node = nodes[index];
        elements.lrcContainer.scrollTop = node.offsetTop -
            elements.lrcContainer.offsetTop -
            elements.lrcContainer.clientHeight / 2 +
            node.offsetHeight / 2;
    }
}

function loadLyrics(song, elements) {
    musicPlayer.lrc = [];
    renderLyrics(elements);
    if (!song.lrc) {
        return;
    }
    fetch(song.lrc)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("歌词请求失败：" + response.status);
            }
            return response.text();
        })
        .then(function (text) {
            if (musicPlayer.playlist[musicPlayer.index] !== song) {
                return;
            }
            musicPlayer.lrc = parseLrc(text);
            renderLyrics(elements);
        })
        .catch(function () {
            if (musicPlayer.playlist[musicPlayer.index] === song) {
                musicPlayer.lrc = [];
                renderLyrics(elements);
            }
        });
}

function loadCurrentSong(autoplay, elements) {
    var song = musicPlayer.playlist[musicPlayer.index];
    if (!song || !musicPlayer.audio) {
        return;
    }

    elements.title.textContent = song.name;
    elements.title.title = song.name;
    elements.artist.textContent = song.artist || "未知歌手";
    elements.artist.title = song.artist || "未知歌手";

    if (song.cover) {
        elements.cover.src = song.cover;
        elements.cover.classList.add("is-visible");
    } else {
        elements.cover.classList.remove("is-visible");
    }

    elements.progressBar.style.width = "0%";
    elements.progressThumb.style.left = "0%";
    elements.currentTime.textContent = "0:00";
    elements.totalTime.textContent = "0:00";
    elements.progress.setAttribute("aria-valuenow", "0");

    musicPlayer.audio.src = song.url;
    musicPlayer.audio.load();
    highlightPlaylist(elements);
    loadLyrics(song, elements);

    if (autoplay) {
        var playback = musicPlayer.audio.play();
        if (playback && playback.catch) {
            playback.catch(function (error) {
                console.error(error);
            });
        }
    }
}

function playSongAt(index, elements) {
    if (!musicPlayer.playlist.length) {
        return;
    }
    musicPlayer.index = (index + musicPlayer.playlist.length) % musicPlayer.playlist.length;
    loadCurrentSong(true, elements);
}

function nextSongIndex(mode) {
    var total = musicPlayer.playlist.length;
    if (total <= 1) {
        return musicPlayer.index;
    }
    if (mode === "shuffle") {
        var next = musicPlayer.index;
        while (next === musicPlayer.index) {
            next = Math.floor(Math.random() * total);
        }
        return next;
    }
    return (musicPlayer.index + 1) % total;
}

function initMusicSlider(track, onSeek) {
    var dragging = false;
    var percentFromEvent = function (event) {
        var rect = track.getBoundingClientRect();
        if (!rect.width) {
            return 0;
        }
        var x = (event.touches && event.touches[0] ? event.touches[0].clientX : event.clientX);
        return Math.min(1, Math.max(0, (x - rect.left) / rect.width));
    };
    var apply = function (event) {
        onSeek(percentFromEvent(event));
    };
    var start = function (event) {
        dragging = true;
        track.classList.add("is-seeking");
        apply(event);
    };
    var move = function (event) {
        if (dragging) {
            apply(event);
        }
    };
    var end = function () {
        if (!dragging) {
            return;
        }
        dragging = false;
        track.classList.remove("is-seeking");
    };

    track.addEventListener("mousedown", start);
    window.addEventListener("mousemove", function (event) {
        move(event);
    });
    window.addEventListener("mouseup", end);
    track.addEventListener("touchstart", start, { passive: true });
    track.addEventListener("touchmove", function (event) {
        if (dragging) {
            event.preventDefault();
            apply(event);
        }
    }, { passive: false });
    track.addEventListener("touchend", end);
    track.addEventListener("touchcancel", end);
}

function initializeMusicPlayer() {
    var elements = musicElements();
    if (!elements.widget || elements.widget.dataset.playerReady === "true") {
        return;
    }
    elements.widget.dataset.playerReady = "true";
    elements.widget.classList.add("is-loading");

    var audio = new Audio();
    audio.preload = "metadata";
    audio.volume = 0.7;
    musicPlayer.audio = audio;

    audio.addEventListener("play", function () {
        updatePlayIcon(elements);
    });
    audio.addEventListener("pause", function () {
        updatePlayIcon(elements);
    });
    audio.addEventListener("timeupdate", function () {
        updateProgress(elements);
        updateLyric(elements);
    });
    audio.addEventListener("durationchange", function () {
        updateProgress(elements);
    });
    audio.addEventListener("ended", function () {
        if (musicPlayer.mode === "one") {
            audio.currentTime = 0;
            audio.play();
            return;
        }
        playSongAt(nextSongIndex(musicPlayer.mode), elements);
    });
    audio.addEventListener("error", function () {
        if (!musicPlayer.playlist.length) {
            return;
        }
        console.error("歌曲加载失败：" + musicPlayer.playlist[musicPlayer.index].name);
    });

    elements.playButton.addEventListener("click", function () {
        if (!musicPlayer.playlist.length) {
            return;
        }
        if (audio.paused) {
            var playback = audio.play();
            if (playback && playback.catch) {
                playback.catch(function (error) {
                    console.error(error);
                });
            }
        } else {
            audio.pause();
        }
    });

    elements.prevButton.addEventListener("click", function () {
        playSongAt(musicPlayer.index - 1, elements);
    });
    elements.nextButton.addEventListener("click", function () {
        playSongAt(nextSongIndex(musicPlayer.mode), elements);
    });

    elements.modeButton.addEventListener("click", function () {
        musicPlayer.mode = musicPlayer.mode === "all" ? "one"
            : musicPlayer.mode === "one" ? "shuffle" : "all";
        updateModeUI(elements);
    });

    elements.muteButton.addEventListener("click", function () {
        audio.muted = !audio.muted;
        updateVolumeUI(elements);
    });

    initMusicSlider(elements.volumeTrack, function (percent) {
        audio.muted = false;
        audio.volume = percent;
        updateVolumeUI(elements);
    });
    initMusicSlider(elements.progress, function (percent) {
        if (!audio.duration) {
            return;
        }
        audio.currentTime = percent * audio.duration;
        updateProgress(elements);
    });
    elements.progress.addEventListener("mousedown", function () {
        musicPlayer.seeking = true;
        elements.progress.classList.add("is-seeking");
    });
    window.addEventListener("mouseup", function () {
        if (musicPlayer.seeking) {
            musicPlayer.seeking = false;
            elements.progress.classList.remove("is-seeking");
        }
    });

    function bindDrawerToggle(button, drawer, other) {
        button.addEventListener("click", function () {
            var willOpen = !drawer.classList.contains("open");
            drawer.classList.toggle("open", willOpen);
            button.setAttribute("aria-expanded", String(willOpen));
            if (other) {
                other.drawer.classList.remove("open");
                other.button.setAttribute("aria-expanded", "false");
            }
        });
    }

    bindDrawerToggle(elements.lrcToggle, elements.lrcDrawer, {
        button: elements.listToggle,
        drawer: elements.listDrawer
    });
    bindDrawerToggle(elements.listToggle, elements.listDrawer, {
        button: elements.lrcToggle,
        drawer: elements.lrcDrawer
    });

    updateModeUI(elements);
    updateVolumeUI(elements);

    var query = new URLSearchParams({
        server: musicPlaylistConfig.server,
        type: musicPlaylistConfig.type,
        id: musicPlaylistConfig.id
    });

    fetch(musicPlaylistConfig.api + "?" + query.toString())
        .then(function (response) {
            if (!response.ok) {
                throw new Error("网易云歌单请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error("网易云歌单没有可播放的歌曲");
            }

            musicPlayer.playlist = data.map(function (song) {
                return {
                    name: song.name,
                    artist: song.artist,
                    url: song.url,
                    cover: song.pic,
                    lrc: song.lrc
                };
            }).filter(function (song) {
                return song.name && song.url;
            });

            if (!musicPlayer.playlist.length) {
                throw new Error("网易云歌单没有有效的音频地址");
            }

            elements.playlist.innerHTML = musicPlayer.playlist.map(function (song, i) {
                return "<button class=\"mw-playlist-item\" type=\"button\" data-song-index=\"" + i + "\">" +
                    "<span class=\"mw-playlist-index\">" + (i + 1) + "</span>" +
                    "<span class=\"mw-playlist-name\">" + escapeHtml(song.name) + "</span>" +
                    "<span class=\"mw-playlist-artist\">" + escapeHtml(song.artist || "") + "</span>" +
                    "</button>";
            }).join("");

            elements.playlist.addEventListener("click", function (event) {
                var item = event.target.closest(".mw-playlist-item");
                if (!item) {
                    return;
                }
                playSongAt(parseInt(item.dataset.songIndex, 10), elements);
            });

            elements.widget.classList.remove("is-loading");
            setMusicStatus(elements, null);
            loadCurrentSong(false, elements);
        })
        .catch(function (error) {
            console.error(error);
            elements.widget.classList.remove("is-loading");
            elements.widget.classList.add("is-error");
            setMusicStatus(elements, "歌单加载失败，请检查网易云歌单 ID。", true);
        });
}

initializeMusicPlayer();

document.addEventListener('contextmenu', function (event) {
    event.preventDefault();
});

function handlePress(event) {
    this.classList.add('pressed');
}

function handleRelease(event) {
    this.classList.remove('pressed');
}

function handleCancel(event) {
    this.classList.remove('pressed');
}

var buttons = document.querySelectorAll('.projectItem');
buttons.forEach(function (button) {
    button.addEventListener('mousedown', handlePress);
    button.addEventListener('mouseup', handleRelease);
    button.addEventListener('mouseleave', handleCancel);
    button.addEventListener('touchstart', handlePress);
    button.addEventListener('touchend', handleRelease);
    button.addEventListener('touchcancel', handleCancel);
});

function toggleClass(selector, className) {
    var elements = document.querySelectorAll(selector);
    elements.forEach(function (element) {
        element.classList.toggle(className);
    });
}

function pop(imageURL) {
    var tcMainElement = document.querySelector(".tc-img");
    if (imageURL) {
        tcMainElement.src = imageURL;
    }
    toggleClass(".tc-main", "active");
    toggleClass(".tc", "active");
}

var tc = document.getElementsByClassName('tc');
var tc_main = document.getElementsByClassName('tc-main');
tc[0].addEventListener('click', function (event) {
    pop();
});
tc_main[0].addEventListener('click', function (event) {
    event.stopPropagation();
});



function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        while (cookie.charAt(0) == ' ') {
            cookie = cookie.substring(1, cookie.length);
        }
        if (cookie.indexOf(nameEQ) == 0) {
            return cookie.substring(nameEQ.length, cookie.length);
        }
    }
    return null;
}

var hitokotoRotateTimer = null;

function loadHitokoto() {
    var textElement = document.getElementById("hitokoto-text");
    var fromElement = document.getElementById("hitokoto-from");

    if (!textElement || !fromElement) {
        return;
    }

    textElement.classList.remove("typing");

    fetch("https://v1.hitokoto.cn")
        .then(function (response) {
            if (!response.ok) {
                throw new Error("一言接口请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!data || typeof data.hitokoto !== "string" || !data.hitokoto.trim()) {
                throw new Error("一言接口返回内容无效");
            }

            var text = data.hitokoto.trim();
            var source = typeof data.from_who === "string" && data.from_who.trim()
                ? data.from_who.trim()
                : data.from;
            var index = 0;

            textElement.textContent = "";
            textElement.classList.add("typing");
            fromElement.textContent = source ? "—— " + source : "";

            function typeNextCharacter() {
                if (index >= text.length) {
                    textElement.classList.remove("typing");
                    return;
                }

                textElement.textContent += text.charAt(index);
                index += 1;
                window.setTimeout(typeNextCharacter, 75);
            }

            typeNextCharacter();
        })
        .catch(function (error) {
            console.error(error);
            textElement.textContent = "暂时无法获取一言，请稍后再试。";
            fromElement.textContent = "";
            textElement.classList.remove("typing");
        });
}

function startHitokotoRotation() {
    if (hitokotoRotateTimer) {
        window.clearInterval(hitokotoRotateTimer);
    }

    loadHitokoto();
    hitokotoRotateTimer = window.setInterval(function () {
        loadHitokoto();
    }, 20000);
}

startHitokotoRotation();



document.addEventListener('DOMContentLoaded', function () {

    var html = document.querySelector('html');
    var themeState = getCookie("themeState") || "Light";
    var tanChiShe = document.getElementById("tanChiShe");


    var settingsToggle = document.querySelector(".theme-settings-toggle");
    var settingsPanel = document.getElementById("theme-settings-panel");
    var backgroundOpacity = document.getElementById("background-opacity");
    var backgroundBlur = document.getElementById("background-blur");
    var cardOpacity = document.getElementById("card-opacity");
    var cardBlur = document.getElementById("card-blur");
    var cardColor = document.getElementById("card-color");

    var themeDefaults = {
        Light: {
            backgroundOpacity: "0.2",
            backgroundBlur: "10",
            cardOpacity: "0.62",
            cardBlur: "12",
            cardColor: "#eff6fc"
        },
        Dark: {
            backgroundOpacity: "0.38",
            backgroundBlur: "12",
            cardOpacity: "0.78",
            cardBlur: "18",
            cardColor: "#181e2a"
        }
    };

    function getThemeDefaults() {
        return themeDefaults[themeState] || themeDefaults.Light;
    }

    function currentCardColor() {
        var colorKey = themeState == "Dark" ? "cardColorDark" : "cardColorLight";
        var savedColor = window.localStorage.getItem(colorKey) ||
            window.localStorage.getItem("cardColor");
        return savedColor || getThemeDefaults().cardColor;
    }

    function updateThemeVariables() {
        var colorParts = cardColor.value.replace("#", "").match(/.{2}/g).map(function (part) {
            return parseInt(part, 16);
        });
        html.style.setProperty("--background-opacity", backgroundOpacity.value);
        html.style.setProperty("--back_filter", backgroundBlur.value + "px");
        html.style.setProperty("--card-opacity", cardOpacity.value);
        html.style.setProperty("--card_filter", cardBlur.value + "px");
        html.style.setProperty("--card-base-rgb", colorParts.join(", "));
        window.localStorage.setItem("backgroundOpacity", backgroundOpacity.value);
        window.localStorage.setItem("backgroundBlur", backgroundBlur.value);
        window.localStorage.setItem("cardOpacity", cardOpacity.value);
        window.localStorage.setItem("cardBlur", cardBlur.value);
    }

    function changeTheme(theme) {
        tanChiShe.src = theme == "Dark"
            ? "https://raw.githubusercontent.com/MuyuDada/MuyuDada/output/github-snake-dark.svg"
            : "https://raw.githubusercontent.com/MuyuDada/MuyuDada/output/github-snake.svg";
        html.dataset.theme = theme;
        setCookie("themeState", theme, 365);
        themeState = theme;
        cardColor.value = currentCardColor();
    }

    var Checkbox = document.getElementById('myonoffswitch')
    Checkbox.addEventListener('change', function () {
        changeTheme(themeState == "Dark" ? "Light" : "Dark");
        updateThemeVariables();
    });

    if (themeState == "Dark") {
        Checkbox.checked = false;
    }

    if (settingsToggle && settingsPanel) {
        settingsToggle.addEventListener("click", function () {
            var expanded = settingsToggle.getAttribute("aria-expanded") === "true";
            settingsToggle.setAttribute("aria-expanded", String(!expanded));
            settingsPanel.hidden = expanded;
        });

        document.addEventListener("click", function (event) {
            if (!settingsPanel.contains(event.target) && !settingsToggle.contains(event.target)) {
                settingsToggle.setAttribute("aria-expanded", "false");
                settingsPanel.hidden = true;
            }
        });
    }

    var defaults = getThemeDefaults();
    var savedBackgroundOpacity = window.localStorage.getItem("backgroundOpacity");
    var savedBackgroundBlur = window.localStorage.getItem("backgroundBlur");
    var savedCardOpacity = window.localStorage.getItem("cardOpacity");
    var savedCardBlur = window.localStorage.getItem("cardBlur");
    backgroundOpacity.value = savedBackgroundOpacity !== null ? savedBackgroundOpacity : defaults.backgroundOpacity;
    backgroundBlur.value = savedBackgroundBlur !== null ? savedBackgroundBlur : defaults.backgroundBlur;
    cardOpacity.value = savedCardOpacity !== null ? savedCardOpacity : defaults.cardOpacity;
    cardBlur.value = savedCardBlur !== null ? savedCardBlur : defaults.cardBlur;
    cardColor.value = currentCardColor();

    backgroundOpacity.addEventListener("input", updateThemeVariables);
    backgroundBlur.addEventListener("input", updateThemeVariables);
    cardOpacity.addEventListener("input", updateThemeVariables);
    cardBlur.addEventListener("input", updateThemeVariables);
    cardColor.addEventListener("input", function () {
        window.localStorage.setItem(themeState == "Dark" ? "cardColorDark" : "cardColorLight", cardColor.value);
        updateThemeVariables();
    });

    changeTheme(themeState);
    updateThemeVariables();

});




// ===== 全局加载动画：DOM 就绪即退出，不再等待全部外部资源 =====
var pageLoading = document.querySelector("#zyyo-loading");
if (pageLoading) {
    var loaderShownAt = Date.now();
    var loaderHidden = false;

    var hidePageLoader = function () {
        if (loaderHidden) {
            return;
        }
        loaderHidden = true;
        // 最少展示 500ms，避免动画一闪而过
        var wait = Math.max(0, 500 - (Date.now() - loaderShownAt));
        window.setTimeout(function () {
            pageLoading.classList.add("is-done");
            var removeLoader = function (event) {
                // 忽略子元素冒泡上来的 transitionend（如主题切换时的 background-color 过渡）
                if (event && event.target !== pageLoading) {
                    return;
                }
                pageLoading.style.display = "none";
            };
            pageLoading.addEventListener("transitionend", removeLoader);
            window.setTimeout(removeLoader, 700);
        }, wait);
    };

    if (document.readyState === "interactive" || document.readyState === "complete") {
        hidePageLoader();
    } else {
        document.addEventListener("DOMContentLoaded", hidePageLoader);
    }
    window.addEventListener("load", hidePageLoader);
    // 兜底：外部资源再卡也不会一直挡住页面
    window.setTimeout(hidePageLoader, 4000);
}




if (window.localStorage.getItem("fpson") == undefined || window.localStorage.getItem("fpson") == "1") {
    var rAF = function () {
        return (
            window.requestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            function (callback) {
                window.setTimeout(callback, 1000 / 60);
            }
        );
    }();
    var frame = 0;
    var allFrameCount = 0;
    var lastTime = Date.now();
    var lastFameTime = Date.now();
    var loop = function () {
        var now = Date.now();
        var fs = (now - lastFameTime);
        var fps = Math.round(1000 / fs);

        lastFameTime = now;
        // 不置 0，在动画的开头及结尾记录此值的差值算出 FPS
        allFrameCount++;
        frame++;

        if (now > 1000 + lastTime) {
            var fps = Math.round((frame * 1000) / (now - lastTime));
            if (fps <= 5) {
                var kd = `<span style="color:#bd0000">卡成ppt🤢</span>`
            } else if (fps <= 15) {
                var kd = `<span style="color:red">电竞级帧率😖</span>`
            } else if (fps <= 25) {
                var kd = `<span style="color:orange">有点难受😨</span>`
            } else if (fps < 35) {
                var kd = `<span style="color:#9338e6">不太流畅🙄</span>`
            } else if (fps <= 45) {
                var kd = `<span style="color:#08b7e4">还不错哦😁</span>`
            } else if (fps <= 55) {
                var kd = `<span style="color:#39c5bb">十分流畅🤣</span>`
            } else if (fps <= 60) {
                var kd = `<span style="color:#00ff00">极致流畅✈</span>`
            } else {
                var kd = `<span style="color:#00ff00">直接起飞🚀</span>`
            }
            document.getElementById("fps").innerHTML = `FPS:${fps} ${kd}`;
            frame = 0;
            lastTime = now;
        };

        rAF(loop);
    }

    loop();
} else {
    document.getElementById("fps").style = "display:none!important"
}