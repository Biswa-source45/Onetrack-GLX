@echo off
cd /d "%~dp0"
echo Updating Onetrack Containers...
docker compose pull
docker compose up -d --build
echo Update complete!
timeout /t 5
