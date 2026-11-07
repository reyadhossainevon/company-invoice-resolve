import os
import sys
from pathlib import Path
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db.database import Base
from app.services.validator import InvoiceRegistry

TEST_DB_PATH = BACKEND_DIR / "test_docuintellect.db"
TEST_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Initializes test database schema."""
    Base.metadata.create_all(bind=test_engine)
    yield
    # Cleanup test DB file after tests
    try:
        if TEST_DB_PATH.exists():
            TEST_DB_PATH.unlink()
    except Exception:
        pass


@pytest.fixture
def db_session():
    """Provides a fresh database session per test with rolled back transactions."""
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    InvoiceRegistry().clear()
    try:
        yield db
    finally:
        db.close()
