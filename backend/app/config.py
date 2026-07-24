from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DEFAULT_SQLITE_URL = f"sqlite+aiosqlite:///{(DATA_DIR / 'nutrion.db').as_posix()}"


def normalize_database_url(url: str) -> str:
    """Accept postgres:// / postgresql:// and force asyncpg driver for Postgres."""
    value = (url or "").strip()
    if not value:
        return DEFAULT_SQLITE_URL
    # Common mistake: pasting the Supabase HTTPS project URL into DATABASE_URL
    if value.startswith("http://") or value.startswith("https://"):
        return DEFAULT_SQLITE_URL
    if value.startswith("postgres://"):
        value = "postgresql+asyncpg://" + value[len("postgres://") :]
    elif value.startswith("postgresql://"):
        value = "postgresql+asyncpg://" + value[len("postgresql://") :]
    # Drop libpq-only sslmode; asyncpg gets SSL via connect_args.
    if "sslmode=" in value:
        parsed = urlparse(value)
        query = [
            (k, v)
            for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            if k != "sslmode"
        ]
        value = urlunparse(parsed._replace(query=urlencode(query)))
    return value


def _normalize_openai_v1_base(endpoint: str) -> str:
    """Strip Responses/Chat paths so we can call /chat/completions and /embeddings."""
    base = endpoint.strip().rstrip("/")
    for suffix in (
        "/openai/v1/responses",
        "/openai/v1/chat/completions",
        "/openai/v1/embeddings",
        "/responses",
        "/chat/completions",
        "/embeddings",
    ):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
            break
    base = base.rstrip("/")
    if base.endswith("/openai/v1"):
        return base
    if "/openai/v1" in base:
        return base.split("/openai/v1")[0].rstrip("/") + "/openai/v1"
    return f"{base}/openai/v1"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "Nutrion API"
    debug: bool = True
    cors_origins: str = "http://localhost:3000"

    # Prefer DATABASE_URL. Supabase: Project Settings → Database → URI
    database_url: str = DEFAULT_SQLITE_URL
    # None = auto (TLS on for Postgres / Supabase)
    database_ssl: bool | None = None
    # Set false on networks that MITM TLS (campus/corporate proxies)
    database_ssl_verify: bool = True

    # Optional Supabase project metadata (auth/storage later)
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""

    chroma_path: str = str(DATA_DIR / "chroma")
    upload_dir: str = str(DATA_DIR / "uploads")

    # Account B — Azure OpenAI / Foundry model deployment
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    azure_ai_project_endpoint: str = ""
    azure_openai_chat_deployment: str = "gpt-5-mini"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    # Account A — Content Understanding (OCR / docs)
    azure_content_endpoint: str = ""
    azure_content_api_key: str = ""
    azure_content_analyzer: str = "prebuilt-layout"
    azure_content_api_version: str = "2025-11-01"

    # Kimi / Moonshot Vision — food photo analysis
    kimi_api_key: str = ""
    kimi_base_url: str = "https://api.moonshot.ai/v1"
    kimi_vision_model: str = "kimi-k3"

    use_live_ai: bool = True
    allow_stub_embeddings: bool = True
    rag_top_k: int = 5

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_db_url(cls, value: object) -> str:
        return normalize_database_url(str(value or ""))

    @field_validator("database_ssl", mode="before")
    @classmethod
    def _empty_ssl_to_none(cls, value: object) -> object:
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == "":
            return None
        return value

    @field_validator("database_ssl_verify", mode="before")
    @classmethod
    def _empty_ssl_verify_default(cls, value: object) -> object:
        if value is None:
            return True
        if isinstance(value, str) and value.strip() == "":
            return True
        return value

    @computed_field  # type: ignore[prop-decorator]
    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def uses_supabase(self) -> bool:
        host = self.database_url.lower()
        return (
            "supabase.co" in host
            or "supabase.com" in host
            or bool(self.supabase_url.strip())
        )

    @property
    def ssl_enabled(self) -> bool:
        if self.database_ssl is not None:
            return bool(self.database_ssl)
        return self.is_postgres

    @property
    def has_azure_key(self) -> bool:
        return bool(self.azure_openai_api_key.strip())

    @property
    def has_content_key(self) -> bool:
        return bool(self.azure_content_api_key.strip())

    @property
    def live_ai_enabled(self) -> bool:
        return self.use_live_ai and self.has_azure_key

    @property
    def content_understanding_enabled(self) -> bool:
        return self.has_content_key and bool(self.azure_content_endpoint.strip())

    @property
    def has_kimi_key(self) -> bool:
        return bool(self.kimi_api_key.strip())

    @property
    def kimi_vision_enabled(self) -> bool:
        return self.use_live_ai and self.has_kimi_key

    @property
    def openai_api_key(self) -> str:
        return self.azure_openai_api_key

    @property
    def openai_base_url(self) -> str:
        return self.foundry_openai_base

    @property
    def chat_model(self) -> str:
        return self.azure_openai_chat_deployment

    @property
    def embedding_model(self) -> str:
        return self.azure_openai_embedding_deployment

    @property
    def content_base_url(self) -> str:
        return self.azure_content_endpoint.rstrip("/")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def foundry_api_key(self) -> str:
        return self.azure_openai_api_key

    @computed_field  # type: ignore[prop-decorator]
    @property
    def foundry_openai_base(self) -> str:
        raw = self.azure_openai_endpoint
        if not raw:
            return ""
        return _normalize_openai_v1_base(raw)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def chat_deployment(self) -> str:
        return self.azure_openai_chat_deployment or "gpt-5-mini"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def embedding_deployment(self) -> str:
        return self.azure_openai_embedding_deployment or "text-embedding-3-small"

    @property
    def foundry_configured(self) -> bool:
        return bool(self.foundry_api_key and self.foundry_openai_base)


settings = Settings()
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.chroma_path).mkdir(parents=True, exist_ok=True)
