# Deploy Script for Mobeng Portal
$user = "root"

# STEP 1: Ask for IP Address
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MOBENG PORTAL - AUTO DEPLOYMENT SYSTEM  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
$server_ip = Read-Host -Prompt 'Masukkan IP Address VPS'

if ([string]::IsNullOrWhiteSpace($server_ip)) {
    Write-Error "IP Address harus diisi!"
    exit 1
}

# STEP 2: Build Project Local
Write-Host "`n[1/4] Building Project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build Gagal. Perbaiki error sebelum deploy."
    exit 1
}

# STEP 3: Setup Server Environment (One-Time)
Write-Host "`n[2/4] Mengirim Script Setup ke Server..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no setup_vps.sh ${user}@${server_ip}:/root/setup_vps.sh

Write-Host "`n[3/4] Menjalankan Script Setup di Server..." -ForegroundColor Yellow
# Memberikan permission execute dan menjalankan script
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} "chmod +x /root/setup_vps.sh && /root/setup_vps.sh"


# STEP 4: Deploy Built Code
Write-Host "`n[4/4] Mengupload Aplikasi ke Server..." -ForegroundColor Yellow
# Hapus folder html lama (bersih-bersih) dan copy yang baru
ssh -o StrictHostKeyChecking=no ${user}@${server_ip} "rm -rf /var/www/html/*"
scp -o StrictHostKeyChecking=no -r dist/* ${user}@${server_ip}:/var/www/html/

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT SELESAI!  " -ForegroundColor Green
Write-Host "  Akses web di: http://${server_ip}" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "Catatan: Password VPS akan diminta beberapa kali untuk keamanan SSH." -ForegroundColor Gray
Read-Host -Prompt "Tekan Enter untuk keluar"
