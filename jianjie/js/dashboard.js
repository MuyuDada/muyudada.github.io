/* ==========================================================================
   dashboard.js —— 当地时间 + 天气预报（移植自项目根 static/js/script.js）
   - 纯原生 JS，不依赖 jQuery / Font Awesome / 任何 jianjie 之外的资源。
   - 所有 DOM 查询都做了空值保护，元素缺失时静默跳过，不抛异常。
   - 所有 id 一律 dw- 前缀，避免与目标页面已有节点冲突。
   逻辑来源：static/js/script.js 第 18–640 行（天气 + 时间部分），
   已保留全部回退分支、超时、跑偏校验与自动刷新。
   ========================================================================== */
(function () {
	"use strict";

	// ===================== 和风天气（QWeather）配置 =====================
	//
	// 【定位策略】dwWeatherConfig.locationMode
	//   "auto"  —— 默认。定位访客所在地：浏览器 GPS（带跑偏校验）→ IP 定位 → 兜底城市。
	//   "fixed" —— 不做任何定位，永远显示下面写死的兜底城市。
	//
	// 关于定位可靠性（原实现踩过的坑，别改回去）：
	//   1) 浏览器 GPS 在电脑端其实是 WiFi 定位库，经常偏到隔壁市 → 用 maxAutoDistanceKm 校验；
	//   2) 国内宽带 IP 归属地会跨市漂移，同一个 IP 被不同 IP 库分别解析成
	//      涞源 / 保定 / 石家庄 / 承德，跨度 300 km → 地名只用于「显示」，
	//      取数一律用 IP 库返回的经纬度，不用地名反查坐标；
	//   3) 中文地名库不可靠（「保定」会命中云南的一个村，「涞源县」查不到），
	//      绝不要用城市名反查坐标；和风 v1 直接吃经纬度，同样不需要反查；
	//   4) 定位类接口偶尔会挂住不返回 → 必须有超时，否则页面永远停在「正在定位...」。
	var dwWeatherConfig = {
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

	// ===================== 时间 / 日期 =====================
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

	function dwEl(id) {
		return document.getElementById(id);
	}

	function updateLocalTime() {
		var timeElement = dwEl("dw-local-time-main");
		var secondsElement = dwEl("dw-local-time-seconds");
		var periodElement = dwEl("dw-time-period");
		var dateElement = dwEl("dw-local-date");

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
	// condition.code 只在挑图标时当兜底。
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
		var host = String(dwWeatherConfig.qweatherApiHost || "").replace(/\/+$/, "");
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

	// 外部数据（attributions）拼进 innerHTML 前必须转义
	function escapeHtml(text) {
		return String(text).replace(/[&<>"']/g, function (ch) {
			return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch];
		});
	}

	// 带超时的 fetch：定位类接口偶尔会挂住不返回，没有超时页面会永远停在「正在定位...」
	// deadlineMs 是调用方给的剩余总时限，取它和 requestTimeoutMs 的较小值，
	// 保证整条回退链不会因为多个源逐个超时而越拖越久。
	// init 用于附加请求头（和风的 X-QW-Api-Key 必须走头，不能用查询参数）。
	function fetchWithTimeout(url, timeoutMs, deadlineMs, init) {
		var limit = timeoutMs || dwWeatherConfig.requestTimeoutMs;
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

	function loadWeather(latitude, longitude, locationName) {
		var weatherElement = dwEl("dw-weather-info");
		var forecastElement = dwEl("dw-weather-forecast");
		var locationElement = dwEl("dw-weather-location");

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
		var timeout = dwWeatherConfig.requestTimeoutMs;
		var authInit = { headers: { "X-QW-Api-Key": dwWeatherConfig.qweatherApiKey } };

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
				weatherElement.classList.remove("dw-muted");
				weatherElement.innerHTML =
					"<div class=\"dw-weather-main\"><span class=\"dw-weather-icon\">" +
					icon + "</span><strong>" +
					Math.round(Number(temp)) + "°</strong><span>" +
					escapeHtml(text) + "</span></div>";

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
				var sourceNote = "<div class=\"dw-source-note\">🌤️ 数据来源：";
				if (attributions.length) {
					sourceNote += attributions.map(function (item) {
						var itemText = String(item);
						return /^https?:\/\//.test(itemText)
							? "<a href=\"" + escapeHtml(itemText) + "\" target=\"_blank\" rel=\"noopener noreferrer\">和风天气</a>"
							: escapeHtml(itemText);
					}).join(" / ");
				} else {
					sourceNote += "和风天气";
				}
				sourceNote += "</div>";

				forecastElement.innerHTML =
					"<div class=\"dw-detail-heading\">今日天气详情" +
					"<span>" + escapeHtml(text) + " " + icon + "</span></div>" +
					"<div class=\"dw-detail-grid\">" +
					"<div class=\"dw-detail-card\"><i>🌬️</i><span><em>风力</em><b>" + windText + "</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>👁️</i><span><em>能见度</em><b>" +
					(isNum(visibility) ? (Number(visibility) / 1000).toFixed(1) + " km" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>🌡️</i><span><em>体感温度</em><b>" +
					(isNum(feelsLike) ? Math.round(Number(feelsLike)) + "°" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>💧</i><span><em>湿度</em><b>" +
					(isNum(humidity) ? Math.round(Number(humidity) * 100) + "%" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>⏱️</i><span><em>气压</em><b>" +
					(isNum(pressure) ? Math.round(Number(pressure)) + " hPa" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>🍃</i><span><em>空气质量</em><b>" + airText + "</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>☁️</i><span><em>云量</em><b>" +
					(isNum(cloudCover) ? Math.round(Number(cloudCover) * 100) + "%" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>☀️</i><span><em>紫外线</em><b>" +
					(isNum(current.uvIndex) ? Number(current.uvIndex).toFixed(1) : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>🌧️</i><span><em>降水量</em><b>" +
					(isNum(precipAmount) ? Number(precipAmount).toFixed(1) + " mm" : "暂无数据") +
					"</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>☔</i><span><em>降水概率</em><b>" +
					Math.round(prob * 100) + "%</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>🌅</i><span><em>日出</em><b>" + formatWeatherTime(astro.sunrise) + "</b></span></div>" +
					"<div class=\"dw-detail-card\"><i>🌇</i><span><em>日落</em><b>" + formatWeatherTime(astro.sunset) + "</b></span></div>" +
					"</div>" +
					"<div class=\"dw-air-title\">污染物浓度</div>" +
					"<div class=\"dw-pollutant-grid\">" +
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
				showWeatherUnavailable();
			});
	}

	// 兜底城市：所有定位手段都失败（或 fixed 模式）时使用
	function loadFallbackWeatherLocation() {
		loadWeather(dwWeatherConfig.fallbackLatitude,
			dwWeatherConfig.fallbackLongitude,
			dwWeatherConfig.fallbackCity);
	}

	function showWeatherUnavailable() {
		var weatherElement = dwEl("dw-weather-info");
		if (weatherElement) {
			weatherElement.textContent = "天气暂时无法获取";
			weatherElement.classList.add("dw-muted");
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
		var apis = dwWeatherConfig.ipApis || [];
		var deadline = Date.now() + dwWeatherConfig.locationDeadlineMs;
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
				dwWeatherConfig.fallbackLatitude, dwWeatherConfig.fallbackLongitude);
			if (Number.isFinite(drift) && drift > dwWeatherConfig.maxAutoDistanceKm) {
				console.warn("浏览器定位偏离兜底城市 " + Math.round(drift) + " km，已忽略");
				loadLocalWeather();
				return;
			}

			// 地名仅用于显示；取数始终用定位坐标本身，不做地名反查
			loadWeather(latitude, longitude, dwWeatherConfig.fallbackCity);
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
		if (dwWeatherConfig.locationMode === "fixed") {
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
			dwWeatherConfig.refreshIntervalMinutes * 60 * 1000;
	}

	// ===================== 天气详情折叠开关 =====================
	function initWeatherToggle() {
		var weatherToggle = dwEl("dw-weather-toggle");
		var weatherForecast = dwEl("dw-weather-forecast");
		if (!weatherToggle || !weatherForecast) {
			return;
		}

		weatherForecast.removeAttribute("hidden");
		weatherForecast.classList.add("dw-collapsed");
		weatherToggle.setAttribute("aria-expanded", "false");
		weatherToggle.addEventListener("click", function () {
			var expanded = weatherToggle.getAttribute("aria-expanded") === "true";
			weatherToggle.setAttribute("aria-expanded", String(!expanded));
			weatherForecast.classList.toggle("dw-collapsed", expanded);
		});
	}

	// ===================== 启动 =====================
	function initDashboard() {
		initWeatherToggle();
		updateLocalTime();
		window.setInterval(updateLocalTime, 1000);
		initWeather();

		// 每分钟检查一次是否已过期（阈值 = refreshIntervalMinutes），
		// 与原实现一致：切回前台时若数据过期也会立刻刷新
		window.setInterval(function () {
			if (document.visibilityState === "visible" && isWeatherStale()) {
				refreshWeather();
			}
		}, 60 * 1000);

		// 切回前台时若数据已过期，立刻刷新
		document.addEventListener("visibilitychange", function () {
			if (document.visibilityState === "visible" && isWeatherStale()) {
				refreshWeather();
			}
		});

		// 双保险：定位链若因异常卡死，超过「定位总时限 + 单请求超时」仍未取到数据，
		// 直接落到兜底城市，绝不让卡片停在「正在定位...」。
		window.setTimeout(function () {
			if (!resolvedWeatherLocation) {
				console.warn("定位链超时未返回，使用兜底城市");
				loadFallbackWeatherLocation();
			}
		}, dwWeatherConfig.locationDeadlineMs + dwWeatherConfig.requestTimeoutMs + 1000);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initDashboard);
	} else {
		initDashboard();
	}
})();
