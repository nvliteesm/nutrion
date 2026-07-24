"""Azure Speech (Cognitive Services) speech-to-text client.

Uses Fast Transcription for uploaded browser recordings (webm/m4a/wav).
The mic SDK sample only works with a server-side microphone — not for web uploads.
"""

from __future__ import annotations

import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class SpeechError(RuntimeError):
    pass


def _extract_transcript(payload: dict) -> str:
    phrases = payload.get("combinedPhrases") or []
    if phrases:
        parts = [(p.get("text") or "").strip() for p in phrases if isinstance(p, dict)]
        text = " ".join(p for p in parts if p).strip()
        if text:
            return text
    bits: list[str] = []
    for phrase in payload.get("phrases") or []:
        if isinstance(phrase, dict) and phrase.get("text"):
            bits.append(str(phrase["text"]).strip())
    if bits:
        return " ".join(bits).strip()
    # Short-audio REST style
    if isinstance(payload.get("DisplayText"), str):
        return payload["DisplayText"].strip()
    if isinstance(payload.get("Text"), str):
        return payload["Text"].strip()
    return ""


def _azure_error_message(resp: httpx.Response) -> str:
    text = resp.text[:800]
    try:
        data = resp.json()
        if isinstance(data, dict):
            err = data.get("error") or data
            if isinstance(err, dict):
                msg = err.get("message") or err.get("code") or text
                return str(msg)
            return str(err)
    except Exception:  # noqa: BLE001
        pass
    return text or f"HTTP {resp.status_code}"


def _guess_mime(filename: str, content_type: str | None) -> str:
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime and mime not in {"application/octet-stream", "binary/octet-stream"}:
        return mime
    lower = filename.lower()
    if lower.endswith(".webm"):
        return "audio/webm"
    if lower.endswith(".m4a") or lower.endswith(".mp4"):
        return "audio/mp4"
    if lower.endswith(".wav"):
        return "audio/wav"
    if lower.endswith(".ogg"):
        return "audio/ogg"
    if lower.endswith(".mp3"):
        return "audio/mpeg"
    return "application/octet-stream"


async def _transcribe_fast(
    *,
    file_bytes: bytes,
    filename: str,
    mime: str,
    locale: str,
) -> str:
    url = (
        f"{settings.speech_endpoint}/speechtotext/transcriptions:transcribe"
        f"?api-version={settings.azure_speech_api_version}"
    )
    headers = {"Ocp-Apim-Subscription-Key": settings.speech_api_key}
    files = {
        "audio": (filename, file_bytes, mime),
        "definition": (
            None,
            json.dumps({"locales": [locale]}),
            "application/json",
        ),
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(url, headers=headers, files=files)
    if resp.status_code >= 400:
        raise SpeechError(_azure_error_message(resp))
    return _extract_transcript(resp.json())


async def _transcribe_short_audio(
    *,
    file_bytes: bytes,
    mime: str,
    locale: str,
) -> str:
    """Fallback: conversation short-audio REST (good for browser webm/opus)."""
    url = (
        f"{settings.speech_endpoint}/speech/recognition/conversation/"
        f"cognitiveservices/v1?language={locale}&format=detailed"
    )
    # Prefer an explicit codecs hint for MediaRecorder webm.
    content_type = mime
    if mime == "audio/webm":
        content_type = "audio/webm; codecs=opus"
    headers = {
        "Ocp-Apim-Subscription-Key": settings.speech_api_key,
        "Content-Type": content_type,
        "Accept": "application/json",
    }
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.post(url, headers=headers, content=file_bytes)
    if resp.status_code >= 400:
        raise SpeechError(_azure_error_message(resp))
    payload = resp.json()
    # detailed format
    nbest = payload.get("NBest") or []
    if nbest and isinstance(nbest[0], dict):
        display = (nbest[0].get("Display") or nbest[0].get("Lexical") or "").strip()
        if display:
            return display
    return _extract_transcript(payload)


async def transcribe_audio(
    *,
    file_bytes: bytes,
    filename: str,
    content_type: str | None = None,
) -> str:
    """Transcribe uploaded audio via Azure Speech."""
    if not settings.speech_configured:
        raise SpeechError(
            "Speech-to-text is not configured. Set AZURE_SPEECH_ENDPOINT and AZURE_SPEECH_KEY."
        )
    if not file_bytes:
        raise SpeechError("Empty audio upload")

    name = (filename or "audio.webm").replace("\\", "/").split("/")[-1] or "audio.webm"
    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", name) or "audio.webm"
    mime = _guess_mime(safe_name, content_type)
    locale = (settings.azure_speech_locale or "en-US").strip() or "en-US"

    logger.info(
        "Transcribing audio name=%s mime=%s bytes=%s locale=%s",
        safe_name,
        mime,
        len(file_bytes),
        locale,
    )

    try:
        text = await _transcribe_fast(
            file_bytes=file_bytes,
            filename=safe_name,
            mime=mime,
            locale=locale,
        )
        if text:
            return text
    except SpeechError as exc:
        logger.warning("Fast transcription failed, trying short-audio REST: %s", exc)
        try:
            text = await _transcribe_short_audio(
                file_bytes=file_bytes,
                mime=mime,
                locale=locale,
            )
            if text:
                return text
            raise SpeechError("No speech detected in the recording.") from exc
        except SpeechError:
            raise
        except Exception as fallback_exc:  # noqa: BLE001
            raise SpeechError(str(exc)) from fallback_exc

    # Fast path succeeded but empty — try short-audio once more for webm.
    if mime.startswith("audio/webm") or mime.startswith("audio/mp4"):
        try:
            text = await _transcribe_short_audio(
                file_bytes=file_bytes,
                mime=mime,
                locale=locale,
            )
            if text:
                return text
        except SpeechError as exc:
            logger.warning("Short-audio fallback empty/failed: %s", exc)

    return ""
