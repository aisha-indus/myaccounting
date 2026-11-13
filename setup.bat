@echo off
REM One-time setup: installs packages, creates the MySQL database + tables, loads sample data.
REM Before running: start MySQL and set DB_USER / DB_PASSWORD in backend\.env
cd /d "%~dp0backend"
if not exist .env copy .env.example .env
echo.
echo [1/4] Installing backend packages...
call npm install || goto :fail
echo.
echo [2/4] Creating database and tables...
call npm run db:migrate || goto :fail
echo.
echo [3/4] Loading sample data...
call npm run db:seed
cd /d "%~dp0frontend"
if not exist .env.local copy .env.example .env.local
echo.
echo [4/4] Installing frontend packages...
call npm install || goto :fail
echo.
echo Setup finished. Now double-click start.bat
pause
exit /b 0
:fail
echo.
echo Setup stopped because of the error above. Fix it and run setup.bat again.
pause
exit /b 1
