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

// 和风天气配置：将 key 替换为控制台申请的 Web API Key。
var weatherConfig = {
    key: "88ae3e30712d4c7ea92e8b8b209949fb",
    city: "石家庄",
    api: "n27p3u5uhf.re.qweatherapi.com",
    geoApi: "https://geoapi.qweather.com"
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

function loadWeather(location) {
    var weatherElement = document.getElementById("weather-info");

    if (!weatherElement) {
        return;
    }

    if (!weatherConfig.key) {
        weatherElement.textContent = "请在 script.js 中填写和风天气 Key";
        weatherElement.classList.add("is-muted");
        return;
    }

    var query = new URLSearchParams({
        location: location,
        key: weatherConfig.key
    });

    fetch(weatherConfig.api + "/v7/weather/now?" + query.toString())
        .then(function (response) {
            if (!response.ok) {
                throw new Error("天气请求失败：" + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!data || data.code !== "200" || !data.now) {
                throw new Error("天气接口返回内容无效");
            }

            weatherElement.classList.remove("is-muted");
            weatherElement.innerHTML =
                "<strong>" + data.now.temp + "°</strong> " + data.now.text +
                "<span>" + data.now.windDir + " " + data.now.windScale + "级 · 湿度 " +
                data.now.humidity + "%</span>";
        })
        .catch(function (error) {
            console.error(error);
            weatherElement.textContent = "天气暂时无法获取";
            weatherElement.classList.add("is-muted");
        });
}

function loadLocalWeather() {
    if (!weatherConfig.key) {
        loadWeather(weatherConfig.city);
        return;
    }

    if (!navigator.geolocation) {
        loadWeather(weatherConfig.city);
        return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
        var location = position.coords.longitude.toFixed(2) + "," +
            position.coords.latitude.toFixed(2);
        loadWeather(location);
    }, function () {
        loadWeather(weatherConfig.city);
    }, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 600000
    });
}

updateLocalTime();
window.setInterval(updateLocalTime, 1000);
loadLocalWeather();

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

            new APlayer({
                container: playerElement,
                mutex: true,
                loop: "all",
                order: "list",
                volume: 0.7,
                listFolded: false,
                listMaxHeight: musicPlaylistConfig.listMaxHeight,
                lrcType: 3,
                audio: audio
            });
            statusElement.remove();
        })
        .catch(function (error) {
            console.error(error);
            statusElement.textContent = "歌单加载失败，请检查网易云歌单 ID。";
            statusElement.classList.add("is-error");
        });
}

loadMusicPlaylist();

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


    function changeTheme(theme) {
        tanChiShe.src = theme == "Dark"
            ? "https://raw.githubusercontent.com/MuyuDada/MuyuDada/output/github-snake-dark.svg"
            : "https://raw.githubusercontent.com/MuyuDada/MuyuDada/output/github-snake.svg";
        html.dataset.theme = theme;
        setCookie("themeState", theme, 365);
        themeState = theme;
    }

    var Checkbox = document.getElementById('myonoffswitch')
    Checkbox.addEventListener('change', function () {
        if (themeState == "Dark") {
            changeTheme("Light");
        } else if (themeState == "Light") {
            changeTheme("Dark");
        } else {
            changeTheme("Dark");
        }
    });

    if (themeState == "Dark") {
        Checkbox.checked = false;
    }

    changeTheme(themeState);

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