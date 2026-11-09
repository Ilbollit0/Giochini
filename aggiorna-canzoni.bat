@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Serve Node.js per aggiornare l'elenco: scaricalo da https://nodejs.org
  pause
  exit /b 1
)
node strumenti\aggiorna-canzoni.js
echo.
pause
