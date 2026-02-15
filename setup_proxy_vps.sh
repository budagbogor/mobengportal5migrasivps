#!/bin/bash

# Pastikan script dijalankan sebagai root
if [ "$EUID" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# 1. Update System & Install Curl
echo "Updating system..."
apt update && apt install -y curl

# 2. Install/Update Node.js (v18)
echo "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 3. Install PM2 (Process Manager)
echo "Installing PM2..."
npm install -g pm2

# 4. Configure Nginx as Reverse Proxy
DOMAIN="portal-mobeng.com" 
CONFIG_FILE="/etc/nginx/sites-available/portal"

echo "Updating Nginx configuration for Proxy..."

# Backup existing config
cp $CONFIG_FILE "$CONFIG_FILE.bak"

cat > $CONFIG_FILE <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 5. Enable & Restart Nginx
nginx -t
systemctl restart nginx

echo "SETUP COMPLETE!"
echo "Node.js & PM2 installed."
echo "Nginx configured to proxy to localhost:3000."
