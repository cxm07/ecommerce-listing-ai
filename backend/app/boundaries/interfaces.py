from abc import ABC, abstractmethod
from typing import Any


class SourceAdapter(ABC):
    @abstractmethod
    def parse(self, source: bytes) -> dict[str, Any]: ...


class ExcelSourceAdapter(SourceAdapter):
    def parse(self, source: bytes) -> dict[str, Any]:
        raise NotImplementedError("Excel parsing belongs to the next workflow slice")


class OutputAdapter(ABC):
    @abstractmethod
    def export(self, payload: dict[str, Any]) -> bytes: ...


class ExcelOutputAdapter(OutputAdapter):
    def export(self, payload: dict[str, Any]) -> bytes:
        raise NotImplementedError("Excel export belongs to the next workflow slice")


class ModelProvider(ABC):
    @abstractmethod
    def generate(self, facts: dict[str, Any]) -> dict[str, Any]: ...


class MockModelProvider(ModelProvider):
    def generate(self, facts: dict[str, Any]) -> dict[str, Any]:
        return {"title": "待审核示例标题", "selling_points": [], "unsupported_claims": [], "model_metadata": {"provider": "mock"}}


class KnowledgeProvider(ABC):
    @abstractmethod
    def get_rules(self, name: str) -> str: ...


class FileKnowledgeProvider(KnowledgeProvider):
    def get_rules(self, name: str) -> str:
        raise NotImplementedError("File-backed knowledge loading belongs to the next workflow slice")


class AgentRuntime(ABC):
    @abstractmethod
    def coordinate(self, context: dict[str, Any]) -> None: ...


class NoopAgentRuntime(AgentRuntime):
    def coordinate(self, context: dict[str, Any]) -> None:
        return None


class IntegrationConnector(ABC):
    @abstractmethod
    def test_connection(self) -> bool: ...

    @abstractmethod
    def pull_data(self) -> dict[str, Any]: ...

    @abstractmethod
    def push_data(self, payload: dict[str, Any]) -> None: ...

    @abstractmethod
    def get_sync_status(self) -> dict[str, Any]: ...

    @abstractmethod
    def normalize_error(self, error: Exception) -> dict[str, str]: ...
