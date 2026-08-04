@echo off
TITLE OneTrack Auto Host Monitor & Launcher
COLOR 0A
SET REPO_DIR=d:\Onetrack-GlobX
SET BACKEND_DIR=%REPO_DIR%\backend
SET FRONTEND_DIR=%REPO_DIR%\frontend
SET LOG_FILE=%REPO_DIR%\onetrack_host_service.log

echo ======================================================== >> "%LOG_FILE%"
echo [%DATE% %TIME%] Running OneTrack Health & Sync Check... >> "%LOG_FILE%"
echo ======================================================== >> "%LOG_FILE%"

cd /d "%REPO_DIR%"

:: 1. Auto Git Pull for seamless deployments
echo [%TIME%] Checking for code updates from GitHub... >> "%LOG_FILE%"
git pull origin main >> "%LOG_FILE%" 2>&1

:: 2. Check & Start Go Backend (Port 8081)
netstat -o -n -a | findstr ":8081" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] [WARNING] Backend on port 8081 is DOWN! Starting server... >> "%LOG_FILE%"
    cd /d "%BACKEND_DIR%"
    start /B go run .\cmd\server\main.go >> "%REPO_DIR%\backend_output.log" 2>&1
    echo [%TIME%] [SUCCESS] Backend service launched. >> "%LOG_FILE%"
) else (
    echo [%TIME%] [OK] Backend service is running on port 8081. >> "%LOG_FILE%"
)

:: 3. Check & Start Frontend Web Server (Port 80)
netstat -o -n -a | findstr ":80 " >nul
if %ERRORLEVEL% NEQ 0 (
    echo [%TIME%] [WARNING] Frontend on port 80 is DOWN! Building & starting... >> "%LOG_FILE%"
    cd /d "%FRONTEND_DIR%"
    call npm run build >> "%LOG_FILE%" 2>&1
    start /B npx serve -s dist -l 80 >> "%REPO_DIR%\frontend_output.log" 2>&1
    echo [%TIME%] [SUCCESS] Frontend web server launched on Port 80. >> "%LOG_FILE%"
) else (
    echo [%TIME%] [OK] Frontend web server is running on Port 80. >> "%LOG_FILE%"
)

echo [%TIME%] Health Check Completed Successfully. >> "%LOG_FILE%"
echo. >> "%LOG_FILE%"
