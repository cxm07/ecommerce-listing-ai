from uuid import UUID

import pytest

from app.config import Settings
from app.core import DomainError
from app.persistence import PostgresRepository, StaticActorProvider


def test_postgres_repository_requires_connection_string() -> None:
    with pytest.raises(DomainError, match="SUPABASE_DB_URL"):
        PostgresRepository("")


def test_static_actor_is_not_allowed_in_production() -> None:
    with pytest.raises(DomainError, match="Demo Actor"):
        StaticActorProvider(UUID("00000000-0000-0000-0000-000000000001"), "production")


def test_repository_configuration_defaults_to_memory() -> None:
    assert Settings(_env_file=None).data_repository == "memory"
