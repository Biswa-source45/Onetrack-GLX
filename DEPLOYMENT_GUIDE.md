# Onetrack-GlobX Office Deployment & Auto-CI/CD Guide

This guide provides step-by-step instructions to deploy **Onetrack-GlobX** on an office Windows PC for LAN user access, featuring **zero-window background auto-start** and **100% automated CI/CD using GitHub Actions & Watchtower** (with zero GitHub credentials stored on the office PC).

---

## Architecture & Workflow Overview

```text
[ Developer Laptop ] 
       │
       │  (1) git push origin main
       ▼
[ GitHub Repository ] ──► (2) GitHub Actions builds & pushes images
                                    │
                                    ▼
                     [ GitHub Container Registry (ghcr.io) ]
                                    │
                                    │  (3) Watchtower checks GHCR every 120s
                                    ▼
                      [ Office Host PC (Docker Desktop) ]
                        - Frontend (Port 80)
                        - Backend (Port 8081)
                        - Postgres DB (Port 5433)
                        - Adminer DB GUI (Port 8080)
```

---

## Part 1: Developer Laptop Setup (One-Time)

The GitHub Actions CI/CD workflow is already added at [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml).

### Step 1.1: Push Workflow to GitHub
Run the following commands on your laptop terminal:
```bash
git add .
git commit -m "add github actions CI/CD workflow and watchtower setup"
git push origin main
```

### Step 1.2: Make GitHub Container Registry Packages Public
To allow the host office PC to pull images from `ghcr.io` without requiring any GitHub login:
1. Go to your GitHub repository: [https://github.com/Biswa-source45/Onetrack-GLX](https://github.com/Biswa-source45/Onetrack-GLX)
2. Go to **Actions** tab to confirm the workflow built successfully.
3. On the right side of the main repository page, click on **Packages** (or go to your GitHub profile -> Packages).
4. Click on `onetrack-backend` -> **Package settings** -> Change package visibility to **Public**.
5. Click on `onetrack-frontend` -> **Package settings** -> Change package visibility to **Public**.

*(Once packages are public, any Docker instance can pull updates automatically!)*

---

## Part 2: Office Host PC Setup (Copy & Run Once)

You only need to set up the host office PC **ONCE**. After that, it updates itself automatically whenever you push code from your laptop.

### Step 2.1: Install Docker Desktop on Host PC
1. Download & Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. Enable **WSL 2 backend** during installation.
3. Open Docker Desktop settings:
   - Check **Start Docker Desktop when you log in**.
   - Uncheck "Show splash screen on startup".

### Step 2.2: Copy Project Files to Host PC
Copy the project folder to `C:\Onetrack-GlobX` or `D:\Onetrack-GlobX` on the host PC. 

Only the following files are strictly required on the Host PC:
- `docker-compose.yml`
- `start_onetrack.bat`
- `start_silent.vbs`

### Step 2.3: Configure Silent Auto-Start on System Boot
1. Press `Win + R` on the office PC keyboard.
2. Type `shell:startup` and press **Enter**.
3. Create a **Shortcut** pointing to `D:\Onetrack-GlobX\start_silent.vbs`.
4. Click **Finish**.

Now, whenever the office PC starts, Docker and Onetrack will run **silently in the background with zero CMD pop-up windows** so the office user can work on MS Excel peacefully!

### Step 2.4: Allow Firewall Ports
Open **PowerShell (Run as Administrator)** on the host PC and run:
```powershell
New-NetFirewallRule -DisplayName "Onetrack Web App" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "Onetrack DB GUI" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
```

### Step 2.5: Initial Startup
Double-click `start_silent.vbs` once on the host PC to launch the application stack for the first time.

---

## Part 3: Accessing the Application Across Office LAN

Find the office host PC's IPv4 address using `ipconfig` (e.g., `192.168.1.45`).

### 1. Main Web Application (For All Office Users)
- **URL**: `http://<OFFICE_SERVER_IP>` (e.g. `http://192.168.1.45`)
- Accessible from any phone, laptop, or desktop connected to office Wi-Fi / LAN.

### 2. Database Explorer (Adminer GUI Tool)
- **URL**: `http://<OFFICE_SERVER_IP>:8080` (e.g. `http://192.168.1.45:8080`)
- **System**: PostgreSQL
- **Server**: `postgres`
- **Username**: `postgres`
- **Password**: `postgres`
- **Database**: `onetrack`

---

## Part 4: How Automatic Updates Work (CI/CD)

Whenever you make changes to your codebase on your developer laptop:
1. Make your edits on your laptop.
2. Commit and push:
   ```bash
   git add .
   git commit -m "updated feature X"
   git push origin main
   ```
3. GitHub Actions builds the new Docker images in ~2-3 minutes.
4. **Watchtower** on the office PC detects the new image automatically within 2 minutes and restarts the container gracefully.
5. **No login, no terminal commands, no manual work on the office PC required!**
