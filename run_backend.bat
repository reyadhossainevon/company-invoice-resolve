@echo off
echo ========================================================
echo Starting AI Document Intelligence Backend (FastAPI)...
echo ========================================================
cd /d "%~dp0backend"
call "venv\Scripts\activate.bat"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
