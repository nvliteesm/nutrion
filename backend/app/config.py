from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Nutrion API"
    debug: bool = True
    cors_origins: str = "http://localhost:3000"

    database_url: str = f"sqlite+aiosqlite:///{(DATA_DIR / 'nutrion.db').as_posix()}"
    chroma_path: str = str(DATA_DIR / "chroma")
    upload_dir: str = str(DATA_DIR / "uploads")

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    chat_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    # When false, OCR / LLM / RAG use deterministic stubs so local dev works offline.
    use_live_ai: bool = False

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
DATA_DIR.mkdir(parents=True, exist_ok=True)
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.chroma_path).mkdir(parents=True, exist_ok=True)
