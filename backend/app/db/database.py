import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Database path in backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "docuintellect.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite in FastAPI
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initializes tables in SQLite database."""
    from app.db import models  # noqa
    Base.metadata.create_all(bind=engine)
