# -*- coding: utf-8 -*-
import re

path = 'static/css/style.css'
src = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

def sub_once(pattern, repl, text, label, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    assert n == 1, 'NO MATCH: ' + label
    return new

# ---------- 1. 明暗主题变量：合并重复块，定义 Light/Dark 完整参数 ----------
theme_block = '''html[data-theme="Light"] {
    --card-base-rgb: 239, 246, 252;
    --backdrop-rgb: 255, 255, 255;
    --background-opacity: 0.2;
    --card-opacity: 0.62;
    --card_filter: 12px;
    --back_filter: 10px;

    --main_text_color: #26364a;
    --gradient: linear-gradient(120deg, #bd34fe, #e0321b 30%, #41d1ff 60%);
    --purple_text_color: #6470ff;
    --text_bg_color: rgba(121, 163, 231, 0.45);
    --item_bg_color: rgba(var(--card-base-rgb), var(--card-opacity));
    --item_hover_color: rgba(255, 255, 255, 0.65);
    --item_left_title_color: #1c2a3a;
    --item_left_text_color: #51616f;
    --footer_text_color: #3a4858;
    --left_tag_item: rgba(255, 255, 255, 0.6);
    --back_filter_color: #ffffff40;
    --fill: #33465c;

    --card-border: rgba(255, 255, 255, 0.65);
    --card-shadow: 0 10px 26px rgba(38, 66, 92, 0.16);
    --control-shadow: 0 4px 12px rgba(38, 66, 92, 0.12);
    --hairline: rgba(94, 124, 158, 0.28);

    --music-text: #26384d;
    --music-muted: #5e7184;
    --music-panel-bg: rgba(255, 255, 255, 0.55);
    --music-control-bg: rgba(121, 163, 231, 0.3);
    --music-control-text: #33506b;
    --music-bar-track: rgba(119, 151, 178, 0.28);
}

html[data-theme="Dark"] {
    --card-base-rgb: 24, 30, 42;
    --backdrop-rgb: 8, 12, 20;
    --background-opacity: 0.38;
    --card-opacity: 0.78;
    --card_filter: 18px;
    --back_filter: 12px;

    --main_text_color: #f2f6fc;
    --gradient: linear-gradient(120deg, rgb(133, 62, 255), #f76cc6 30%, rgb(255, 255, 255) 60%);
    --purple_text_color: #8f9bff;
    --text_bg_color: rgba(116, 123, 255, 0.3);
    --item_bg_color: rgba(var(--card-base-rgb), var(--card-opacity));
    --item_hover_color: rgba(255, 255, 255, 0.12);
    --item_left_title_color: #ffffff;
    --item_left_text_color: #a7b4c6;
    --footer_text_color: #8d99ab;
    --left_tag_item: rgba(255, 255, 255, 0.14);
    --back_filter_color: #00000059;
    --fill: #ffffff;

    --card-border: rgba(255, 255, 255, 0.16);
    --card-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
    --control-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    --hairline: rgba(255, 255, 255, 0.14);

    --music-text: #f5f8fc;
    --music-muted: #b9c5d6;
    --music-panel-bg: rgba(255, 255, 255, 0.07);
    --music-control-bg: rgba(255, 255, 255, 0.14);
    --music-control-text: #e8eef7;
    --music-bar-track: rgba(255, 255, 255, 0.16);
}

'''
src = sub_once(r'html\[data-theme="Dark"\] \{.*?(?=body \{)', theme_block, src, 'theme vars')

# ---------- 2. 左侧卡片：套用统一卡片样式 ----------
left_div = '''.left-div {
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--card-border);
    border-radius: 14px;
    margin-top: 15px;
    padding: 20px;
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
    background: var(--item_bg_color);
    box-shadow: var(--card-shadow);
}'''
src = sub_once(r'\.left-div \{\n.*?\n\}', left_div, src, 'left-div')

# ---------- 3. 音乐播放器整体重写 ----------
music = '''.music-card {
    position: absolute;
    top: 30px;
    right: 0;
    z-index: 3;
    width: 300px;
    padding: 14px 14px 12px;
    border: 1px solid var(--card-border);
    border-radius: 16px;
    background: var(--item_bg_color);
    box-shadow: var(--card-shadow);
    backdrop-filter: blur(var(--card_filter));
    -webkit-backdrop-filter: blur(var(--card_filter));
}

.music-card-title {
    padding: 0 4px 12px;
    color: var(--music-text);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
}

.music-card .aplayer {
    margin: 0;
    color: var(--music-text);
    font-family: inherit;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
}

/* 封面与信息左右分栏 */
.music-card .aplayer .aplayer-body {
    display: grid;
    grid-template-columns: 62px minmax(0, 1fr);
    column-gap: 12px;
    align-items: start;
}

.music-card .aplayer .aplayer-pic {
    grid-row: 1;
    width: 62px;
    height: 62px;
    flex: none;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(20, 40, 60, 0.28);
}

.music-card .aplayer .aplayer-pic .aplayer-button {
    background: rgba(0, 0, 0, 0.35);
}

.music-card .aplayer .aplayer-info {
    min-width: 0;
    height: auto;
    margin-left: 0;
    padding: 0;
    border: 0;
}

/* 歌词面板会被 script.js 移到 .music-panels 里再显示 */
.music-card .aplayer .aplayer-info .aplayer-lrc {
    display: none;
}

.music-card .aplayer .aplayer-music {
    height: auto;
    margin: 2px 0 6px;
    padding: 0;
}

.music-card .aplayer .aplayer-title {
    color: var(--music-text);
    font-size: 13px;
    font-weight: 700;
}

.music-card .aplayer .aplayer-author {
    color: var(--music-muted);
    font-size: 11px;
}

/* 控制区：进度条在上，时间与按钮在下 */
.music-card .aplayer .aplayer-controller {
    position: static;
    flex-direction: column;
    gap: 4px;
    margin: 8px 0 0;
}

.music-card .aplayer .aplayer-bar-wrap {
    flex: none;
    margin: 0;
    padding: 3px 0;
}

.music-card .aplayer .aplayer-bar {
    height: 4px;
    border-radius: 99px;
    background: var(--music-bar-track);
}

.music-card .aplayer .aplayer-loaded,
.music-card .aplayer .aplayer-played {
    height: 4px;
    border-radius: 99px;
}

.music-card .aplayer .aplayer-loaded {
    background: var(--music-control-bg);
}

.music-card .aplayer .aplayer-played {
    background: var(--purple_text_color);
}

.music-card .aplayer .aplayer-thumb {
    width: 10px;
    height: 10px;
    margin-top: -3px;
    margin-right: -5px;
    border: 2px solid var(--purple_text_color);
    border-radius: 50%;
    background: #ffffff;
}

.music-card .aplayer .aplayer-time {
    position: relative;
    right: auto;
    bottom: auto;
    display: flex;
    align-items: center;
    gap: 3px;
    height: 22px;
    padding-left: 0;
    color: var(--music-muted);
    font-size: 11px;
}

.music-card .aplayer .aplayer-time-inner {
    flex: 1 1 auto;
    min-width: 0;
    margin-right: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.music-card .aplayer .aplayer-time .aplayer-icon {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 7px;
    color: var(--music-control-text) !important;
    background: var(--music-control-bg);
    opacity: 1 !important;
    cursor: pointer;
    transition: color 0.2s ease, background-color 0.2s ease, transform 0.2s ease;
}

.music-card .aplayer .aplayer-time .aplayer-icon svg {
    width: 13px;
    height: 13px;
}

.music-card .aplayer .aplayer-time .aplayer-icon svg path {
    fill: currentColor;
}

.music-card .aplayer .aplayer-time .aplayer-icon:hover {
    color: #ffffff !important;
    background: var(--purple_text_color);
    transform: translateY(-1px);
}

.music-card .aplayer .aplayer-volume-bar-wrap {
    display: none;
}

/* 歌词 / 播放列表面板（script.js 会移动到 .music-panels 内） */
.music-card .aplayer .music-panels {
    margin-top: 10px;
}

.music-card .aplayer .music-panels > .aplayer-lrc {
    display: block !important;
    position: relative;
    height: 68px;
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--music-panel-bg);
    text-align: center;
}

.music-card .aplayer .music-panels > .aplayer-lrc::before,
.music-card .aplayer .music-panels > .aplayer-lrc::after {
    display: none;
}

.music-card .aplayer .aplayer-lrc p {
    color: var(--music-muted);
    font-size: 12px;
}

.music-card .aplayer .aplayer-lrc p.aplayer-lrc-current {
    color: var(--music-text);
}

.music-card .aplayer .music-panels > .aplayer-list {
    display: block !important;
    max-height: 168px;
    margin: 0;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--music-panel-bg);
    color: var(--music-text);
    overflow: hidden;
}

.music-card .aplayer .music-panels > .aplayer-lrc,
.music-card .aplayer .music-panels > .aplayer-list {
    transition: max-height 0.3s ease, opacity 0.24s ease, transform 0.3s ease,
        margin 0.3s ease, padding 0.3s ease, border-width 0.3s ease;
}

.music-card .aplayer .music-panel-hidden {
    max-height: 0 !important;
    margin-top: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    border-width: 0 !important;
    opacity: 0;
    transform: translateY(-6px);
    pointer-events: none;
}

.music-card .aplayer .aplayer-list ol {
    max-height: 168px;
    padding: 2px 0;
}

.music-card .aplayer .aplayer-list ol li {
    height: 30px;
    line-height: 30px;
    padding: 0 10px;
    border-top: 1px solid var(--hairline);
    color: var(--music-muted);
}

.music-card .aplayer .aplayer-list ol li:first-child {
    border-top: 0;
}

.music-card .aplayer .aplayer-list ol li:hover {
    background: var(--music-control-bg);
}

.music-card .aplayer .aplayer-list ol li.aplayer-list-light {
    background: var(--music-control-bg);
    color: var(--music-text);
}

.music-card .aplayer .aplayer-list ol li .aplayer-list-cur {
    background: var(--purple_text_color);
}

.music-card .aplayer .aplayer-list ol li .aplayer-list-index,
.music-card .aplayer .aplayer-list ol li .aplayer-list-author {
    color: var(--music-muted);
}

.music-card .aplayer .aplayer-list ol::-webkit-scrollbar {
    width: 4px;
}

.music-card .aplayer .aplayer-list ol::-webkit-scrollbar-thumb {
    border-radius: 3px;
    background: var(--music-control-bg);
}

.music-player-status {
    padding: 9px 4px 2px;
    color: var(--music-muted);
    font-size: 12px;
    opacity: 0.75;
}

.music-player-status.is-error {
    color: #ff8c8c;
}'''
src = sub_once(r'\.music-card \{.*?\.music-player-status\.is-error \{\n    color: #ff8c8c;\n\}', music, src, 'music player section')

# ---------- 4. 时间轴与分隔线主题化 ----------
src = sub_once(r'border-left: 2px solid #d5d5d5;', 'border-left: 2px solid var(--hairline);', src, 'timeline border')
src = sub_once(r'\.focus \{\n    width: 8px;\n    height: 8px;\n    border-radius: 22px;\n    background-color: rgb\(255 255 255\);\n    border: 2px solid #fff;',
'''.focus {
    width: 8px;
    height: 8px;
    border-radius: 22px;
    background-color: var(--main_text_color);
    border: 2px solid var(--main_text_color);''', src, 'focus dot')
src = sub_once(r'#line li:first-child \.focus:first-child \{\n    background-color: #aaffcd;',
'''#line li:first-child .focus:first-child {
    background-color: #31c48d;
    border-color: #31c48d;''', src, 'focus first dot')
src = sub_once(r'\.weather-divider \{\n    height: 1px;\n    margin: 14px 0;\n    background: var\(--item_hover_color\);\n\}',
'''.weather-divider {
    height: 1px;
    margin: 14px 0;
    background: var(--hairline);
}''', src, 'weather divider')
src = sub_once(r'    border-top: 1px solid var\(--item_hover_color\);\n    opacity: 1;',
'    border-top: 1px solid var(--hairline);\n    opacity: 1;', src, 'forecast border')

open(path, 'w', encoding='utf-8', newline='').write(src.replace('\n', '\r\n'))
print('style.css part 1 OK, lines:', src.count('\n'))
