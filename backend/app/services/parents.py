"""parents table — canonical app user keyed by auth UUID or demo id."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Parent


async def upsert_parent(
    session: AsyncSession,
    *,
    user_id: str,
    email: str = "",
    full_name: str = "",
    auth_provider: str = "demo",
    subscription: str = "free",
) -> Parent:
    uid = (user_id or "").strip()
    if not uid:
        raise ValueError("user_id required")

    row = await session.get(Parent, uid)
    if row is None:
        row = Parent(
            id=uid,
            email=email or "",
            full_name=full_name or "",
            auth_provider=auth_provider,
            subscription=subscription,
        )
        session.add(row)
    else:
        if email:
            row.email = email
        if full_name:
            row.full_name = full_name
        if auth_provider:
            row.auth_provider = auth_provider
        if subscription:
            row.subscription = subscription
    await session.commit()
    await session.refresh(row)
    return row


async def get_parent(session: AsyncSession, user_id: str) -> Parent | None:
    return await session.get(Parent, user_id)


async def list_parents(session: AsyncSession, limit: int = 100) -> list[Parent]:
    stmt = select(Parent).order_by(Parent.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def ensure_demo_parents(session: AsyncSession) -> None:
    demos = [
        ("u_maya", "maya@example.com", "Maya Kessler", "premium"),
        ("u_alex", "alex@example.com", "Alex Rivera", "free"),
    ]
    for uid, email, name, sub in demos:
        existing = await session.get(Parent, uid)
        if existing is None:
            session.add(
                Parent(
                    id=uid,
                    email=email,
                    full_name=name,
                    auth_provider="demo",
                    subscription=sub,
                )
            )
    await session.commit()
