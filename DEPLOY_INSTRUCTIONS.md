# Instruksi Deployment (Update CI/CD)

Pembaruan: Sekarang deployment sudah **OTOMATIS** menggunakan GitHub Actions.

## Metode 1: Otomatis (CI/CD) - REKOMENDASI
Setiap kali Anda melakukan push ke branch `main` di GitHub, sistem akan otomatis:
1. Build aplikasi.
2. Upload file ke VPS.

**Syarat:**
- Repository GitHub harus punya Secrets: `HOST`, `USERNAME`, `PASSWORD`.

---

## Metode 2: Manual (Cadangan)
Jika CI/CD macet, gunakan cara manual ini:

### 1. Edit Domain
Buka file `setup_vps.sh` dan ganti baris ini dengan domain asli Anda:
```bash
DOMAIN="portal-mobeng.com" 
```

### 2. Upload ke VPS
Gunakan aplikasi seperti **FileZilla** atau **WinSCP**.
Login ke VPS Anda (IP, Username: root, Password).

1. Upload file `setup_vps.sh` ke folder `/root/`.
2. Upload **isi** dari folder `dist` (index.html, assets, dll) ke folder `/var/www/html/` di VPS.

### 3. Jalankan Script Setup
Login ke VPS via Terminal / PuTTY, lalu jalankan:
```bash
# Beri izin eksekusi
chmod +x setup_vps.sh

# Jalankan script
./setup_vps.sh
```

---

## Post-Install (PENTING)
Setelah website aktif:
1. Buka Website → Login sebagai Admin.
2. Buka **Settings**.
3. Masukkan **Gemini API Key** Anda.
4. Simpan. Key ini akan dipakai oleh semua user.
