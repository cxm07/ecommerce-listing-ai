"""Static contract checks for the V23-B1 SQL migration.

This deliberately does not connect to Supabase. Run a real migration against a
non-production local/dev database before B2 introduces a repository adapter.
"""
from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = sorted((ROOT / "supabase" / "migrations").glob("*_v23_core_schema.sql"))
REQUIRED_TABLES = {
    "profiles", "role_assignments", "tasks", "task_files", "products", "skus", "issues",
    "generated_contents", "approvals", "skill_runs", "audit_logs", "templates",
    "template_versions", "template_fields", "field_mappings", "export_profiles",
    "export_records", "model_runs", "integration_runs", "idempotency_records",
}


def require(sql: str, fragment: str) -> None:
    assert fragment in sql, f"missing SQL fragment: {fragment}"


def main() -> None:
    assert len(MIGRATIONS) == 1, "expected exactly one V23 core-schema migration"
    sql = MIGRATIONS[0].read_text(encoding="utf-8").lower()
    for table in REQUIRED_TABLES:
        require(sql, f"create table public.{table} (")
        require(sql, f"alter table public.{table} enable row level security;")
    for status in ("'draft'", "'uploaded'", "'parsing'", "'waiting_product_review'", "'product_approved'", "'generating_copy'", "'waiting_copy_review'", "'approved'", "'exported'", "'failed'"):
        require(sql, status)
    for role in ("'operator'", "'reviewer'", "'admin'"):
        require(sql, role)
    for fragment in (
        "storage_path text not null unique", "price numeric(14,2)", "source_payload jsonb not null",
        "source_ref jsonb not null", "create trigger task_files_append_only", "create trigger audit_logs_append_only",
        "create trigger products_preserve_source", "unique (profile_id, role, scope)",
        "create policy templates_admin_write", "create policy export_profiles_admin_write",
        "private.current_user_has_role", "references auth.users(id)",
    ):
        require(sql, fragment)
    assert "create policy tasks_" not in sql, "browser task policies would bypass the FastAPI workflow boundary"
    assert not re.search(r"create\s+bucket|storage\.buckets", sql), "B1 must not create storage"
    print(f"V23 schema static validation passed: {MIGRATIONS[0].name}")


if __name__ == "__main__":
    main()
