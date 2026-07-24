import json
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="development")
    storage_dir: Path = Field(default=Path(__file__).resolve().parents[1] / ".local-data", validation_alias="APP_STORAGE_DIR")
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:5173"], validation_alias="CORS_ORIGINS")
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, validation_alias="MAX_UPLOAD_BYTES")
    demo_actor_id: str = Field(default="00000000-0000-0000-0000-000000000001", validation_alias="DEMO_ACTOR_ID")
    data_repository: str = Field(default="memory", validation_alias="DATA_REPOSITORY")
    supabase_db_url: str | None = Field(default=None, validation_alias="SUPABASE_DB_URL")
    postgres_pool_min_size: int = Field(default=1, validation_alias="POSTGRES_POOL_MIN_SIZE")
    postgres_pool_max_size: int = Field(default=5, validation_alias="POSTGRES_POOL_MAX_SIZE")
    file_storage: str = Field(default="local", validation_alias="FILE_STORAGE")
    supabase_url: str | None = Field(default=None, validation_alias="SUPABASE_URL")
    supabase_service_role_key: str | None = Field(default=None, validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    supabase_storage_bucket: str = Field(default="task-files", validation_alias="SUPABASE_STORAGE_BUCKET")
    supabase_storage_timeout_seconds: float = Field(default=10, validation_alias="SUPABASE_STORAGE_TIMEOUT_SECONDS")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                decoded = json.loads(stripped)
                if not isinstance(decoded, list):
                    raise ValueError("CORS_ORIGINS JSON value must be an array")
                value = decoded
            else:
                value = value.split(",")
        if isinstance(value, list):
            return [item.strip() for item in value if isinstance(item, str) and item.strip()]
        return value

    @field_validator("data_repository")
    @classmethod
    def validate_repository(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"memory", "postgres"}:
            raise ValueError("DATA_REPOSITORY must be memory or postgres")
        return value

    @field_validator("file_storage")
    @classmethod
    def validate_file_storage(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"local", "supabase"}:
            raise ValueError("FILE_STORAGE must be local or supabase")
        return value

    @model_validator(mode="after")
    def validate_supabase_storage_config(self) -> "Settings":
        if self.file_storage == "supabase" and not all((self.supabase_url, self.supabase_service_role_key, self.supabase_storage_bucket)):
            raise ValueError("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET are required when FILE_STORAGE=supabase")
        if self.max_upload_bytes > 10 * 1024 * 1024:
            raise ValueError("MAX_UPLOAD_BYTES cannot exceed the private bucket limit of 10485760")
        return self

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
