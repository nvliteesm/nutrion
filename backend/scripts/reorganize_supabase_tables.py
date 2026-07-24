"""Reorganize Supabase: medical_metrics (many rows) -> medical_reports (1 row/report).

Also creates food_entries / drink_entries views for easy browsing.

Usage (from backend/):
  .venv\\Scripts\\python.exe scripts\\reorganize_supabase_tables.py
"""

from __future__ import annotations

import asyncio
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.models.orm import MedicalReport
from app.models.schemas import MedicalCategory, MedicalMetricData, MetricStatus
from app.services.medical_report import build_report_row, canonicalize_metric_name


async def _table_exists(name: str) -> bool:
    async with SessionLocal() as session:
        result = await session.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.tables
                  WHERE table_schema = 'public' AND table_name = :name
                )
                """
            ),
            {"name": name},
        )
        return bool(result.scalar_one())


async def _fetch_legacy_metrics() -> list[dict]:
    if not await _table_exists("medical_metrics"):
        return []
    async with SessionLocal() as session:
        result = await session.execute(text("SELECT * FROM medical_metrics ORDER BY id"))
        rows = result.mappings().all()
        return [dict(r) for r in rows]


def _group_legacy(rows: list[dict]) -> list[list[dict]]:
    """Group old per-metric rows into one report per analysis_id (or created_at bucket)."""
    by_key: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        key = (row.get("analysis_id") or "").strip() or f"orphan-{row.get('id')}"
        by_key[key].append(row)
    return list(by_key.values())


def _legacy_to_metrics(group: list[dict]) -> list[MedicalMetricData]:
    metrics: list[MedicalMetricData] = []
    for row in group:
        name = canonicalize_metric_name(str(row.get("metric_name") or ""))
        if not name:
            continue
        status_raw = str(row.get("status") or "unknown").lower()
        try:
            status = MetricStatus(status_raw)
        except ValueError:
            status = MetricStatus.unknown
        cat_raw = str(row.get("category") or "other")
        try:
            category = MedicalCategory(cat_raw)
        except ValueError:
            category = MedicalCategory.other
        test_date = row.get("test_date")
        if isinstance(test_date, datetime):
            test_date = test_date.date()
        elif isinstance(test_date, str) and test_date:
            try:
                test_date = date.fromisoformat(test_date[:10])
            except ValueError:
                test_date = None
        metrics.append(
            MedicalMetricData(
                metric_name=name,
                category=category,
                value=float(row.get("value") or 0),
                unit=str(row.get("unit") or ""),
                reference_min=row.get("reference_min"),
                reference_max=row.get("reference_max"),
                reference_range_text=str(row.get("reference_range_text") or ""),
                status=status,
                test_date=test_date,
                extraction_confidence=float(row.get("extraction_confidence") or 0.5),
                confirmed=bool(row.get("confirmed", True)),
            )
        )
    return metrics


async def migrate_medical() -> int:
    legacy = await _fetch_legacy_metrics()
    if not legacy:
        print("No legacy medical_metrics rows (or table missing).")
        return 0

    # Skip if reports already populated
    async with SessionLocal() as session:
        existing = await session.execute(text("SELECT COUNT(*) FROM medical_reports"))
        if int(existing.scalar_one()) > 0:
            print("medical_reports already has data — skipping insert.")
            return 0

    groups = _group_legacy(legacy)
    created = 0
    async with SessionLocal() as session:
        for group in groups:
            metrics = _legacy_to_metrics(group)
            if not metrics:
                continue
            sample = group[0]
            row = build_report_row(
                metrics=metrics,
                user_id=str(sample.get("user_id") or "default"),
                analysis_id=str(sample.get("analysis_id") or ""),
                file_path=str(sample.get("file_path") or ""),
                confirmed=True,
            )
            session.add(row)
            created += 1
        await session.commit()
    print(f"Created {created} medical_reports from {len(legacy)} legacy metrics.")
    return created


async def create_views() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                CREATE OR REPLACE VIEW food_entries AS
                SELECT id, user_id, name, serving, calories, protein_g, carbs_g, fat_g,
                       fiber_g, sugar_g, sodium_mg, confirmed, source, logged_at
                FROM intakes
                WHERE kind = 'food'
                """
            )
        )
        await conn.execute(
            text(
                """
                CREATE OR REPLACE VIEW drink_entries AS
                SELECT id, user_id, name, serving, calories, carbs_g, sugar_g, sodium_mg,
                       confirmed, source, logged_at
                FROM intakes
                WHERE kind = 'drink'
                """
            )
        )
    print("Views ready: food_entries, drink_entries")


async def drop_legacy() -> None:
    if not await _table_exists("medical_metrics"):
        print("medical_metrics already gone.")
        return
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS medical_metrics CASCADE"))
    print("Dropped legacy medical_metrics table.")


async def main() -> None:
    if not settings.is_postgres:
        raise SystemExit("DATABASE_URL must point to Supabase/Postgres")
    print("Target:", settings.database_url.split("@")[-1])
    await init_db()
    await migrate_medical()
    await create_views()
    await drop_legacy()
    async with SessionLocal() as session:
        for table in ("intakes", "medical_reports", "analyses"):
            n = (await session.execute(text(f"SELECT COUNT(*) FROM {table}"))).scalar_one()
            print(f"  {table}: {n}")
    await engine.dispose()
    print("Done. In Supabase Table Editor open: intakes, medical_reports, food_entries, drink_entries")


if __name__ == "__main__":
    asyncio.run(main())
