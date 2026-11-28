@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ist noch nicht installiert. Bitte zuerst von https://nodejs.org die LTS-Version installieren,
  echo danach diese Datei noch einmal doppelklicken.
  pause
  exit /b 1
)
node kalender-zu-obsidian.mjs --setup
pause
