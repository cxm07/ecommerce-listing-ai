from app.config import Settings
from app.main import create_app


def settings_with_origins(monkeypatch, value: str | None) -> Settings:
    if value is None:
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ORIGINS", value)
    return Settings()


def test_cors_origins_uses_the_safe_default(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, None)
    assert settings.cors_origins == ["http://localhost:5173"]


def test_cors_origins_accepts_a_single_origin(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, "http://localhost:5173")
    assert settings.cors_origins == ["http://localhost:5173"]


def test_cors_origins_accepts_comma_separated_values(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, "http://localhost:5173,http://127.0.0.1:5173")
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_cors_origins_strips_whitespace_and_empty_values(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, " http://localhost:5173, , http://127.0.0.1:5173, ")
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_cors_origins_accepts_a_json_array(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, '["http://localhost:5173", "http://127.0.0.1:5173"]')
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert isinstance(settings.cors_origins, list)


def test_create_app_accepts_comma_separated_cors_origins(monkeypatch) -> None:
    settings = settings_with_origins(monkeypatch, "http://localhost:5173,http://127.0.0.1:5173")
    app = create_app(settings)
    assert app.user_middleware
