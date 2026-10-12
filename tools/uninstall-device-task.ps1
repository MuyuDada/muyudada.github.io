# =============================================================================
#  卸载「电脑状态上报」计划任务
#  用法：powershell -ExecutionPolicy Bypass -File tools\uninstall-device-task.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$TaskName = "MuyuDeviceStatusReporter"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "没有找到计划任务 $TaskName，无需卸载。" -ForegroundColor Yellow
    exit 0
}

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false

Write-Host "已卸载计划任务 $TaskName。" -ForegroundColor Green
Write-Host "（上报脚本 tools\report-device.ps1 仍然保留，可手动运行。）"
