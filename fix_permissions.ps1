# Fix Permissions Script
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  FIXING FILE PERMISSIONS  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$cmds = @(
    "chown -R www-data:www-data /var/www/html",
    "find /var/www/html -type d -exec chmod 755 {} \;",
    "find /var/www/html -type f -exec chmod 644 {} \;",
    "systemctl restart nginx",
    "ls -la /var/www/html/assets | head -n 5"
)

$full_cmd = $cmds -join " && "

ssh -o StrictHostKeyChecking=no ${user}@${server_ip} $full_cmd

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  PERMISSIONS FIXED  " -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Read-Host -Prompt "Tekan Enter untuk keluar"
