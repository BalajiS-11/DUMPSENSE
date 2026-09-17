@echo off
title DumpSense AI - Expo Runner
echo ===================================================
echo           DumpSense AI - Launching System
echo ===================================================

echo.
if exist "%~dp0MODEL\venv\Scripts\python.exe" (
    start "DumpSense Backend" cmd /k "cd /d "%~dp0backend" && set PYTHONPATH=%~dp0backend && ..\MODEL\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
) else (
    start "DumpSense Backend" cmd /k "cd /d "%~dp0backend" && set PYTHONPATH=%~dp0backend && ..\FireDetection\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
)

echo 2. Starting Vite Frontend (Port 5173)...
start "DumpSense Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================
echo Backend running at:  http://127.0.0.1:8000
echo Frontend running at: http://127.0.0.1:5173
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul
start http://127.0.0.1:5173
echo ===================================================
echo Press any key to exit this launcher window.
pause >nul
