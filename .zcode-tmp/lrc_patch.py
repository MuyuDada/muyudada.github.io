# -*- coding: utf-8 -*-
import re

def sub_once(pattern, repl, text, label, flags=re.S):
    new, n = re.subn(pattern, repl, text, count=1, flags=flags)
    assert n == 1, 'NO MATCH: ' + label
    return new

# ---------- style.css：歌词面板不再依赖 JS 移动才显示 ----------
path = 'static/css/style.css'
css = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

css = sub_once(r'/\* 歌词面板会被 script\.js 移到 \.music-panels 里再显示 \*/\n\.music-card \.aplayer \.aplayer-info \.aplayer-lrc \{\n    display: none;\n\}\n\n', '', css, 'hide lrc in info')

css = sub_once(r'/\* 歌词 / 播放列表面板（script\.js 会移动到 \.music-panels 内） \*/\n\.music-card \.aplayer \.music-panels \{\n    margin-top: 10px;\n\}\n\n\.music-card \.aplayer \.music-panels > \.aplayer-lrc \{\n    display: block !important;\n    position: relative;\n    height: 68px;\n    margin: 0;\n    padding: 8px 12px;\n    border: 1px solid var\(--hairline\);\n    border-radius: 10px;\n    background: var\(--music-panel-bg\);\n    text-align: center;\n\}\n\n\.music-card \.aplayer \.music-panels > \.aplayer-lrc::before,\n\.music-card \.aplayer \.music-panels > \.aplayer-lrc::after \{\n    display: none;\n\}\n',
'''/* 歌词面板：script.js 会把它移动到 .music-panels 内，未移动时同样正常渲染 */
.music-card .aplayer .aplayer-lrc {
    display: block;
    position: relative;
    height: 68px;
    max-height: 68px;
    margin: 8px 0 0;
    padding: 8px 12px;
    border: 1px solid var(--hairline);
    border-radius: 10px;
    background: var(--music-panel-bg);
    text-align: center;
}

.music-card .aplayer .music-panels {
    margin-top: 10px;
}

.music-card .aplayer .music-panels > .aplayer-lrc {
    display: block !important;
    margin: 0;
}

.music-card .aplayer .aplayer-lrc::before,
.music-card .aplayer .aplayer-lrc::after {
    display: none;
}
''', css, 'lrc panel generic')

css = sub_once(r'\.music-card \.aplayer \.music-panels > \.aplayer-lrc,\n\.music-card \.aplayer \.music-panels > \.aplayer-list \{',
'.music-card .aplayer .aplayer-lrc,\n.music-card .aplayer .music-panels > .aplayer-list {', css, 'lrc transition scope')

open(path, 'w', encoding='utf-8', newline='').write(css.replace('\n', '\r\n'))
print('style.css lrc fix OK')

# ---------- script.js：播放器创建后立即初始化面板，并轮询兜底 ----------
path = 'static/js/script.js'
js = open(path, encoding='utf-8', newline='').read().replace('\r\n', '\n')

# 1) 播放器构建成功后立刻初始化面板
js = sub_once(r'            statusElement\.remove\(\);\n        \}\)',
'''            statusElement.remove();
            initializeMusicPanels();
        })''', js, 'init panels after player created')

# 2) initializeMusicPanels 返回是否就绪，未就绪时稍后重试
js = sub_once(r'''    if \(!container \|\| !lyricPanel \|\| !listPanel \|\| !lyricButton \|\| !listButton \|\|
        container\.dataset\.panelsReady === "true"\) \{
        return;
    \}''',
'''    if (!container || container.dataset.panelsReady === "true") {
        return Boolean(container);
    }
    if (!lyricPanel || !listPanel || !lyricButton || !listButton) {
        return false;
    }''', js, 'panels guard returns status')

js = sub_once(r'    lyricPanel\.classList\.add\("music-panel-hidden"\);\n    listPanel\.classList\.add\("music-panel-hidden"\);\n    container\.dataset\.panelsReady = "true";',
'''    lyricPanel.classList.add("music-panel-hidden");
    listPanel.classList.add("music-panel-hidden");
    container.dataset.panelsReady = "true";''', js, 'probe markers')

# 在函数体末尾（点击监听器之后）返回 true
js = sub_once(r'''    \}, true\);
\}

window\.setTimeout\(initializeMusicPanels, 300\);
window\.setTimeout\(initializeMusicPanels, 1000\);''',
'''    }, true);

    return true;
}

var musicPanelsRetries = 0;
window.setTimeout(function pollMusicPanels() {
    musicPanelsRetries += 1;
    if (initializeMusicPanels() || musicPanelsRetries > 50) {
        return;
    }
    window.setTimeout(pollMusicPanels, 400);
}, 300);''', js, 'poll replace')

open(path, 'w', encoding='utf-8', newline='').write(js.replace('\n', '\r\n'))
print('script.js lrc fix OK')
