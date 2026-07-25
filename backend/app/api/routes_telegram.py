"""Telegram notification endpoint — sends a daily summary message."""

from __future__ import annotations

from datetime import date
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_session
from app.services import analytics

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

# Bot token from .env
TELEGRAM_BOT_TOKEN = getattr(settings, "telegram_bot_token", "") or ""
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


class TelegramSendRequest(BaseModel):
    chat_id: str
    user_id: str = "default"


class TelegramSendResponse(BaseModel):
    ok: bool
    message: str


async def _send_message(chat_id: str, text: str) -> bool:
    """Send a message via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN:
        return False
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            f"{TELEGRAM_API}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "Markdown",
            },
        )
        return r.status_code == 200


@router.post("/send-summary", response_model=TelegramSendResponse)
async def send_daily_summary(
    body: TelegramSendRequest,
    db: AsyncSession = Depends(get_session),
) -> TelegramSendResponse:
    """Generate today's nutrition summary and send it via Telegram."""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Telegram bot token not configured")

    summary = await analytics.get_daily_summary(db, user_id=body.user_id)
    t = summary.totals

    text = (
        "🥗 *NutriON Daily Summary*\n\n"
        f"📅 {summary.start.isoformat()}\n"
        f"🔥 Calories: *{t.calories:.0f} kcal*\n"
        f"🍬 Sugar: *{t.sugar_g:.1f} g*\n"
        f"🥩 Protein: *{t.protein_g:.1f} g*\n"
        f"🍞 Carbs: *{t.carbs_g:.1f} g*\n"
        f"🧈 Fat: *{t.fat_g:.1f} g*\n"
        f"📊 Meals logged: *{summary.meal_count}*\n\n"
        "_NutriON — nutrition tracking & educational insights._"
    )

    ok = await _send_message(body.chat_id, text)
    if not ok:
        raise HTTPException(status_code=502, detail="Failed to send Telegram message")

    return TelegramSendResponse(ok=True, message="Daily summary sent to Telegram")


@router.post("/test", response_model=TelegramSendResponse)
async def test_connection(body: TelegramSendRequest) -> TelegramSendResponse:
    """Send a test message to verify Telegram connection."""
    if not TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=500, detail="Telegram bot token not configured")

    ok = await _send_message(
        body.chat_id,
        "✅ *NutriON connected!*\n\nYou'll receive nutrition summaries here.",
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Failed to send test message")

    return TelegramSendResponse(ok=True, message="Test message sent")


@router.get("/updates")
async def get_updates():
    """Helper: get recent bot updates to find chat IDs."""
    if not TELEGRAM_BOT_TOKEN:
        return {"error": "No bot token"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{TELEGRAM_API}/getUpdates")
        return r.json()
