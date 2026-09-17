# DumpSense AI - PowerShell Runner
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "          DumpSense AI - Launching System          " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Determine Python venv path
$pythonExe = "$root/MODEL/venv/Scripts/python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "$root/FireDetection/venv/Scripts/python.exe"
}

# 1. Start Backend in a separate window
Write-Host "1. Starting FastAPI Backend (Port 8000)..." -ForegroundColor Yellow
$backendCmd = @"
cd `"$root/backend`"
`$env:PYTHONPATH = `"$root/backend`"
& `"$pythonExe`" -m uvicorn app.main:app --reload --port 8000
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# 2. Start Frontend in a separate window
Write-Host "2. Starting Vite Frontend (Port 5173)..." -ForegroundColor Yellow
$frontendCmd = @"
cd `"$root/frontend`"
npm run dev
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "Backend:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "Docs:     http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green

Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5173"
