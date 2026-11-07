@echo off
setlocal
cd /d "%~dp0"
title Site server

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js 20 or newer from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js is too old. Install version 20 or newer from https://nodejs.org
  pause
  exit /b 1
)

findstr /c:"\"dependencies\"" package.json >nul 2>nul
if not errorlevel 1 if not exist node_modules (
  echo Installing packages, please wait...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check the internet connection.
    pause
    exit /b 1
  )
)

echo Starting the site: http://localhost:3000
echo Admin panel: http://localhost:3000/admin
echo To stop the server close this window or press Ctrl+C.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.js
echo.
echo The server has stopped.
pause
