from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Intake(Base):
    """Confirmed nutrition entry (food or drink)."""

    __tablename__ = "intakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    kind: Mapped[str] = mapped_column(String(32), index=True, default="food")  # food|drink
    name: Mapped[str] = mapped_column(String(256), default="Unknown meal")
    serving: Mapped[str] = mapped_column(String(128), default="1 serving")
    source: Mapped[str] = mapped_column(String(64), default="extractor")
    file_path: Mapped[str] = mapped_column(String(512), default="")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.7)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    analysis_id: Mapped[str] = mapped_column(String(64), index=True, default="")

    calories: Mapped[float] = mapped_column(Float, default=0)
    protein_g: Mapped[float] = mapped_column(Float, default=0)
    carbs_g: Mapped[float] = mapped_column(Float, default=0)
    fat_g: Mapped[float] = mapped_column(Float, default=0)
    fiber_g: Mapped[float] = mapped_column(Float, default=0)
    sugar_g: Mapped[float] = mapped_column(Float, default=0)
    sodium_mg: Mapped[float] = mapped_column(Float, default=0)
    extras_json: Mapped[str] = mapped_column(Text, default="{}")

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class Analysis(Base):
    """Pending analyze → confirm workflow row."""

    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    kind: Mapped[str] = mapped_column(String(32), index=True)  # food|drink|medical
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    file_path: Mapped[str] = mapped_column(String(512), default="")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MedicalMetric(Base):
    """User-confirmed medical lab metric."""

    __tablename__ = "medical_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    analysis_id: Mapped[str] = mapped_column(String(64), index=True, default="")
    metric_name: Mapped[str] = mapped_column(String(128))
    category: Mapped[str] = mapped_column(String(64), index=True, default="other")
    value: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(32), default="")
    reference_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    reference_range_text: Mapped[str] = mapped_column(String(256), default="")
    status: Mapped[str] = mapped_column(String(32), default="unknown")
    test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.5)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    file_path: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
