from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


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
    chroma_path: str = str(DATA_DIR / "vector")
    upload_dir: str = str(DATA_DIR / "uploads")

    # Account B — Azure OpenAI / Foundry model deployment
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = "https://nutrion-resource.services.ai.azure.com/openai/v1"
    azure_ai_project_endpoint: str = (
        "https://nutrion-resource.services.ai.azure.com/api/projects/nutrion"
    )
    azure_openai_chat_deployment: str = "gpt-4o-mini"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    # Account A — Content Understanding (OCR / docs)
    azure_content_endpoint: str = "https://nutri-on-resource.services.ai.azure.com"
    azure_content_api_key: str = ""
    azure_content_analyzer: str = "prebuilt-layout"
    azure_content_api_version: str = "2025-11-01"

    # Kimi / Moonshot Vision — food photo analysis
    kimi_api_key: str = ""
    kimi_base_url: str = "https://api.moonshot.ai/v1"
    kimi_vision_model: str = "kimi-k3"

    use_live_ai: bool = True

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
        url = self.azure_openai_endpoint.rstrip("/")
        for suffix in ("/responses", "/chat/completions", "/embeddings"):
            if url.endswith(suffix):
                url = url[: -len(suffix)]
        return url.rstrip("/")

    @property
    def chat_model(self) -> str:
        return self.azure_openai_chat_deployment

    @property
    def embedding_model(self) -> str:
        return self.azure_openai_embedding_deployment

    @property
    def content_base_url(self) -> str:
        return self.azure_content_endpoint.rstrip("/")


settings = Settings()
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.chroma_path).mkdir(parents=True, exist_ok=True)
