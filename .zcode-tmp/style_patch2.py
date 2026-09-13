# -*- coding: utf-8 -*-
import re

path = 'static/css/style.css'
src = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

def sub_once(pattern, repl, text, label, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    assert n == 1, 'NO MATCH: ' + label
    return new

# ---------- 5. 图标行：设置按钮移出横向滚动容器，避免面板被裁切 ----------
icon_row = '''.iconRow {
    width: 100%;
    display: flex;
    align-items: center;
    margin-top: 20px;
    position: relative;
    z-index: 40;
}

.iconContainer {
    flex: 0 1 auto;
    min-width: 0;
    height: 60px;
    display: flex;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
}'''
src = sub_once(r'\.iconContainer \{\n    width: 100%;\n    height: 60px;\n    display: flex;\n    align-items: center;\n    overflow: visible;\n    margin-top: 20px;\n    position: relative;\n    z-index: 20;\n\}', icon_row, src, 'iconRow/iconContainer')

# 删除已并入主样式的列表高度覆盖
src = sub_once(r'header \.music-card \.aplayer \.aplayer-list \{\n    max-height: 120px;\n\}\n\n', '', src, 'old list max-height')

# ---------- 6. 图标按钮：统一卡片外观 ----------
icon_item = '''.iconItem {
    width: 49px;
    height: 43px;
    box-sizing: border-box;
    border: 1px solid var(--card-border);
    border-radius: 10px;
    display: flex;
    margin-left: 10px;
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
    background: var(--item_bg_color);
    box-shadow: var(--control-shadow);
    align-items: center;
    justify-content: center;
    transition: width 0.3s ease, opacity 0.3s ease, transform 0.3s ease, background-color 0.2s ease;
    flex-shrink: 0;
}'''
src = sub_once(r'\.iconItem \{\n    width: 49px;\n.*?\n\}', icon_item, src, 'iconItem')

# ---------- 7. 项目卡片：合并两个重复块并统一外观 ----------
project_item = '''.projectItem {
    margin: 7px;
    display: flex;
    background-color: var(--item_bg_color);
    border: 1px solid var(--card-border);
    border-radius: 12px;
    padding: 15px;
    height: 100px;
    width: calc(25% - 15px);
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
    box-shadow: var(--card-shadow);
    transition: opacity 0.5s ease, background-color 0.2s ease, border 0.2s ease, transform 0.3s ease;
}

'''
src = sub_once(r'\.projectItem \{\n.*?(?=\.projectItem:hover)', project_item, src, 'projectItem merged')

# ---------- 8. 设置面板与开关按钮 ----------
settings = '''.theme-settings {
    position: relative;
    flex-shrink: 0;
    margin-left: 10px;
}

.theme-settings-toggle {
    width: 49px;
    height: 43px;
    padding: 0;
    border: 1px solid var(--card-border);
    border-radius: 10px;
    color: var(--main_text_color);
    background: var(--item_bg_color);
    cursor: pointer;
    font-size: 20px;
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
    box-shadow: var(--control-shadow);
    transition: transform 0.3s ease, background-color 0.2s ease, border-color 0.2s ease;
}

.theme-settings-toggle:hover,
.theme-settings-toggle[aria-expanded="true"] {
    background: var(--item_hover_color);
    transform: translateY(-2px);
}

/* 面板向下弹出，且不再处于任何 overflow 滚动容器内，不会被裁切或遮挡 */
.theme-settings-panel {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 60;
    display: grid;
    gap: 12px;
    width: 235px;
    padding: 15px;
    border: 1px solid var(--card-border);
    border-radius: 14px;
    color: var(--music-text);
    background: var(--item_bg_color);
    box-shadow: var(--card-shadow);
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.22s ease, transform 0.22s ease;
}

.theme-settings-panel[hidden] {
    display: grid;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-6px) scale(0.98);
}

.theme-setting-row {
    display: grid;
    grid-template-columns: 1fr 105px;
    align-items: center;
    gap: 10px;
    color: var(--music-text);
    font-size: 12px;
}

.theme-setting-row input[type="range"] {
    width: 100%;
    height: 5px;
    margin: 0;
    accent-color: var(--purple_text_color);
    cursor: pointer;
}

.theme-setting-row .onoffswitch {
    justify-self: end;
}

.theme-setting-row input[type="range"]::-webkit-slider-runnable-track {
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--music-muted) 28%, transparent);
}

.theme-setting-row input[type="range"]::-webkit-slider-thumb {
    width: 15px;
    height: 15px;
    margin-top: -5px;
    border: 2px solid var(--card-border);
    border-radius: 50%;
    background: var(--purple_text_color);
    appearance: none;
}

.theme-color-row input[type="color"] {
    width: 105px;
    height: 25px;
    padding: 2px;
    border: 1px solid var(--card-border);
    border-radius: 999px;
    background: transparent;
    cursor: pointer;
}'''
src = sub_once(r'\.theme-settings \{\n.*?\.theme-color-row input\[type="color"\] \{.*?\n\}', settings, src, 'theme settings section')

# ---------- 9. 媒体查询 ----------
# 1150px 以下：音乐卡片改为文档流内，避免遮挡标题
src = sub_once(r'@media \(max-width: 1150px\) \{\n',
'''@media (max-width: 1150px) {
    header .music-card {
        position: relative;
        top: auto;
        right: auto;
        z-index: auto;
        width: 100%;
        max-width: 440px;
        margin: 18px 0 0;
    }

''', src, 'media 1150 music card')

# 800px 以下：清理旧的音乐卡片规则，图标行间距调整
src = sub_once(r'    header \{\n        padding-right: 0;\n    \}\n\n    header \.music-card \{\n        position: relative;\n        top: auto;\n        right: auto;\n        width: 100%;\n        margin: 18px 0 0;\n    \}\n\n',
'    header {\n        padding-right: 0;\n    }\n\n', src, 'media 800 cleanup')

src = sub_once(r'    \.iconContainer \{\n\n        margin-top: 4vw;\n        overflow-x: auto;\n        overflow-y: visible;\n\n    \}\n',
'    .iconRow {\n        margin-top: 4vw;\n    }\n\n    .theme-settings-panel {\n        width: min(235px, calc(100vw - 60px));\n    }\n', src, 'media 800 iconRow')

# 小屏：隐藏音量与顺序按钮，防止时间行溢出
src = sub_once(r'\n\n\.tc \{',
'''

@media (max-width: 480px) {

    .music-card .aplayer .aplayer-volume-wrap,
    .music-card .aplayer .aplayer-time .aplayer-icon-order {
        display: none !important;
    }
}

.tc {''', src, 'media 480 player buttons')

open(path, 'w', encoding='utf-8', newline='').write(src.replace('\n', '\r\n'))
print('style.css part 2 OK, lines:', src.count('\n'))
