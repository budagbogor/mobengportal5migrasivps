# Fix Nginx Config Script
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  FIXING NGINX CONFIGURATION  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Command logic:
# 1. Remove the broken 'portal' config link
# 2. Write correct default config (just in case)
# 3. Enable default config
# 4. Restart Nginx

$config_content = "server { listen 80; server_name _; root /var/www/html; index index.html; location / { try_files `$uri `$uri/ /index.html; } }"

$cmds = @(
    "rm -f /etc/nginx/sites-enabled/portal",
    "echo '$config_content' > /etc/nginx/sites-available/default",
    "ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default",
    "nginx -t",
    "systemctl restart nginx",
    "systemctl status nginx --no-pager"
)

# Join commands with &&
$full_cmd = $cmds -join " && "

Write-Host "Executing fix..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $full_cmd

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  FIX SELESAI!  " -ForegroundColor Green
Write-Host "  Coba akses: http://${server_ip}" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Read-Host -Prompt "Tekan Enter untuk keluar"
