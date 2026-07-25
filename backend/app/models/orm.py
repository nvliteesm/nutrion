"""ORM models — one food/drink row in intakes, one lab report row in medical_reports."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Parent(Base):
    """App user profile. id = Supabase Auth UUID or demo id (u_maya, …)."""

    __tablename__ = "parents"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str] = mapped_column(String(256), default="", index=True)
    full_name: Mapped[str] = mapped_column(String(256), default="")
    auth_provider: Mapped[str] = mapped_column(String(32), default="demo")
    subscription: Mapped[str] = mapped_column(String(32), default="free")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class Intake(Base):
    """Confirmed nutrition entry — 1 food or drink = 1 row."""

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
    is_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    input_type: Mapped[str] = mapped_column(String(32), index=True, default="food")

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
    """Pending analyze → confirm draft (temporary, not the final log)."""

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


class MedicalReport(Base):
    """Confirmed lab report — 1 medical upload = 1 row (Blood Sugar + Lipid Profile)."""

    __tablename__ = "medical_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    analysis_id: Mapped[str] = mapped_column(String(64), index=True, default="")
    test_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    file_path: Mapped[str] = mapped_column(String(512), default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    # Blood Sugar
    hba1c: Mapped[float | None] = mapped_column(Float, nullable=True)
    hba1c_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    fasting_glucose: Mapped[float | None] = mapped_column(Float, nullable=True)
    fasting_glucose_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    # Lipid Profile
    total_cholesterol: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_cholesterol_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    ldl: Mapped[float | None] = mapped_column(Float, nullable=True)
    ldl_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hdl: Mapped[float | None] = mapped_column(Float, nullable=True)
    hdl_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    triglycerides: Mapped[float | None] = mapped_column(Float, nullable=True)
    triglycerides_status: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class Insight(Base):
    """Generated insight (daily/weekly/sugar/completeness/medical) — persisted for history."""

    __tablename__ = "insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    kind: Mapped[str] = mapped_column(String(48), index=True)
    title: Mapped[str] = mapped_column(String(256), default="")
    body: Mapped[str] = mapped_column(Text, default="")
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    evidence_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


# Back-compat alias used by older imports during transition
MedicalMetric = MedicalReport
