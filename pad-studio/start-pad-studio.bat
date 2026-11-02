@echo off
rem Starts the Pad Studio helper (if not already running) and opens the page in Edge.
cd /d "%~dp0"
curl -s -m 2 http://127.0.0.1:8777/api/status >nul 2>&1
if errorlevel 1 (
  start "Pad Studio helper" /min node server.js
  for /l %%i in (1,1,20) do (
    curl -s -m 1 http://127.0.0.1:8777/api/status >nul 2>&1 && goto open
    timeout /t 1 /nobreak >nul
  )
  echo Helper did not start. Run "node server.js" in this folder to see the error.
  pause
  exit /b 1
)
:open
start msedge http://127.0.0.1:8777
