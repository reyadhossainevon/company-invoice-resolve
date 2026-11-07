# DocuIntellect - One-Click Launcher for Windows PowerShell
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  DocuIntellect • AI Document Intelligence System (BDT)" -ForegroundColor Cyan
Write-Host "  Starting Backend (FastAPI :8000) and Frontend (Vite :5173)..." -ForegroundColor Cyan
Write-Host "=========================================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; .\venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 2

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm.cmd run dev"

Write-Host ""
Write-Host "Both servers launched in independent PowerShell windows!" -ForegroundColor Green
Write-Host "• Backend API & Docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "• Frontend Studio UI: http://localhost:5173" -ForegroundColor Yellow
Write-Host "=========================================================================" -ForegroundColor Cyan
