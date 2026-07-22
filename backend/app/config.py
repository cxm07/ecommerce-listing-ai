from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    frontend_url: str = Field(default="http://localhost:5173")
    backend_url: str = Field(default="http://localhost:8000")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
