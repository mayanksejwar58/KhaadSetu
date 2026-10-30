"""Database engine, session factory and startup helpers for KhadSetu.

SQLite + WAL mode gives better concurrent-read behaviour than the default
journal mode, and `PRAGMA foreign_keys=ON` makes FK violations raise instead of
silently corrupting reservation math. All timestamps are stored in UTC.

Every transaction opens as BEGIN IMMEDIATE (the official SQLAlchemy SQLite
recipe): the DB write lock is taken up front, so the reservation service's
`check available -> bump reserved_stock` runs serialized against other writers
instead of racing them. Reads stay non-blocking under WAL.
"""

from __future__ import annotations

import os

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# khadsetu.db lives next to the backend folder (app/database.py -> one level up).
DB_PATH = os.environ.get(
    "KHADSETU_DB",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "khadsetu.db",
    ),
)


def make_engine(
    db_url: str, *, poolclass: type | None = None, pool_kwargs: dict | None = None
) -> Engine:
    """Create an engine wired with KhadSetu's SQLite pragmas + BEGIN IMMEDIATE.

    Kept as a factory (instead of a single global) so tests build isolated
    engines with identical behaviour to the runtime database. `poolclass` and
    `pool_kwargs` exist for special pool setups (kept for future scenarios).
    """
    kwargs: dict = {
        "connect_args": {"check_same_thread": False},  # FastAPI threadpools + sim threads
        "future": True,
    }
    if poolclass is not None:
        kwargs["poolclass"] = poolclass
    if pool_kwargs:
        kwargs.update(pool_kwargs)
    eng = create_engine(db_url, **kwargs)

    @event.listens_for(eng, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        """Apply pragmas on every fresh connection (they are per-connection in SQLite)."""
        # sqlite3 must not issue its own lazy BEGIN; we control it explicitly below.
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        # busy_timeout FIRST: it enables the busy handler, so the (only possibly
        # contentious) journal_mode switch retries instead of erroring.
        cursor.execute("PRAGMA busy_timeout=5000")  # wait up to 5s in the write queue
        cursor.execute("PRAGMA foreign_keys=ON")    # enforce FK integrity
        cursor.execute("PRAGMA journal_mode=WAL")   # concurrent readers + one writer
        cursor.close()

    @event.listens_for(eng, "begin")
    def _begin_immediate(conn):
        """Every SQLAlchemy transaction opens as BEGIN IMMEDIATE (serialized writers)."""
        conn.exec_driver_sql("BEGIN IMMEDIATE")

    return eng


class Base(DeclarativeBase):
    """Declarative base for all KhadSetu models."""


# Runtime engine: file-based DB shared by the API process.
engine = make_engine(f"sqlite:///{DB_PATH}")

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    future=True,
)


def get_db():
    """FastAPI dependency yielding a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables on the runtime engine."""
    from app import models  # noqa: F401  (importing registers every model on Base)

    Base.metadata.create_all(engine)
