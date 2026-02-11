# Diagnose Paths Script
$user = "root"
$server_ip = "103.185.44.93"

Write-Host "--- CHECKING REMOTE FILES ---"
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} "find /var/www/html -maxdepth 3"
Write-Host "--- END ---"
Read-Host -Prompt "Enter to exit"
