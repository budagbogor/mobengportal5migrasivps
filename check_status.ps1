# Diagnostic Script
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  DIAGNOSA SERVER  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$cmds = @(
    "echo '--- UFW STATUS ---'",
    "ufw status verbose",
    "echo '--- NGINX STATUS ---'",
    "systemctl is-active nginx",
    "echo '--- LISTENING PORTS ---'",
    "ss -tuln | grep :80",
    "echo '--- LOCALHOST TEST ---'",
    "curl -I http://localhost"
)

$full_cmd = $cmds -join " && "

ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $full_cmd

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  DIAGNOSA SELESAI  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Read-Host -Prompt "Tekan Enter untuk keluar"
