# =============================================================================
#  Muyu 主页 · 电脑状态上报脚本
# -----------------------------------------------------------------------------
#  每 30 秒把「当前前台应用 + 在线状态」POST 到 Cloudflare Worker。
#
#  用法：
#    powershell -ExecutionPolicy Bypass -File tools\report-device.ps1          # 常驻循环
#    powershell -ExecutionPolicy Bypass -File tools\report-device.ps1 -Once    # 只上报一次
#
#  配置：把下面的 $Endpoint 换成你的 Worker 地址；口令写进 tools\report-token.local
#        （已被 .gitignore 忽略）或设置环境变量 MUYU_REPORT_TOKEN，不要写进本脚本。
# =============================================================================

param(
    [switch]$Once,
    [int]$IntervalSeconds = 30
)

# --------------------------- 需要配置的地址与口令 ---------------------------
# Worker 的上报地址（部署后把子域换成你自己的）
$Endpoint = "https://muyu-device-status.2756390658.workers.dev/api/device/report"

# 上报口令：必须与 Worker 的 REPORT_TOKEN 一致。
# 这个仓库是公开的，所以口令不要写死在这里，按下面的顺序查找：
#   1) 环境变量 MUYU_REPORT_TOKEN
#   2) 同目录下的 report-token.local（已在 .gitignore 中忽略）
#   3) 下面的 $Token 兜底（留空即可，仅在本地临时调试时填）
$Token = ""
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

# 从环境变量或本地文件补齐口令，避免把密钥提交到公开仓库
if ([string]::IsNullOrWhiteSpace($Token)) {
    if (-not [string]::IsNullOrWhiteSpace($env:MUYU_REPORT_TOKEN)) {
        $Token = $env:MUYU_REPORT_TOKEN.Trim()
    } else {
        $tokenFile = Join-Path $PSScriptRoot "report-token.local"
        if (Test-Path $tokenFile) {
            $Token = (Get-Content $tokenFile -Raw -Encoding UTF8).Trim()
        }
    }
}

# 判空：没配好就直接退出，避免空转
if ([string]::IsNullOrWhiteSpace($Endpoint) -or $Endpoint -match "YOUR-SUBDOMAIN" -or [string]::IsNullOrWhiteSpace($Token)) {
    Write-Host "请先配置上报地址与口令：" -ForegroundColor Red
    Write-Host "  1. 把本脚本顶部的 `$Endpoint 换成你的 Worker 地址" -ForegroundColor Red
    Write-Host "  2. 把口令写进 tools\report-token.local（已被 .gitignore 忽略）" -ForegroundColor Red
    Write-Host "     或设置环境变量 MUYU_REPORT_TOKEN" -ForegroundColor Red
    exit 1
}

# =============================================================================
#  一、Win32 互操作：取前台窗口 + 空闲时长
# =============================================================================
if (-not ("MuyuWin32" -as [type])) {
    Add-Type -Namespace MuyuWin32 -Name Native -MemberDefinition @"
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [StructLayout(LayoutKind.Sequential)]
    public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
"@
}

function Get-ForegroundWindowInfo {
    <#
      返回 @{ ProcessName; Title; IdleSeconds }
      锁屏 / 无前台窗口时 ProcessName 为空。
    #>
    $hwnd = [MuyuWin32.Native]::GetForegroundWindow()

    $procName = ""
    $title = ""

    if ($hwnd -ne [IntPtr]::Zero) {
        $len = [MuyuWin32.Native]::GetWindowTextLength($hwnd)
        if ($len -gt 0) {
            $sb = New-Object System.Text.StringBuilder ($len + 2)
            [void][MuyuWin32.Native]::GetWindowText($hwnd, $sb, $sb.Capacity)
            $title = $sb.ToString()
        }

        # 注意：变量不能叫 $pid，那是 PowerShell 的只读自动变量
        $ownerPid = 0
        [void][MuyuWin32.Native]::GetWindowThreadProcessId($hwnd, [ref]$ownerPid)
        if ($ownerPid -gt 0) {
            try {
                $procName = (Get-Process -Id $ownerPid -ErrorAction Stop).ProcessName
            } catch {
                $procName = ""
            }
        }
    }

    # 空闲时长：最后一次键鼠输入距今多少秒
    $idleSeconds = 0
    try {
        $info = New-Object MuyuWin32.Native+LASTINPUTINFO
        $info.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($info)
        if ([MuyuWin32.Native]::GetLastInputInfo([ref]$info)) {
            $idleMs = [Environment]::TickCount - $info.dwTime
            if ($idleMs -gt 0) { $idleSeconds = [int]($idleMs / 1000) }
        }
    } catch {
        $idleSeconds = 0
    }

    return @{
        ProcessName = $procName
        Title       = $title
        IdleSeconds = $idleSeconds
    }
}

