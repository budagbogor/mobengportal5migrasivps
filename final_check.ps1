# Final Diagnostic & Fix Script
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  FINAL CHECK & FIREWALL FIX  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# We use ';' instead of '&&' so failure in one command doesn't stop others
$cmds = @(
    "apt update",
    "apt install -y ufw net-tools curl",
    "ufw allow 80/tcp",
    "ufw allow 22/tcp",
    "ufw --force enable",
    "echo '--- LISTENING PORTS (NETSTAT) ---'",
    "netstat -tuln | grep :80",
    "echo '--- NGINX STATUS ---'",
    "systemctl is-active nginx",
    "echo '--- CURL LOCALHOST ---'",
    "curl -I http://127.0.0.1"
)

$full_cmd = $cmds -join " ; "

ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $full_cmd

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  CHECK SELESAI  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Read-Host -Prompt "Tekan Enter untuk keluar"
