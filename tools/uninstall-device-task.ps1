# =============================================================================
#  卸载「电脑状态上报」计划任务
#  用法：powershell -ExecutionPolicy Bypass -File tools\uninstall-device-task.ps1
#
#  会同时清掉两条自启路径：计划任务 + 启动文件夹里的快捷方式。
# =============================================================================

$ErrorActionPreference = "Stop"
$TaskName = "MuyuDeviceStatusReporter"

# ---- 计划任务 ----
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "已卸载计划任务 $TaskName。" -ForegroundColor Green
} else {
    Write-Host "没有找到计划任务 $TaskName，跳过。" -ForegroundColor Yellow
}

# ---- 启动文件夹里的备用快捷方式 ----
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "MuyuDeviceStatusReporter.lnk"
if (Test-Path -LiteralPath $shortcutPath) {
    Remove-Item -LiteralPath $shortcutPath -Force
    Write-Host "已删除备用自启快捷方式：$shortcutPath" -ForegroundColor Green
} else {
    Write-Host "没有找到备用自启快捷方式，跳过。" -ForegroundColor Yellow
}

# ---- 正在运行的实例 ----
$running = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine -match '-File.*report-device\.ps1'
}
foreach ($p in $running) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "已结束运行中的上报进程 PID $($p.ProcessId)。" -ForegroundColor Green
}

Write-Host ""
Write-Host "（上报脚本 tools\report-device.ps1 仍然保留，可手动运行。）"
