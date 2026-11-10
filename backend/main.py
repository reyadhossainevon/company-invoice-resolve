"""
DocuIntellect - FastAPI ASGI Entrypoint for Cloud Deployment (Render/Heroku/Docker/Local).
Exposes the top-level 'app' instance so commands like:
    uvicorn main:app --host 0.0.0.0 --port $PORT
work out-of-the-box when run inside the backend/ directory.
"""
import os
import sys
from pathlib import Path

# Add backend directory to sys.path so 'app' and its submodules are cleanly resolved
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Expose the FastAPI application instance
from app.main import app

# Ensure CORS explicitly permits all origins so frontend (e.g. Vercel) can communicate seamlessly
from fastapi.middleware.cors import CORSMiddleware

cors_configured = any(getattr(m, "cls", None) == CORSMiddleware for m in getattr(app, "user_middleware", []))
if not cors_configured:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=False)
