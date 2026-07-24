from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


engine = create_async_engine(settings.database_url, echo=settings.debug)
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
    for stmt in alters:
        await conn.execute(text(stmt))


async def init_db() -> None:
    from app.models import orm  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if settings.database_url.startswith("sqlite"):
            await _sqlite_add_missing_columns(conn)
