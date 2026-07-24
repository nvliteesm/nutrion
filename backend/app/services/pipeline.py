"""
Data pipeline stages:

1. INGESTION  — accept upload (food image / drink label / document)
2. PROCESSING — OCR | food AI | document parse → nutrient extractor
3. STORAGE    — Structured DB (SQLite intakes + daily totals) + Vector DB (semantic memory)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from app.models.schemas import ExtractedMeal, InputType

ProcessKind = Literal["food", "drink", "document"]


@dataclass
class IngestedFile:
    path: Path
    filename: str
    kind: ProcessKind
    user_id: str = "default"


@dataclass
class ProcessResult:
    kind: ProcessKind
    meal: ExtractedMeal
    raw_text: str
    processor: str
    file_path: str = ""
    warnings: list[str] = field(default_factory=list)

    @property
    def input_type(self) -> InputType:
        return InputType(self.kind)


@dataclass
class StorageResult:
    intake_id: int
    structured_ok: bool = True
    vector_ok: bool = True
    vector_error: str | None = None
