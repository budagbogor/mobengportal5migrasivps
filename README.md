<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Mobeng Portal 5 (VPS Migration)

This is the enhanced version of Mobeng Portal, optimized for VPS deployment with Global AI Key management.

## Key Features
- **Global API Key**: Admin can set the Gemini API Key once in Settings, and it applies to ALL users/candidates automatically.
- **CI/CD Deployment**: Automatic deployment to VPS via GitHub Actions on every push to `main`.
- **System Settings**: Database-backed configuration table (`system_settings`).

## Setup & Deployment

### 1. Database Setup
Run the `fix_api_global.sql` script in your Supabase SQL Editor to create the necessary settings table:
```sql
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);
```

### 2. Global AI Key Configuration
1. Login to the portal as **Admin**.
2. Go to **Settings** (Gear Icon).
3. Input your Gemini API Key.
4. Click **Connect/Save**.
   - *Note: This key is now stored in the database and accessible to all valid users.*

### 3. Automatic Deployment (CI/CD)
This repository is configured with GitHub Actions.
- **Trigger**: Push to `main` branch.
- **Architecture**: Builds the React app and uploads to VPS (`/var/www/html`) via SSH.
- **Secrets Required**: `HOST`, `USERNAME`, `PASSWORD` (Configured in GitHub Repo Settings).

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
