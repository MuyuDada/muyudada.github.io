# -*- coding: utf-8 -*-
import re

path = 'static/js/script.js'
src = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

new_block = '''    var settingsToggle = document.querySelector(".theme-settings-toggle");
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
'''

pattern = r"    function changeTheme\(theme\) \{.*?    changeTheme\(themeState\);\n    updateOpacityVariables\(\);\n"
new, n = re.subn(pattern, new_block, src, count=1, flags=re.S)
assert n == 1, 'theme block not replaced'
assert 'updateOpacityVariables' not in new, 'stale updateOpacityVariables references remain'

open(path, 'w', encoding='utf-8', newline='').write(new.replace('\n', '\r\n'))
print('script.js OK')
