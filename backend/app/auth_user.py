"""Auth identity: Supabase JWT (Google) or demo local user_ids."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings

logger = logging.getLogger(__name__)

DEMO_USER_IDS = frozenset({"u_maya", "u_alex", "default"})
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.I,
)


@dataclass
class AuthUser:
    user_id: str
    email: str = ""
    full_name: str = ""
    provider: str = "demo"  # demo | google | local


def is_demo_user_id(user_id: str) -> bool:
    uid = (user_id or "").strip()
    if uid in DEMO_USER_IDS:
        return True
    # Local register ids: u_<timestamp>
    return bool(re.fullmatch(r"u_\d+", uid))


def looks_like_uuid(user_id: str) -> bool:
    return bool(_UUID_RE.fullmatch((user_id or "").strip()))


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


async def fetch_supabase_user(access_token: str) -> AuthUser | None:
    """Validate access token via Supabase Auth API (no JWT secret required)."""
    base = (settings.supabase_url or "").rstrip("/")
    anon = settings.supabase_anon_key or ""
    if not base or not anon:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                f"{base}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": anon,
                },
            )
        if res.status_code != 200:
            logger.info("Supabase user lookup failed: %s", res.status_code)
            return None
        data = res.json()
        uid = str(data.get("id") or "").strip()
        if not uid:
            return None
        meta = data.get("user_metadata") or {}
        full_name = (
            meta.get("full_name")
            or meta.get("name")
            or (data.get("email") or "").split("@")[0]
            or "User"
        )
        return AuthUser(
            user_id=uid,
            email=str(data.get("email") or ""),
            full_name=str(full_name),
            provider="google",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Supabase auth validation error")
        return None


async def resolve_user_id(
    request: Request,
    *,
    claimed: str | None,
    session: AsyncSession | None = None,
) -> str:
    """
    Prefer Supabase Bearer identity. Demo/local ids allowed without token.
    UUID claims without a valid token are rejected when Supabase is configured.
    """
    from app.services import parents as parents_service

    header_uid = (request.headers.get("x-user-id") or "").strip()
    claimed_id = (claimed or "").strip() or header_uid or "default"
    token = _bearer_token(request)

    if token:
        auth_user = await fetch_supabase_user(token)
        if auth_user:
            if session is not None:
                await parents_service.upsert_parent(
                    session,
                    user_id=auth_user.user_id,
                    email=auth_user.email,
                    full_name=auth_user.full_name,
                    auth_provider=auth_user.provider,
                    subscription="free",
                )
            return auth_user.user_id
        raise HTTPException(status_code=401, detail="Invalid or expired auth token")

    if is_demo_user_id(claimed_id):
        if session is not None:
            # Ensure demo parents exist for FK-style referencing later
            seed = {
                "u_maya": ("maya@example.com", "Maya Kessler", "premium"),
                "u_alex": ("alex@example.com", "Alex Rivera", "free"),
                "default": ("", "Default", "free"),
            }
            email, name, sub = seed.get(
                claimed_id,
                ("", claimed_id, "free"),
            )
            await parents_service.upsert_parent(
                session,
                user_id=claimed_id,
                email=email,
                full_name=name,
                auth_provider="demo" if claimed_id in DEMO_USER_IDS else "local",
                subscription=sub,
            )
        return claimed_id

    # UUID without bearer — do not trust client spoofing of Google ids
    if settings.supabase_url.strip() and looks_like_uuid(claimed_id):
        raise HTTPException(
            status_code=401,
            detail="Sign in with Google required for this account",
        )

    return claimed_id
