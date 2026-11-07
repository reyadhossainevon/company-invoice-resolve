Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Starting AI Document Intelligence Backend (FastAPI)..." -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\backend"
& "$PSScriptRoot\backend\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
