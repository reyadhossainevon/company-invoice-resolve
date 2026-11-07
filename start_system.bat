@echo off
echo =========================================================================
echo   DocuIntellect • AI Document Intelligence System (BDT)
echo   Starting Backend (FastAPI :8000) and Frontend (Vite :5173)...
echo =========================================================================

start "DocuIntellect - FastAPI Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

start "DocuIntellect - React Frontend" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

echo.
echo Both servers are launching in separate windows!
echo - Backend API & Docs: http://localhost:8000/docs
echo - Frontend Studio UI: http://localhost:5173
echo =========================================================================
