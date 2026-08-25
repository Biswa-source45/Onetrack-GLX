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
- `HOST_START.bat`
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

---

## Part 5: Troubleshooting — Auto-Pull Not Working

If the office PC isn't picking up new images on its own, check these in order:

1. **GHCR package visibility (the #1 cause).** `docker compose pull` and Watchtower both pull `ghcr.io/.../onetrack-backend:latest` and `onetrack-frontend:latest` **anonymously** — no credentials are stored on the office PC. If either GitHub package ever reverts to Private (this can happen silently, e.g. if a new package version is published or repo visibility changes), every pull attempt fails with an auth error. Re-check both packages under **Packages → package settings → Danger Zone → Change visibility** and confirm both are **Public** — this is the single most common reason auto-update silently stops working.
2. **Failures are invisible by design.** `start_silent.vbs` launches `HOST_START.bat` with window style `0` (fully hidden, no console ever shown), and the batch script doesn't check the exit code of `docker compose pull` before running `docker compose up -d` — so if a pull fails (auth error, network blip, corporate proxy blocking `ghcr.io`), the stack just keeps quietly running the **old** images with zero visible error. To diagnose, redirect output to a log file, e.g. change the two `docker compose pull` / `docker compose up -d --remove-orphans` lines in `HOST_START.bat` to append `>> onetrack_sync.log 2>&1`, then check that file after a push.
3. **Two independent update loops exist**: Watchtower (60s poll interval, in `docker-compose.yml`) and `HOST_START.bat`'s own 30-minute loop. Either one succeeding is enough — if both are failing, it's almost certainly cause #1 above, not a bug in either mechanism.

### Does an image update ever wipe the database?
**No.** Postgres data lives in the named Docker volume `postgres_data` (declared at the bottom of `docker-compose.yml`, mounted at `/var/lib/postgresql/data`). `docker compose pull`, `docker compose up -d`, and Watchtower's container recreation only ever touch the `backend`/`frontend` **containers and images** — none of them reference or remove volumes. Your data is completely decoupled from every code deployment, past and future.

### Full clean reset (wipe DB, keep only Super Admin)
The only way to clear the database is to explicitly remove that volume. On the office PC, in the project folder:
```powershell
docker compose down -v      # stops everything AND deletes the postgres_data volume
docker compose pull         # get the latest images
docker compose up -d --remove-orphans
```
(`down -v` only removes volumes declared in this compose file — safe to run without knowing the exact auto-generated volume name.)

On the next boot, the backend runs **every migration from scratch** against the empty database (`backend/migrations/migrations.go`), which includes `000017_purge_all_tenders_and_users_except_sadmin.up.sql` — so the end state is guaranteed to be zero tenders, zero bids, zero alerts, and no leftover users. After migrations finish, `EnsureDefaultAdmin` runs unconditionally on every boot and guarantees a working login:
- **Email:** `biswabhusans@globx.co.in`
- **Password:** `Admin@123`

This account lands with the `SUPER_ADMIN` role. **Change this password immediately after logging in** — it's a fixed value baked into the source code, so anyone with repo access knows it. Any other real team accounts (Pre-Sales, Finance, Manager, Bid Executive users) were created live through the app's Admin panel, not by a migration — a DB wipe deletes them permanently, and they'll need to be recreated manually after logging in as Super Admin.

### "502 Bad Gateway" on everything right after `down -v` / a fresh volume
This was a real bug, now fixed. On a brand-new Postgres volume, Postgres runs `initdb` and briefly stops/restarts itself internally before it actually accepts connections — that can take longer than the backend previously waited for. The backend used to ping the database exactly once and immediately exit if that failed, and `docker-compose.yml`'s `depends_on` only waited for the Postgres *container* to start, not for it to actually be ready — so the backend crashed before Postgres was reachable, and nginx in the frontend container had nothing to proxy to (hence every `/api/v1/...` call returning an HTML 502 page instead of JSON).

Fixed in both places:
- `docker-compose.yml` now has real healthchecks on `postgres` (`pg_isready`) and `redis` (`redis-cli ping`), and `backend` only starts once both report healthy (`depends_on: condition: service_healthy`); `frontend` in turn waits for `backend`'s own healthcheck (`/health`).
- The backend's DB connection code (`internal/platform/database/postgres.go`) now retries for up to a minute instead of exiting on the first failed ping, as a second layer of protection.

This means after the next image rebuild, a fresh `docker compose down -v && docker compose pull && docker compose up -d` will make Compose actually wait for Postgres before starting the backend, instead of racing it.