# =============================================================================
#  二、应用名映射：进程名 → 中文名 + 吐槽文案
#      （参考 tonks.top 的做法，让状态卡有「人味」）
# =============================================================================
$AppMap = @{
    # ---- 编辑器 / 开发 ----
    "code"              = @{ Name = "VSCode 编辑器"; Quip = "正在写代码，也可能在看 AI 写代码。" }
    "code - insiders"   = @{ Name = "VSCode 预览版"; Quip = "追新版本中，随时可能炸。" }
    "cursor"            = @{ Name = "Cursor"; Quip = "在指挥 AI 写代码。" }
    "devenv"            = @{ Name = "Visual Studio"; Quip = "在开大工程，编译要等一会儿。" }
    "idea64"            = @{ Name = "IntelliJ IDEA"; Quip = "在写 Java，或者在等索引。" }
    "pycharm64"         = @{ Name = "PyCharm"; Quip = "在写 Python。" }
    "webstorm64"        = @{ Name = "WebStorm"; Quip = "在写前端。" }
    "goland64"          = @{ Name = "GoLand"; Quip = "在写 Go。" }
    "rider64"           = @{ Name = "Rider"; Quip = "在写 C#。" }
    "sublime_text"      = @{ Name = "Sublime Text"; Quip = "轻量编辑器，启动就是快。" }
    "notepad++"         = @{ Name = "Notepad++"; Quip = "在改点什么小文件。" }
    "notepad"           = @{ Name = "记事本"; Quip = "在用最朴素的工具。" }
    "windowsterminal"   = @{ Name = "Windows 终端"; Quip = "很有可能在 Vibe coding。" }
    "wt"                = @{ Name = "Windows 终端"; Quip = "很有可能在 Vibe coding。" }
    "powershell"        = @{ Name = "PowerShell"; Quip = "在敲命令。" }
    "pwsh"              = @{ Name = "PowerShell"; Quip = "在敲命令。" }
    "cmd"               = @{ Name = "命令提示符"; Quip = "在敲命令。" }
    "conhost"           = @{ Name = "控制台窗口"; Quip = "在敲命令。" }
    "git-bash"          = @{ Name = "Git Bash"; Quip = "在敲 Git 命令。" }
    "mintty"            = @{ Name = "Git Bash"; Quip = "在敲 Git 命令。" }
    "wsl"               = @{ Name = "WSL"; Quip = "在 Linux 子系统里折腾。" }

    # ---- 浏览器 ----
    "chrome"            = @{ Name = "Chrome"; Quip = "在浏览器里冲浪。" }
    "msedge"            = @{ Name = "Edge"; Quip = "在浏览器里冲浪。" }
    "firefox"           = @{ Name = "Firefox"; Quip = "在浏览器里冲浪。" }
    "brave"             = @{ Name = "Brave"; Quip = "在浏览器里冲浪。" }
    "opera"             = @{ Name = "Opera"; Quip = "在浏览器里冲浪。" }
    "360se"             = @{ Name = "360 浏览器"; Quip = "在浏览器里冲浪。" }
    "360chrome"         = @{ Name = "360 极速浏览器"; Quip = "在浏览器里冲浪。" }

    # ---- 聊天 / 社交 ----
    "wechat"            = @{ Name = "微信"; Quip = "与朋友畅聊中……" }
    "weixin"            = @{ Name = "微信"; Quip = "与朋友畅聊中……" }
    "qq"                = @{ Name = "QQ"; Quip = "在水群。" }
    "tim"               = @{ Name = "TIM"; Quip = "在办公聊天。" }
    "dingtalk"          = @{ Name = "钉钉"; Quip = "在办公。" }
    "wework"            = @{ Name = "企业微信"; Quip = "在办公。" }
    "telegram"          = @{ Name = "Telegram"; Quip = "在刷频道。" }
    "discord"           = @{ Name = "Discord"; Quip = "在语音频道里。" }
    "feishu"            = @{ Name = "飞书"; Quip = "在办公。" }
    "lark"              = @{ Name = "飞书"; Quip = "在办公。" }

    # ---- 媒体 / 娱乐 ----
    "cloudmusic"        = @{ Name = "网易云音乐"; Quip = "在听歌。" }
    "qqmusic"           = @{ Name = "QQ 音乐"; Quip = "在听歌。" }
    "spotify"           = @{ Name = "Spotify"; Quip = "在听歌。" }
    "potplayer"         = @{ Name = "PotPlayer"; Quip = "在看视频。" }
    "potplayermini64"   = @{ Name = "PotPlayer"; Quip = "在看视频。" }
    "vlc"               = @{ Name = "VLC"; Quip = "在看视频。" }
    "mpv"               = @{ Name = "mpv"; Quip = "在看视频。" }
    "bilibili"          = @{ Name = "哔哩哔哩"; Quip = "在 B 站冲浪。" }
    "steam"             = @{ Name = "Steam"; Quip = "在逛商店。" }
    "steamwebhelper"    = @{ Name = "Steam"; Quip = "在逛商店。" }
    "epicgameslauncher" = @{ Name = "Epic 启动器"; Quip = "在领免费游戏。" }
    "genshinimpact"     = @{ Name = "原神"; Quip = "在提瓦特。" }
    "yuanshen"          = @{ Name = "原神"; Quip = "在提瓦特。" }
    "starrail"          = @{ Name = "崩坏：星穹铁道"; Quip = "在银河里。" }
    "dota2"             = @{ Name = "DOTA2"; Quip = "在打 DOTA。" }
    "cs2"               = @{ Name = "CS2"; Quip = "在打枪。" }
    "league of legends" = @{ Name = "英雄联盟"; Quip = "在打排位。" }
    "tslgame"           = @{ Name = "绝地求生"; Quip = "在吃鸡。" }

    # ---- 办公 / 学习 ----
    "winword"           = @{ Name = "Word"; Quip = "在写文档。" }
    "excel"             = @{ Name = "Excel 表格"; Quip = "正在成为数据分析师！" }
    "powerpnt"          = @{ Name = "PowerPoint"; Quip = "在做 PPT。" }
    "onenote"           = @{ Name = "OneNote"; Quip = "在记笔记。" }
    "wps"               = @{ Name = "WPS"; Quip = "在办公。" }
    "et"                = @{ Name = "WPS 表格"; Quip = "正在成为数据分析师！" }
    "wpp"               = @{ Name = "WPS 演示"; Quip = "在做 PPT。" }
    "acrobat"           = @{ Name = "Acrobat"; Quip = "在看 PDF。" }
    "acrord32"          = @{ Name = "Acrobat Reader"; Quip = "在看 PDF。" }
    "sumatrapdf"        = @{ Name = "SumatraPDF"; Quip = "在看 PDF。" }
    "obsidian"          = @{ Name = "Obsidian"; Quip = "在整理知识库。" }
    "typora"            = @{ Name = "Typora"; Quip = "在写 Markdown。" }
    "zotero"            = @{ Name = "Zotero"; Quip = "在整理文献。" }

    # ---- 设计 / 创作 ----
    "photoshop"         = @{ Name = "Photoshop"; Quip = "在修图。" }
    "illustrator"       = @{ Name = "Illustrator"; Quip = "在画矢量图。" }
    "figma"             = @{ Name = "Figma"; Quip = "在设计界面。" }
    "blender"           = @{ Name = "Blender"; Quip = "在建 3D 模型。" }
    "premiere"          = @{ Name = "Premiere"; Quip = "在剪视频。" }
    "afterfx"           = @{ Name = "After Effects"; Quip = "在做特效。" }
    "obs64"             = @{ Name = "OBS Studio"; Quip = "在录屏或直播。" }
    "snippingtool"      = @{ Name = "截图工具"; Quip = "在截图。" }

    # ---- 系统 / 工具 ----
    "explorer"          = @{ Name = "文件资源管理器"; Quip = "在整理文件。" }
    "taskmgr"           = @{ Name = "任务管理器"; Quip = "在找哪个进程吃内存。" }
    "regedit"           = @{ Name = "注册表编辑器"; Quip = "在动注册表，小心。" }
    "mmc"               = @{ Name = "管理控制台"; Quip = "在配置系统。" }
    "filezilla"         = @{ Name = "FileZilla"; Quip = "正在管理服务器文件，可能是在更新网站。" }
    "winscp"            = @{ Name = "WinSCP"; Quip = "在传文件到服务器。" }
    "putty"             = @{ Name = "PuTTY"; Quip = "在连服务器。" }
    "mobaxterm"         = @{ Name = "MobaXterm"; Quip = "在连服务器。" }
    "xshell"            = @{ Name = "Xshell"; Quip = "在连服务器。" }
    "idman"             = @{ Name = "IDM"; Quip = "在下载东西。" }
    "thunder"           = @{ Name = "迅雷"; Quip = "在下载东西。" }
    "qbittorrent"       = @{ Name = "qBittorrent"; Quip = "在做种。" }
    "motrix"            = @{ Name = "Motrix"; Quip = "在下载东西。" }
    "clash"             = @{ Name = "Clash"; Quip = "在调网络。" }
    "clash-verge"       = @{ Name = "Clash Verge"; Quip = "在调网络。" }
    "v2rayn"            = @{ Name = "v2rayN"; Quip = "在调网络。" }
    "openlist"          = @{ Name = "OpenList"; Quip = "在管理网盘。" }
    "alist"             = @{ Name = "AList"; Quip = "在管理网盘。" }
    "everything"        = @{ Name = "Everything"; Quip = "在找文件。" }
    "7zfm"              = @{ Name = "7-Zip"; Quip = "在解压。" }
    "winrar"            = @{ Name = "WinRAR"; Quip = "在解压。" }
    "bandizip"          = @{ Name = "Bandizip"; Quip = "在解压。" }
}

