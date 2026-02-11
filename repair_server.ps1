# Repair Script for Mobeng Portal
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  PERBAIKAN SERVER (INSTALL NGINX)  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Install Nginx & Firewall
Write-Host "`n[1/3] Menginstall Nginx & Firewall..." -ForegroundColor Yellow
$cmd_install = "apt update && apt install -y nginx && ufw allow 'Nginx Full' && ufw allow OpenSSH && ufw --force enable"
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $cmd_install

# 2. Configure Nginx
Write-Host "`n[2/3] Mengkonfigurasi Nginx..." -ForegroundColor Yellow
$config_content = "server { listen 80; server_name _; root /var/www/html; index index.html; location / { try_files `$uri `$uri/ /index.html; } }"
# Note: Escaped $uri as `$uri for PowerShell to pass it literally.
$cmd_config = "echo '$config_content' > /etc/nginx/sites-available/default && nginx -t && systemctl restart nginx"
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $cmd_config

# 3. Verify
Write-Host "`n[3/3] Verifikasi Status..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} "systemctl status nginx --no-pager"

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  PERBAIKAN SELESAI!  " -ForegroundColor Green
Write-Host "  Silakan refresh browser: http://${server_ip}" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Read-Host -Prompt "Tekan Enter untuk keluar"
