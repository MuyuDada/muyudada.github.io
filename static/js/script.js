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
    id: "7088182166",
    api: "https://api.injahow.cn/meting/",
    listMaxHeight: "180px"
};

// Open-Meteo 配置无需 API Key。可按需修改默认城市或直接填写经纬度。
var weatherConfig = {
    city: "石家庄",
    latitude: 38.0428,
    longitude: 114.5149,
    apiHost: "https://api.open-meteo.com",
    airQualityApiHost: "https://air-quality-api.open-meteo.com",
    geocodingApiHost: "https://geocoding-api.open-meteo.com",
    ipApi: "https://v2.xxapi.cn/api/ip"
};

function updateLocalTime() {
    var timeElement = document.getElementById("local-time");
    var dateElement = document.getElementById("local-date");

    if (!timeElement || !dateElement) {
        return;
    }

    var now = new Date();
    timeElement.textContent = now.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    dateElement.textContent = now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long"
    });
}

function weatherText(code) {
    var weatherDescriptions = {
        0: "晴",
        1: "大部晴朗",
        2: "局部多云",
        3: "阴",
        45: "雾",
        48: "雾凇",
        51: "小毛毛雨",
        53: "毛毛雨",
        55: "大毛毛雨",
        61: "小雨",
        63: "中雨",
        65: "大雨",
        71: "小雪",
        73: "中雪",
        75: "大雪",
        80: "小阵雨",
        81: "阵雨",
        82: "强阵雨",
        95: "雷雨",
        96: "雷雨伴冰雹",
        99: "强雷雨伴冰雹"
    };

    return weatherDescriptions[code] || "天气未知";
}

function weatherIcon(code) {
    if (code === 0) {
        return "☀️";
    }
    if (code === 1 || code === 2) {
        return "🌤️";
    }
    if (code === 3) {
        return "☁️";
    }
    if (code === 45 || code === 48) {
        return "🌫️";
    }
    if (code >= 51 && code <= 67) {
        return "🌧️";
    }
    if (code >= 71 && code <= 77) {
        return "🌨️";
    }
    if (code >= 80 && code <= 82) {
        return "🌦️";
    }
    if (code >= 95) {
        return "⛈️";
    }
    return "🌡️";
}

function windDirection(degrees) {
    var directions = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
    return directions[Math.round(degrees / 45) % 8];
}

function windLevel(speed) {
    if (speed < 1) return 0;
    if (speed < 6) return 1;
    if (speed < 12) return 2;
    if (speed < 20) return 3;
    if (speed < 29) return 4;
    if (speed < 39) return 5;
    if (speed < 50) return 6;
    if (speed < 62) return 7;
    if (speed < 75) return 8;
    if (speed < 89) return 9;
    if (speed < 103) return 10;
    if (speed < 118) return 11;
    return 12;
}

function formatWeatherTime(value) {
    return value ? value.slice(11, 16) : "--:--";
}

function formatAirValue(value) {
    return value == null ? "暂无数据" : Math.round(value) + " μg/m³";
}

