import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

os.environ.setdefault("POSTGRES_USER", "test_user")
os.environ.setdefault("POSTGRES_PASSWORD", "test_password")
os.environ.setdefault("POSTGRES_DB", "test_db")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("SECRET_KEY", "test_secret")
os.environ.setdefault("APP_TIMEZONE", "Europe/Kyiv")

from app.core.config import settings
from app.db.database import Base


def _is_safe_test_db(database_url: str) -> bool:
    db_name = database_url.rsplit("/", 1)[-1]
    return "test" in db_name.lower() or os.environ.get("ALLOW_TEST_DB_RESET") == "1"


@pytest.fixture(scope="session")
def integration_engine():
    database_url = settings.database_url
    if not _is_safe_test_db(database_url):
        pytest.skip(
            "Integration tests require a test database. "
            "Use a DB name containing 'test' or set ALLOW_TEST_DB_RESET=1."
        )

    engine = create_engine(database_url)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(integration_engine):
    connection = integration_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = Session()
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
