@echo off
setlocal enableextensions
title Quantum Twin - Install and Run

REM Elevate to admin (Node MSI, winget, and npm global all need it).
net session >nul 2>nul
if errorlevel 1 (
  echo Requesting administrator privileges...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
set "NODE_MSI=%TEMP%\node-v24.18.0-x64.msi"

echo ============================================================
echo   Quantum Twin - one-click install and run (Windows)
echo   Installs Node.js 24.18.0, Git, and pnpm 11.9.0, then
echo   builds and launches the app on 127.0.0.1.
echo ============================================================
echo.

REM --- [1/4] Node.js 24.18.0 ---
node --version 2>nul | findstr /r "v24\.18\." >nul
if errorlevel 1 (
  echo [1/4] Installing Node.js 24.18.0 ...
  powershell -NoProfile -Command "try{Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.18.0/node-v24.18.0-x64.msi' -OutFile $env:NODE_MSI}catch{exit 1}"
  if errorlevel 1 ( echo Failed to download the Node.js MSI. & goto :fail )
  msiexec /i "%NODE_MSI%" /quiet /norestart
) else (
  echo [1/4] Node.js 24.18.0 already present.
)
set "PATH=%ProgramFiles%\nodejs;%PATH%"

REM --- [2/4] Git ---
where git >nul 2>nul
if errorlevel 1 (
  echo [2/4] Installing Git ...
  winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements
) else (
  echo [2/4] Git already present.
)
set "PATH=%ProgramFiles%\Git\cmd;%PATH%"

REM --- [3/4] pnpm 11.9.0 ---
echo [3/4] Installing pnpm 11.9.0 ...
call npm install --global pnpm@11.9.0
set "PATH=%APPDATA%\npm;%PATH%"

REM --- [4/4] Install dependencies and launch on 127.0.0.1 ---
echo [4/4] Installing dependencies ...
call npx --yes pnpm@11.9.0 install --frozen-lockfile
if errorlevel 1 ( echo Dependency install failed. & goto :fail )

echo.
echo If you have not signed in to Codex yet, open a new terminal and run:  codex login
echo Launching Quantum Twin on 127.0.0.1 - a browser tab opens automatically. Press Ctrl+C to stop.
echo.
call npx --yes pnpm@11.9.0 app
goto :end

:fail
echo.
echo Install failed. See the messages above.
pause
exit /b 1

:end
pause
