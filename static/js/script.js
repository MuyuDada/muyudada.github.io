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
                // IP 定位失败时，回退到配置的默认城市
                loadConfiguredWeatherLocation();
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