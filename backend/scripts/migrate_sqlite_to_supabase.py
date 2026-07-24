"""Migrate local SQLite (data/nutrion.db) → Supabase / Postgres.

Usage:
  1. Set DATABASE_URL in backend/.env to your Supabase Postgres URI
     (Project Settings → Database → Connection string → URI).
     Example:
       DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres
  2. pip install -r requirements.txt
  3. From backend/:
       .venv\\Scripts\\python.exe scripts\\migrate_sqlite_to_supabase.py

Flags:
  --sqlite PATH   Source SQLite file (default: data/nutrion.db)
  --clear         Truncate destination tables before insert
  --dry-run       Read SQLite and print counts only
"""

from __future__ import annotations

import argparse
import asyncio
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import SessionLocal, _postgres_reset_id_sequences, engine, init_db
from app.models.orm import Analysis, Intake, MedicalMetric


def _parse_dt(value: object) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    text_v = str(value).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f%z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(text_v.replace("Z", "+0000"), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text_v.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    text_v = str(value).strip()[:10]
    try:
        return date.fromisoformat(text_v)
    except ValueError:
        return None


def _bool(value: object, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y"}


def _rows(conn: sqlite3.Connection, table: str) -> list[dict]:
    conn.row_factory = sqlite3.Row
    cur = conn.execute(f"SELECT * FROM {table}")
    return [dict(r) for r in cur.fetchall()]


def load_sqlite(path: Path) -> dict[str, list[dict]]:
    if not path.exists():
        raise FileNotFoundError(f"SQLite file not found: {path}")
    with sqlite3.connect(path) as conn:
        return {
            "intakes": _rows(conn, "intakes"),
            "analyses": _rows(conn, "analyses"),
            "medical_metrics": _rows(conn, "medical_metrics"),
        }


def to_intake(row: dict) -> Intake:
    return Intake(
        id=int(row["id"]),
        user_id=str(row.get("user_id") or "default"),
        kind=str(row.get("kind") or row.get("input_type") or "food"),
        name=str(row.get("name") or "Unknown meal"),
        serving=str(row.get("serving") or "1 serving"),
        source=str(row.get("source") or "extractor"),
        file_path=str(row.get("file_path") or ""),
        raw_text=str(row.get("raw_text") or ""),
        confidence=float(row.get("confidence") or 0.7),
        confirmed=_bool(row.get("confirmed"), False),
        analysis_id=str(row.get("analysis_id") or ""),
        is_estimated=_bool(row.get("is_estimated"), False),
        input_type=str(row.get("input_type") or row.get("kind") or "food"),
        calories=float(row.get("calories") or 0),
        protein_g=float(row.get("protein_g") or 0),
        carbs_g=float(row.get("carbs_g") or 0),
        fat_g=float(row.get("fat_g") or 0),
        fiber_g=float(row.get("fiber_g") or 0),
        sugar_g=float(row.get("sugar_g") or 0),
        sodium_mg=float(row.get("sodium_mg") or 0),
        extras_json=str(row.get("extras_json") or "{}"),
        logged_at=_parse_dt(row.get("logged_at")) or datetime.utcnow(),
    )


def to_analysis(row: dict) -> Analysis:
    return Analysis(
        id=str(row["id"]),
        user_id=str(row.get("user_id") or "default"),
        kind=str(row.get("kind") or "food"),
        status=str(row.get("status") or "pending"),
        file_path=str(row.get("file_path") or ""),
        result_json=str(row.get("result_json") or "{}"),
        raw_text=str(row.get("raw_text") or ""),
        created_at=_parse_dt(row.get("created_at")) or datetime.utcnow(),
        confirmed_at=_parse_dt(row.get("confirmed_at")),
    )


def to_metric(row: dict) -> MedicalMetric:
    return MedicalMetric(
        id=int(row["id"]),
        user_id=str(row.get("user_id") or "default"),
        analysis_id=str(row.get("analysis_id") or ""),
        metric_name=str(row.get("metric_name") or ""),
        category=str(row.get("category") or "other"),
        value=float(row.get("value") or 0),
        unit=str(row.get("unit") or ""),
        reference_min=(
            float(row["reference_min"])
            if row.get("reference_min") is not None
            else None
        ),
        reference_max=(
            float(row["reference_max"])
            if row.get("reference_max") is not None
            else None
        ),
        reference_range_text=str(row.get("reference_range_text") or ""),
        status=str(row.get("status") or "unknown"),
        test_date=_parse_date(row.get("test_date")),
        source_page=(
            int(row["source_page"]) if row.get("source_page") is not None else None
        ),
        extraction_confidence=float(row.get("extraction_confidence") or 0.5),
        confirmed=_bool(row.get("confirmed"), True),
        file_path=str(row.get("file_path") or ""),
        created_at=_parse_dt(row.get("created_at")) or datetime.utcnow(),
    )


async def clear_tables(session: AsyncSession) -> None:
    # Dependent order not required (no FKs), but clear children first anyway.
    await session.execute(text("TRUNCATE medical_metrics, intakes, analyses RESTART IDENTITY CASCADE"))
    await session.commit()


async def migrate(data: dict[str, list[dict]], *, clear: bool) -> dict[str, int]:
    if not settings.is_postgres:
        raise RuntimeError(
            "DATABASE_URL is not Postgres. Set it to your Supabase connection URI first."
        )

    await init_db()
    async with SessionLocal() as session:
        if clear:
            await clear_tables(session)

        intakes = [to_intake(r) for r in data["intakes"]]
        analyses = [to_analysis(r) for r in data["analyses"]]
        metrics = [to_metric(r) for r in data["medical_metrics"]]

        if analyses:
            session.add_all(analyses)
        if intakes:
            session.add_all(intakes)
        if metrics:
            session.add_all(metrics)
        await session.commit()

        async with engine.begin() as conn:
            await _postgres_reset_id_sequences(conn)

    return {
        "intakes": len(intakes),
        "analyses": len(analyses),
        "medical_metrics": len(metrics),
    }


async def verify() -> dict[str, int]:
    async with SessionLocal() as session:
        out: dict[str, int] = {}
        for table in ("intakes", "analyses", "medical_metrics"):
            result = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            out[table] = int(result.scalar_one())
        return out


async def run(data: dict[str, list[dict]], *, clear: bool) -> tuple[dict[str, int], dict[str, int]]:
    counts = await migrate(data, clear=clear)
    verified = await verify()
    await engine.dispose()
    return counts, verified


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate SQLite → Supabase Postgres")
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=ROOT / "data" / "nutrion.db",
        help="Source SQLite database path",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Truncate destination tables before insert",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only print source row counts",
    )
    args = parser.parse_args()

    print(f"Source SQLite : {args.sqlite}")
    print(f"Target DB     : {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
    print(f"Postgres?     : {settings.is_postgres}")
    print(f"SSL           : {settings.ssl_enabled}")

    data = load_sqlite(args.sqlite)
    print(
        "SQLite rows   :",
        {k: len(v) for k, v in data.items()},
    )
    if args.dry_run:
        print("Dry run only — no writes.")
        return

    counts, verified = asyncio.run(run(data, clear=args.clear))
    print("Inserted      :", counts)
    print("Verified      :", verified)
    print("Done.")


if __name__ == "__main__":
    main()
