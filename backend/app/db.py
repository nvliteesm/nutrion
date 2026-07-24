from collections.abc import AsyncGenerator
import ssl

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _engine_kwargs() -> dict:
    kwargs: dict = {"echo": settings.debug}
    if settings.is_postgres and settings.ssl_enabled:
        if settings.database_ssl_verify:
            ssl_ctx: ssl.SSLContext | bool = True
        else:
            ssl_ctx = ssl.create_default_context()
            ssl_ctx.check_hostname = False
            ssl_ctx.verify_mode = ssl.CERT_NONE
        connect_args: dict = {
            "ssl": ssl_ctx,
            # Required for Supabase transaction pooler (pgbouncer).
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        }
        kwargs["connect_args"] = connect_args
    return kwargs


engine = create_async_engine(settings.database_url, **_engine_kwargs())
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def _sqlite_add_missing_columns(conn) -> None:
    """Best-effort migration for hackathon SQLite schema upgrades."""
    result = await conn.execute(text("PRAGMA table_info(intakes)"))
    rows = result.fetchall()
    if not rows:
        return
    existing = {r[1] for r in rows}
    alters: list[str] = []
    if "kind" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN kind VARCHAR(32) DEFAULT 'food'")
    if "file_path" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN file_path VARCHAR(512) DEFAULT ''")
    if "confirmed" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN confirmed BOOLEAN DEFAULT 0")
    if "analysis_id" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN analysis_id VARCHAR(64) DEFAULT ''")
    if "is_estimated" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN is_estimated BOOLEAN DEFAULT 0")
    if "input_type" not in existing:
        alters.append("ALTER TABLE intakes ADD COLUMN input_type VARCHAR(32) DEFAULT 'food'")
    for stmt in alters:
        await conn.execute(text(stmt))


async def _postgres_reset_id_sequences(conn) -> None:
    """Keep serial sequences in sync after bulk inserts with explicit ids."""
    for table in ("intakes", "medical_reports"):
        await conn.execute(
            text(
                f"""
                SELECT setval(
                    pg_get_serial_sequence('{table}', 'id'),
                    COALESCE((SELECT MAX(id) FROM {table}), 1),
                    true
                )
                """
            )
        )


async def init_db() -> None:
    from app.models import orm  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.is_sqlite:
            await _sqlite_add_missing_columns(conn)
