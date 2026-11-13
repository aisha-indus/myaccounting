@echo off
REM Starts the API (port 5000) and the web app (port 3000) in two windows.
start "IBMS Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "IBMS Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 8 >nul
start http://localhost:3000
