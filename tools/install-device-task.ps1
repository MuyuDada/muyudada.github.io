# =============================================================================
#  注册「电脑状态上报」计划任务
# -----------------------------------------------------------------------------
#  登录时自动启动 tools/report-device.ps1，后台常驻、无窗口。
#
#  用法：powershell -ExecutionPolicy Bypass -File tools\install-device-task.ps1
#  卸载：powershell -ExecutionPolicy Bypass -File tools\uninstall-device-task.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$TaskName   = "MuyuDeviceStatusReporter"
$ScriptPath = Join-Path $PSScriptRoot "report-device.ps1"

if (-not (Test-Path -LiteralPath $ScriptPath)) {
    Write-Host "找不到上报脚本：$ScriptPath" -ForegroundColor Red
    exit 1
}

# 检查脚本里的配置是否已填。
# 注意：不能直接在脚本文本里搜 "YOUR-SUBDOMAIN"，因为 report-device.ps1 的判空
# 逻辑本身就含这个字符串。改成解析出 $Endpoint 的实际取值来判断。
$scriptText = Get-Content -LiteralPath $ScriptPath -Raw
$endpointMatch = [regex]::Match($scriptText, '(?m)^\s*\$Endpoint\s*=\s*"([^"]*)"')
$endpointValue = if ($endpointMatch.Success) { $endpointMatch.Groups[1].Value } else { "" }

$tokenFile = Join-Path $PSScriptRoot "report-token.local"
$hasTokenFile = (Test-Path -LiteralPath $tokenFile) -and
                -not [string]::IsNullOrWhiteSpace((Get-Content -LiteralPath $tokenFile -Raw))

if ([string]::IsNullOrWhiteSpace($endpointValue) -or $endpointValue -match "YOUR-SUBDOMAIN") {
    Write-Host "请先在 tools\report-device.ps1 顶部填写 `$Endpoint（Worker 上报地址）后再安装。" -ForegroundColor Red
    exit 1
}

if (-not $hasTokenFile -and [string]::IsNullOrWhiteSpace($env:MUYU_REPORT_TOKEN)) {
    Write-Host "找不到上报口令：请把口令写进 tools\report-token.local，或设置环境变量 MUYU_REPORT_TOKEN。" -ForegroundColor Red
    exit 1
}

# 已存在则先删掉，保证幂等
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "检测到同名任务，先移除旧的……" -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

# 登录时触发，并保持无限时长。
# 必须显式带上 -User：不带的话该触发器属于「任意用户登录」，注册需要管理员权限，
# 普通账户会直接报 Access is denied（0x80070005）。带上当前用户后普通账户即可注册。
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# 以当前用户身份运行，交互式（能读到前台窗口）
$principal = New-ScheduledTaskPrincipal `
    -UserId $CurrentUser `
    -LogonType Interactive `
    -RunLevel Limited

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "每 30 秒把本机前台应用状态上报到 Cloudflare Worker，供个人主页展示。" | Out-Null

# -----------------------------------------------------------------------------
# 备用自启：启动文件夹里放一个快捷方式
#
# 计划任务曾经在没有任何征兆的情况下凭空消失过一次（Tasks 目录下文件没了，
# 上报静默中断两小时）。再加一条完全独立的自启路径作为兜底：
# 就算计划任务再次被清掉，登录时照样能起来。
#
# 两条路径同时生效不会重复上报 —— report-device.ps1 里有命名互斥体，
# 后来的实例会立刻退出。
# -----------------------------------------------------------------------------
$startupDir = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupDir "MuyuDeviceStatusReporter.lnk"
try {
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($shortcutPath)
    $lnk.TargetPath = "powershell.exe"
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""
    $lnk.WorkingDirectory = $PSScriptRoot
    $lnk.WindowStyle = 7
    $lnk.Description = "电脑状态上报（备用自启）"
    $lnk.Save()
    Write-Host "已创建备用自启快捷方式：$shortcutPath" -ForegroundColor Green
} catch {
    Write-Host "创建备用自启快捷方式失败（不影响计划任务）：$($_.Exception.Message)" -ForegroundColor Yellow
}

# 立即启动一次，不用等下次登录
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 2
$info = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo

Write-Host ""
Write-Host "已安装计划任务：$TaskName" -ForegroundColor Green
Write-Host "  脚本    : $ScriptPath"
Write-Host "  触发    : 登录时"
Write-Host "  上次结果: $($info.LastTaskResult)  (0 表示成功)"
Write-Host ""
Write-Host "查看状态 : Get-ScheduledTaskInfo -TaskName $TaskName"
Write-Host "停止任务 : Stop-ScheduledTask -TaskName $TaskName"
Write-Host "卸载     : powershell -ExecutionPolicy Bypass -File tools\uninstall-device-task.ps1"
