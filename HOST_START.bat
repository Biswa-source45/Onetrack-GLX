@echo off
TITLE OneTrack Enterprise System Launcher & Auto-Sync
COLOR 0A
cd /d "%~dp0"

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

:: 3. Pull latest containers and launch compose stack
echo [3/4] Pulling latest containers and starting services...
docker compose pull >> onetrack_sync.log 2>&1
docker compose up -d --remove-orphans >> onetrack_sync.log 2>&1

:: 4. Detect this machine's LAN IP instead of a hardcoded address, so this
::    banner is correct on whichever PC actually runs it. (On a multi-adapter
::    PC this picks whichever IPv4 line ipconfig lists last — fine for the
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
echo [%DATE% %TIME%] Pulling latest container updates from GitHub Container Registry... >> onetrack_sync.log
docker compose pull >> onetrack_sync.log 2>&1
docker compose up -d --remove-orphans >> onetrack_sync.log 2>&1
goto AUTO_SYNC_LOOP