function Get-AppDisplay {
    param([string]$ProcessName)
    $key = $ProcessName.ToLowerInvariant()
    if ($AppMap.ContainsKey($key)) { return $AppMap[$key] }
    return $null
}

# 兜底：没有映射时，从窗口标题里猜类别
function Get-CategoryFromTitle {
    param([string]$Title)
    if ([string]::IsNullOrWhiteSpace($Title)) { return $null }
    if ($Title -match "QQ音乐|QQ 音乐|网易云|Spotify|酷狗|酷我") { return @{ Name = "音乐播放器"; Quip = "在听歌。" } }
    if ($Title -match "Chrome|Edge|Firefox|浏览器") { return @{ Name = "浏览器"; Quip = "在浏览器里冲浪。" } }
    if ($Title -match "Visual Studio|VSCode|PyCharm|IDEA|编辑器") { return @{ Name = "代码编辑器"; Quip = "在写代码。" } }
    if ($Title -match "Photoshop|Illustrator|Figma") { return @{ Name = "设计工具"; Quip = "在做设计。" } }
    if ($Title -match "Excel|表格|Word|文档") { return @{ Name = "办公软件"; Quip = "在办公。" } }
    return $null
}

# =============================================================================
#  三、组装并上报一条状态
# =============================================================================
function Send-DeviceStatus {
    $fg = Get-ForegroundWindowInfo

    # 状态判定：无前台窗口 → 锁屏；空闲超 5 分钟 → 离开
    if ([string]::IsNullOrWhiteSpace($fg.ProcessName)) {
        $state = "locked"
        $appName = "已锁屏"
        $quip = "电脑锁屏了，人不在跟前。"
    } elseif ($fg.IdleSeconds -gt 300) {
        $state = "away"
        $mapped = Get-AppDisplay -ProcessName $fg.ProcessName
        $appName = if ($mapped) { $mapped.Name } else { $fg.ProcessName }
        $quip = "已经 " + [int]($fg.IdleSeconds / 60) + " 分钟没有操作了。"
    } else {
        $state = "online"
        $mapped = Get-AppDisplay -ProcessName $fg.ProcessName
        if ($mapped) {
            $appName = $mapped.Name
            $quip = $mapped.Quip
        } else {
            $fallback = Get-CategoryFromTitle -Title $fg.Title
            if ($fallback) {
                $appName = $fallback.Name
                $quip = $fallback.Quip
            } else {
                $appName = $fg.ProcessName
                $quip = "在使用一个没登记过的应用。"
            }
        }
    }

    # 标题里去掉应用名后缀，避免和 appName 重复（"xxx - Visual Studio Code"）
    $cleanTitle = $fg.Title
    if ($cleanTitle) {
        $cleanTitle = $cleanTitle -replace "\s*[-–—]\s*(Visual Studio Code|Visual Studio|Google Chrome|Microsoft Edge|Firefox|Notepad\+\+)\s*$", ""
        $cleanTitle = $cleanTitle.Trim()
    }

    $payload = @{
        state       = $state
        app         = $appName
        process     = $fg.ProcessName   # 原始进程名，前端据此选图标
        quip        = $quip             # 吐槽文案，前端直接展示
        title       = $cleanTitle
        idleSeconds = $fg.IdleSeconds
        host        = $env:COMPUTERNAME
    } | ConvertTo-Json -Compress

    try {
        $response = Invoke-RestMethod -Uri $Endpoint -Method Post `
            -Headers @{ "X-Report-Token" = $Token } `
            -ContentType "application/json; charset=utf-8" `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) `
            -TimeoutSec 15

        if ($response.success) {
            Write-Host ("[{0}] 已上报: {1} / {2}" -f (Get-Date -Format "HH:mm:ss"), $state, $appName) -ForegroundColor Green
        } else {
            Write-Host ("[{0}] 上报被拒绝: {1}" -f (Get-Date -Format "HH:mm:ss"), ($response | ConvertTo-Json -Compress)) -ForegroundColor Yellow
        }
    } catch {
        Write-Host ("[{0}] 上报失败: {1}" -f (Get-Date -Format "HH:mm:ss"), $_.Exception.Message) -ForegroundColor Red
    }
}

# =============================================================================
#  四、入口
# =============================================================================
if ($Once) {
    Send-DeviceStatus
    exit 0
}

Write-Host "电脑状态上报已启动，间隔 ${IntervalSeconds}s。按 Ctrl+C 停止。" -ForegroundColor Cyan
while ($true) {
    Send-DeviceStatus
    Start-Sleep -Seconds $IntervalSeconds
}
