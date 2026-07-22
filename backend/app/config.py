from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development")
    storage_dir: Path = Field(default=Path(__file__).resolve().parents[1] / ".local-data", validation_alias="APP_STORAGE_DIR")
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"], validation_alias="CORS_ORIGINS")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, validation_alias="MAX_UPLOAD_BYTES")
    demo_actor_id: str = Field(default="00000000-0000-0000-0000-000000000001", validation_alias="DEMO_ACTOR_ID")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