function loadWeather(latitude, longitude, locationName) {
    var weatherElement = document.getElementById("weather-info");
    var forecastElement = document.getElementById("weather-forecast");
    var locationElement = document.getElementById("weather-location");

    if (!weatherElement) {
        return;
    }

    var query = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,visibility,pressure_msl,cloud_cover,uv_index,precipitation,precipitation_probability",
        daily: "sunrise,sunset",
        forecast_days: "1",
        timezone: "auto"
    });

    var apiHost = weatherConfig.apiHost.replace(/\/+$/, "");
    fetch(apiHost + "/v1/forecast?" + query.toString())
        .then(function (response) {
            if (!response.ok) {
                throw new Error("天气请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!data || !data.current) {
                throw new Error("天气接口返回内容无效");
            }

            var current = data.current;
            if (locationElement && locationName) {
                locationElement.textContent = "⌖ " + locationName;
            }
            weatherElement.classList.remove("is-muted");
            weatherElement.innerHTML =
                "<div class=\"weather-main\"><span class=\"weather-icon\">" +
                weatherIcon(current.weather_code) + "</span><strong>" +
                Math.round(current.temperature_2m) + "°</strong><span>" +
                weatherText(current.weather_code) + "</span></div>";

            if (forecastElement && data.daily) {
                var windSpeed = Math.round(current.wind_speed_10m);
                var airQualityUrl = weatherConfig.airQualityApiHost +
                    "/v1/air-quality?latitude=" + latitude +
                    "&longitude=" + longitude +
                    "&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone" +
                    "&timezone=auto";
                fetch(airQualityUrl)
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("空气质量请求失败：" + response.status);
                        }
                        return response.json();
                    })
                    .catch(function (error) {
                        console.error(error);
                        return { current: {} };
                    })
                    .then(function (airData) {
                        var air = airData.current || {};
                        forecastElement.innerHTML =
                            "<div class=\"weather-detail-heading\">今日天气详情" +
                            "<span>" + weatherText(current.weather_code) + " " +
                            weatherIcon(current.weather_code) + "</span></div>" +
                            "<div class=\"weather-detail-grid\">" +
                            "<div class=\"weather-detail-card\"><i>🌬️</i><span><em>风力</em><b>" + windDirection(current.wind_direction_10m) +
                            "风 " + windLevel(windSpeed) + "级</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>👁️</i><span><em>能见度</em><b>" + (current.visibility / 1000).toFixed(1) + " km</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>🌡️</i><span><em>体感温度</em><b>" + Math.round(current.apparent_temperature) + "°</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>💧</i><span><em>湿度</em><b>" + current.relative_humidity_2m + "%</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>⏱️</i><span><em>气压</em><b>" + Math.round(current.pressure_msl) + " hPa</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>🍃</i><span><em>空气质量</em><b>" + (air.pm2_5 == null ? "暂无数据" : "PM2.5 " + Math.round(air.pm2_5)) + "</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>☁️</i><span><em>云量</em><b>" + current.cloud_cover + "%</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>☀️</i><span><em>紫外线</em><b>" + Number(current.uv_index).toFixed(1) + "</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>🌧️</i><span><em>降水量</em><b>" + Number(current.precipitation).toFixed(1) + " mm</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>☔</i><span><em>降水概率</em><b>" + current.precipitation_probability + "%</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>🌅</i><span><em>日出</em><b>" + formatWeatherTime(data.daily.sunrise[0]) + "</b></span></div>" +
                            "<div class=\"weather-detail-card\"><i>🌇</i><span><em>日落</em><b>" + formatWeatherTime(data.daily.sunset[0]) + "</b></span></div>" +
                            "</div>" +
                            "<div class=\"air-quality-title\">污染物浓度</div>" +
                            "<div class=\"pollutant-grid\">" +
                            "<span><i>PM2.5</i><b>" + formatAirValue(air.pm2_5) + "</b></span>" +
                            "<span><i>PM10</i><b>" + formatAirValue(air.pm10) + "</b></span>" +
                            "<span><i>O₃</i><b>" + formatAirValue(air.ozone) + "</b></span>" +
                            "<span><i>NO₂</i><b>" + formatAirValue(air.nitrogen_dioxide) + "</b></span>" +
                            "<span><i>SO₂</i><b>" + formatAirValue(air.sulphur_dioxide) + "</b></span>" +
                            "<span><i>CO</i><b>" + formatAirValue(air.carbon_monoxide) + "</b></span>" +
                            "</div>";
                    });
            }
        })
        .catch(function (error) {
            console.error(error);
            weatherElement.textContent = "天气暂时无法获取";
            weatherElement.classList.add("is-muted");
        });
}

function loadWeatherForCity() {
    var query = new URLSearchParams({
        name: weatherConfig.city,
        count: "1",
        language: "zh",
        format: "json"
    });

    fetch(weatherConfig.geocodingApiHost.replace(/\/+$/, "") + "/v1/search?" + query.toString())
        .then(function (response) {
            if (!response.ok) {
                throw new Error("城市定位请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!data || !data.results || !data.results[0]) {
                throw new Error("未找到默认城市");
            }
            loadWeather(data.results[0].latitude, data.results[0].longitude, weatherConfig.city);
        })
        .catch(function (error) {
            console.error(error);
            var weatherElement = document.getElementById("weather-info");
            if (weatherElement) {
                weatherElement.textContent = "天气暂时无法获取";
                weatherElement.classList.add("is-muted");
            }
        });
}

function loadLocalWeather() {
    fetch(weatherConfig.ipApi)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("IP 定位请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            var location = data && data.data;
            var latitude = location && Number(location.lat);
            var longitude = location && Number(location.lng);
            if (!data || data.code !== 200 ||
                !location ||
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)) {
                throw new Error("IP 定位返回内容无效");
            }
            loadWeather(latitude, longitude, location.address || location.ip);
        })
        .catch(function (error) {
            console.error(error);
            loadBrowserWeather();
        });
}

function loadBrowserWeather() {
    if (!navigator.geolocation) {
        loadLocalWeather();
        return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        var geocodingQuery = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            language: "zh",
            format: "json"
        });

        fetch(weatherConfig.geocodingApiHost.replace(/\/+$/, "") +
            "/v1/reverse?" + geocodingQuery.toString())
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("精确位置名称请求失败：" + response.status);
                }
                return response.json();
            })
            .then(function (data) {
                var result = data && data.results && data.results[0];
                var locationName = result &&
                    (result.name || result.city || result.admin1);
                loadWeather(latitude, longitude, locationName || "当前位置");
            })
            .catch(function () {
                loadWeather(latitude, longitude, "当前位置");
            });
    }, function () {
        loadLocalWeather();
    }, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
    });
}

