from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


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

    database_url: str = f"sqlite+aiosqlite:///{(DATA_DIR / 'nutrion.db').as_posix()}"
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

    @computed_field  # type: ignore[prop-decorator]
    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

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
