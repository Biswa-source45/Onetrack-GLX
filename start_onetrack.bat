@echo off
:: Ensure working directory is set to project directory
cd /d "%~dp0"

:: Start Docker Desktop if not already running
tasklist /FI "IMAGENAME eq Docker Desktop.exe" 2>NUL | find /I /N "Docker Desktop.exe">NUL
if "%ERRORLEVEL%"=="1" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    :: Wait 20 seconds for Docker Engine daemon to initialize
    timeout /t 20 /nobreak >nul
)

:: Run Docker Compose silently in background
docker compose pull
docker compose up -d

:: Start continuous auto-pull sync daemon minimized in background
start /min "" "%~dp0auto_pull.bat"