function loadConfiguredWeatherLocation() {
    if (typeof weatherConfig.latitude === "number" &&
        typeof weatherConfig.longitude === "number") {
        loadWeather(weatherConfig.latitude, weatherConfig.longitude, weatherConfig.city);
        return;
    }

    loadWeatherForCity();
}

updateLocalTime();
window.setInterval(updateLocalTime, 1000);
loadBrowserWeather();

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

function loadMusicPlaylist() {
    var playerElement = document.getElementById("music-player");
    var statusElement = document.getElementById("music-player-status");

    if (!playerElement || !statusElement || typeof APlayer === "undefined") {
        return;
    }

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
        .then(function (playlist) {
            if (!Array.isArray(playlist) || playlist.length === 0) {
                throw new Error("网易云歌单没有可播放的歌曲");
            }

            var audio = playlist.map(function (song) {
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

            if (audio.length === 0) {
                throw new Error("网易云歌单没有有效的音频地址");
            }

            var player = new APlayer({
                container: playerElement,
                mutex: true,
                loop: "all",
                order: "list",
                volume: 0.7,
                listFolded: true,
                listMaxHeight: musicPlaylistConfig.listMaxHeight,
                lrcType: 3,
                audio: audio
            });

            statusElement.remove();
            initializeMusicPanels();
        })
        .catch(function (error) {
            console.error(error);
            statusElement.textContent = "歌单加载失败，请检查网易云歌单 ID。";
            statusElement.classList.add("is-error");
        });
}

loadMusicPlaylist();

function initializeMusicPanels() {
    var container = document.getElementById("music-player");
    var lyricPanel = container && container.querySelector(".aplayer-lrc");
    var listPanel = container && container.querySelector(".aplayer-list");
    var lyricButton = container && container.querySelector(".aplayer-icon-lrc");
    var listButton = container && container.querySelector(".aplayer-icon-menu");

    if (!container || container.dataset.panelsReady === "true") {
        return Boolean(container);
    }
    if (!lyricPanel || !listPanel || !lyricButton || !listButton) {
        return false;
    }

    var playerBody = container.querySelector(".aplayer-body");
    var panelHost = container.querySelector(".music-panels");
    if (!panelHost) {
        panelHost = document.createElement("div");
        panelHost.className = "music-panels";
        if (playerBody) {
            playerBody.insertAdjacentElement("afterend", panelHost);
        } else {
            container.appendChild(panelHost);
        }
    }
    panelHost.appendChild(lyricPanel);
    panelHost.appendChild(listPanel);

    lyricPanel.classList.add("music-panel-hidden");
    listPanel.classList.add("music-panel-hidden");
    container.dataset.panelsReady = "true";

    container.addEventListener("click", function (event) {
        var clickedButton = event.target.closest(".aplayer-icon-lrc, .aplayer-icon-menu");
        if (!clickedButton) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        var isLyricButton = clickedButton.classList.contains("aplayer-icon-lrc");
        var panel = isLyricButton ? lyricPanel : listPanel;
        var otherPanel = isLyricButton ? listPanel : lyricPanel;
        var isOpen = !panel.classList.contains("music-panel-hidden");

        panel.classList.toggle("music-panel-hidden", isOpen);
        otherPanel.classList.add("music-panel-hidden");
        lyricPanel.classList.toggle("aplayer-lrc-hide", isLyricButton ? isOpen : true);
        listPanel.classList.toggle("aplayer-list-hide", isLyricButton ? true : isOpen);
        window.setTimeout(function () {
            lyricPanel.classList.toggle("aplayer-lrc-hide", lyricPanel.classList.contains("music-panel-hidden"));
            listPanel.classList.toggle("aplayer-list-hide", listPanel.classList.contains("music-panel-hidden"));
        }, 0);
    }, true);

    return true;
}

var musicPanelsRetries = 0;
window.setTimeout(function pollMusicPanels() {
    musicPanelsRetries += 1;
    if (initializeMusicPanels() || musicPanelsRetries > 50) {
        return;
    }
    window.setTimeout(pollMusicPanels, 400);
}, 300);

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




var pageLoading = document.querySelector("#zyyo-loading");
window.addEventListener('load', function() {
    setTimeout(function () {
        pageLoading.style.opacity = '0';
    }, 100);
});




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
            } else {
                var kd = `<span style="color:#39c5bb">十分流畅🤣</span>`
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