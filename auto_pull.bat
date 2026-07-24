@echo off
title OneTrack Host Auto-Pull Sync Daemon
echo ========================================================
echo   OneTrack Host Auto-Pull Sync Daemon (GHCR -> Host)
echo ========================================================
echo Monitoring GitHub Container Registry for new updates every 60 seconds...
echo Press Ctrl+C to stop.
echo.

:loop
echo [%date% %time%] Checking GHCR for new updates...
docker compose pull
docker compose up -d
echo [%date% %time%] Sync complete. Sleeping 60 seconds...
echo --------------------------------------------------------
timeout /t 60 /nobreak > nul
goto loop
