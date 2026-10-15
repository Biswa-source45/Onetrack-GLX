@echo off
TITLE OneTrack Enterprise System Launcher & Auto-Sync
COLOR 0A
cd /d "%~dp0"

:: Where the host fetches the latest docker-compose.yml from (public repo, no git
:: needed on this PC). Every release that changes volumes or settings reaches this
:: machine on its next sync, without anyone copying files by hand.
set "COMPOSE_URL=https://raw.githubusercontent.com/Biswa-source45/Onetrack-GLX/main/docker-compose.yml"

echo =======================================================
echo   OneTrack Enterprise Host System Launcher
echo =======================================================
echo.

:: 1. Verify Docker Engine is active, if not start Docker Desktop
echo [1/4] Checking Docker Engine daemon status...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Docker daemon is not running. Starting Docker Desktop...
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    ) else (
        echo WARNING: Docker Desktop executable not found at default location.
    )

    echo Waiting for Docker Engine to initialize...
    :WAIT_DOCKER
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo   Still initializing Docker...
        goto WAIT_DOCKER
    )
    echo Docker Engine is now ONLINE!
) else (
    echo Docker Engine is ONLINE!
)

:: 2. Allow Windows Firewall Port 80 and 8081 silently
echo [2/4] Ensuring Firewall inbound rules for Port 80 and 8081...
powershell -Command "if (-not (Get-NetFirewallRule -DisplayName 'Onetrack Web Port 80' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'Onetrack Web Port 80' -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow | Out-Null }" >nul 2>&1
powershell -Command "if (-not (Get-NetFirewallRule -DisplayName 'Onetrack API Port 8081' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'Onetrack API Port 8081' -Direction Inbound -LocalPort 8081 -Protocol TCP -Action Allow | Out-Null }" >nul 2>&1

:: 3. Refresh docker-compose.yml, make sure the upload folders exist, pull the
::    latest containers and launch the compose stack (see :SYNC below)
echo [3/4] Syncing configuration, pulling latest containers and starting services...
call :SYNC

:: 4. Detect this machine's LAN IP instead of a hardcoded address, so this
::    banner is correct on whichever PC actually runs it. (On a multi-adapter
::    PC this picks whichever IPv4 line ipconfig lists last - fine for the
::    single-NIC office-PC case this script targets; check ipconfig by hand
::    if this machine has more than one active adapter.)
set "LOCAL_IP="
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do set "LOCAL_IP=%%a"
set "LOCAL_IP=%LOCAL_IP: =%"
if not defined LOCAL_IP set "LOCAL_IP=<check ipconfig>"

echo.
echo =======================================================
echo  SUCCESS! ONETRACK ENTERPRISE IS LIVE ON LOCAL NETWORK
echo =======================================================
echo   Local LAN Access URL : http://%LOCAL_IP%
echo   Frontend Web Server  : Port 80  (ACTIVE)
echo   Backend API Server   : Port 8081 (ACTIVE)
echo   Watchtower Auto-Sync : RUNNING (Checking GHCR updates)
echo   Sync log             : %~dp0onetrack_sync.log
echo =======================================================
echo.

:AUTO_SYNC_LOOP
echo [%DATE% %TIME%] Auto-sync daemon active. Waiting 30 mins for next check... >> onetrack_sync.log
timeout /t 1800 /nobreak >nul
echo [%DATE% %TIME%] Syncing configuration and pulling latest container updates... >> onetrack_sync.log
call :SYNC
goto AUTO_SYNC_LOOP


:: ---------------------------------------------------------------------------
:: :SYNC  config refresh -> upload folders -> pull -> up
:: Safe to run any number of times. Never touches the database volume or the
:: files already inside the *-assets folders.
:: ---------------------------------------------------------------------------
:SYNC
:: a) Fetch the latest docker-compose.yml. It replaces the current one only if
::    the download worked AND it is a valid compose file that differs from the
::    current one; the old copy is kept as docker-compose.yml.bak. Any failure
::    (offline, GitHub down) just keeps the current file.
del docker-compose.yml.new >nul 2>&1
curl.exe -fsSL --max-time 30 -o docker-compose.yml.new "%COMPOSE_URL%" >nul 2>&1
if errorlevel 1 goto SYNC_FETCH_FAILED
docker compose -f docker-compose.yml.new config -q >nul 2>&1
if errorlevel 1 goto SYNC_FETCH_FAILED
fc /b docker-compose.yml docker-compose.yml.new >nul 2>&1
if not errorlevel 1 goto SYNC_FOLDERS
copy /y docker-compose.yml docker-compose.yml.bak >nul 2>&1
move /y docker-compose.yml.new docker-compose.yml >nul 2>&1
echo [%DATE% %TIME%] docker-compose.yml updated from GitHub - previous copy kept as docker-compose.yml.bak >> onetrack_sync.log
goto SYNC_FOLDERS

:SYNC_FETCH_FAILED
echo [%DATE% %TIME%] Could not fetch a valid docker-compose.yml - keeping the current one >> onetrack_sync.log

:SYNC_FOLDERS
del docker-compose.yml.new >nul 2>&1

:: b) Upload folders. Created here so they exist before the containers start.
::    First time only: lead documents and EMD receipts saved before these folders
::    were mounted live inside the running backend container, which the new
::    mounts replace. Copy them out first so nothing is lost.
if not exist leads-assets docker cp onetrack-backend:/app/uploads/leads leads-assets >> onetrack_sync.log 2>&1
if not exist emd-assets docker cp onetrack-backend:/app/uploads/emd emd-assets >> onetrack_sync.log 2>&1
for %%D in (feedback-assets leads-assets emd-assets tender-assets) do if not exist "%%D" mkdir "%%D"

:: c) Pull the newest images and (re)create whatever changed.
docker compose pull >> onetrack_sync.log 2>&1
docker compose up -d --remove-orphans >> onetrack_sync.log 2>&1
exit /b 0
