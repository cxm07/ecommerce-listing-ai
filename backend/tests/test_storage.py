from uuid import uuid4
from app.storage import LocalStorageAdapter

def test_local_storage_uses_immutable_task_path(tmp_path):
    storage=LocalStorageAdapter(tmp_path); item=storage.put_source(uuid4(),uuid4(),"input.xlsx",b"PKtest")
    assert item.content_hash and storage.read(item.path)==b"PKtest" and storage.exists(item.path)
