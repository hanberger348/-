@echo off
cd /d "%~dp0"
node scripts/build-pages.mjs
if errorlevel 1 goto failed
start "" "http://127.0.0.1:4174/freshman-card-defence/"
node scripts/preview.mjs
pause
exit /b 0
:failed
echo Node.js is required. You can also open the separately provided single-file HTML game.
pause
exit /b 1
