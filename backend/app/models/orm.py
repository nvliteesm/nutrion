from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Intake(Base):
    __tablename__ = "intakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True, default="default")
    name: Mapped[str] = mapped_column(String(256), default="Unknown meal")
    serving: Mapped[str] = mapped_column(String(128), default="1 serving")
    source: Mapped[str] = mapped_column(String(64), default="extractor")
    raw_text: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[float] = mapped_column(Float, default=0.7)

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
