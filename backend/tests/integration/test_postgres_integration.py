import os
from uuid import uuid4

import pytest

from app.core import AuditLog, Task
from app.persistence import PostgresRepository
from app.workflow import TaskStatus


@pytest.mark.postgres_integration
def test_postgres_task_and_audit_persist_across_repository_instances() -> None:
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        if os.getenv("CI"):
            pytest.fail("CI must provide SUPABASE_DB_URL for Postgres integration tests")
        pytest.skip("SUPABASE_DB_URL is supplied by the disposable CI Supabase instance")
    actor, task_id = uuid4(), uuid4()
    repo = PostgresRepository(url, actor); repo.open()
    try:
        with repo.pool.connection() as conn:
            conn.execute("insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(%s,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',%s,'test',now(),'{}','{}',now(),now())", (actor, f"{actor}@example.test"))
            conn.execute("insert into public.profiles(id,display_name) values(%s,'integration')", (actor,)); conn.commit()
        with repo.unit_of_work() as uow:
            task = Task(task_id, "Persistent task", "test", str(actor))
            repo.add_task(task); repo.add_audit(AuditLog(uuid4(), task_id, str(actor), "task_created", None)); uow.commit()
        restored = PostgresRepository(url, actor); restored.open()
        try:
            with restored.unit_of_work():
                assert restored.get_task(task_id).status == TaskStatus.DRAFT
                assert len(restored.list_audit_logs(task_id)) == 1
                assert restored.update_task_status(task_id, 1, TaskStatus.UPLOADED) == 2
        finally: restored.close()
    finally: repo.close()
