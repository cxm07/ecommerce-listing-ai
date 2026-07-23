-- V23-B1: persistent schema and defensive RLS baseline.
-- This migration creates no Storage bucket and does not change the V1 runtime state machine.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.task_status as enum (
  'DRAFT', 'UPLOADED', 'PARSING', 'WAITING_PRODUCT_REVIEW',
  'PRODUCT_APPROVED', 'GENERATING_COPY', 'WAITING_COPY_REVIEW',
  'APPROVED', 'EXPORTED', 'FAILED'
);
create type public.app_role as enum ('operator', 'reviewer', 'admin');
create type public.issue_severity as enum ('error', 'warning', 'info');
create type public.file_kind as enum ('source', 'export');
create type public.approval_kind as enum ('product', 'copy');
create type public.approval_decision as enum ('approved', 'rejected');
create type public.integration_mode as enum ('dry_run', 'confirmed_execution');
create type public.run_status as enum ('pending', 'running', 'succeeded', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  role public.app_role not null,
  scope text not null default 'company',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  unique (profile_id, role, scope)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_name text not null check (btrim(task_name) <> ''),
  category text not null check (btrim(category) <> ''),
  status public.task_status not null default 'DRAFT',
  creator_id uuid not null references public.profiles(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  check ((archived_at is null and archived_by is null) or (archived_at is not null and archived_by is not null))
);

create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  file_kind public.file_kind not null,
  content_hash text,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  product_name text,
  category text,
  material text,
  source_row integer not null check (source_row > 0),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict
);

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku_code text,
  color text,
  size text,
  price numeric(14,2),
  stock integer check (stock is null or stock >= 0),
  source_row integer not null check (source_row > 0),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  product_id uuid references public.products(id) on delete restrict,
  sku_id uuid references public.skus(id) on delete restrict,
  issue_signature text not null,
  code text not null,
  field text,
  severity public.issue_severity not null,
  message text not null,
  source_ref jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((resolved = false and resolved_at is null and resolved_by is null) or (resolved = true and resolved_at is not null and resolved_by is not null)),
  unique (task_id, issue_signature)
);

create table public.generated_contents (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  version integer not null check (version > 0),
  title text,
  selling_points jsonb not null default '[]'::jsonb,
  unsupported_claims jsonb not null default '[]'::jsonb,
  model_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (task_id, product_id, version)
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  generated_content_id uuid references public.generated_contents(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  approval_type public.approval_kind not null,
  decision public.approval_decision not null,
  comment text,
  created_at timestamptz not null default now()
);

create table public.skill_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  skill_name text not null,
  status public.run_status not null,
  input_ref jsonb not null default '{}'::jsonb,
  output_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  source_ref jsonb,
  before_summary jsonb,
  after_summary jsonb,
  created_at timestamptz not null default now()
);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  kind text not null check (btrim(kind) <> ''),
  is_enabled boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  check ((archived_at is null and archived_by is null) or (archived_at is not null and archived_by is not null))
);

create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete restrict,
  version integer not null check (version > 0),
  schema jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table public.template_fields (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  standard_field text not null,
  source_header text,
  aliases jsonb not null default '[]'::jsonb,
  data_type text not null,
  required boolean not null default false,
  validation_rules jsonb not null default '{}'::jsonb,
  display_order integer not null check (display_order >= 0),
  created_at timestamptz not null default now(),
  unique (template_version_id, standard_field),
  unique (template_version_id, display_order)
);

create table public.field_mappings (
  id uuid primary key default gen_random_uuid(),
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  direction text not null check (direction in ('source_to_standard', 'standard_to_output')),
  mappings jsonb not null,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  suggested_confidence numeric(5,4) check (suggested_confidence is null or (suggested_confidence >= 0 and suggested_confidence <= 1)),
  created_at timestamptz not null default now(),
  check ((confirmed_by is null and confirmed_at is null) or (confirmed_by is not null and confirmed_at is not null))
);

create table public.export_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  version integer not null check (version > 0),
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  configuration jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  check ((archived_at is null and archived_by is null) or (archived_at is not null and archived_by is not null)),
  unique (name, version)
);

create table public.export_records (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  export_profile_id uuid not null references public.export_profiles(id) on delete restrict,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  task_file_id uuid not null references public.task_files(id) on delete restrict,
  content_hash text,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.model_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  provider text not null,
  model text not null,
  prompt_version text,
  input_ref jsonb not null default '{}'::jsonb,
  output_ref jsonb not null default '{}'::jsonb,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  status public.run_status not null,
  error_code text,
  created_at timestamptz not null default now()
);

create table public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  connector_name text not null,
  mode public.integration_mode not null,
  parameter_summary jsonb not null default '{}'::jsonb,
  response_ref jsonb,
  status public.run_status not null,
  error_code text,
  idempotency_key text,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((mode = 'dry_run' and confirmed_by is null and confirmed_at is null) or (mode = 'confirmed_execution' and confirmed_by is not null and confirmed_at is not null))
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  operation text not null,
  resource_type text not null,
  resource_id uuid,
  idempotency_key text not null,
  request_summary jsonb not null default '{}'::jsonb,
  result_ref jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (actor_id, operation, idempotency_key)
);

create index tasks_creator_status_updated_idx on public.tasks (creator_id, status, updated_at desc);
create index tasks_active_updated_idx on public.tasks (updated_at desc) where archived_at is null;
create index task_files_task_created_idx on public.task_files (task_id, created_at desc);
create index products_task_idx on public.products (task_id);
create index skus_product_idx on public.skus (product_id);
create index issues_open_task_idx on public.issues (task_id, created_at desc) where resolved = false;
create index generated_contents_task_product_idx on public.generated_contents (task_id, product_id, created_at desc);
create index approvals_task_created_idx on public.approvals (task_id, created_at desc);
create index audit_logs_task_created_idx on public.audit_logs (task_id, created_at desc);
create index template_versions_template_version_idx on public.template_versions (template_id, version desc);
create index templates_enabled_idx on public.templates (name) where is_enabled and archived_at is null;
create index export_profiles_enabled_idx on public.export_profiles (name) where is_enabled and archived_at is null;
create index export_records_task_created_idx on public.export_records (task_id, created_at desc);
create index model_runs_task_status_idx on public.model_runs (task_id, status, created_at desc);
create index integration_runs_task_status_idx on public.integration_runs (task_id, status, created_at desc);
create index idempotency_records_lookup_idx on public.idempotency_records (actor_id, operation, idempotency_key);

create function private.set_updated_at() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin new.updated_at = now(); return new; end;
$$;

create function private.prevent_update_delete() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin raise exception '% records are append-only', tg_table_name using errcode = '55000'; end;
$$;

create function private.prevent_source_snapshot_change() returns trigger language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if new.source_row is distinct from old.source_row or new.source_payload is distinct from old.source_payload then
    raise exception 'source provenance is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create function private.current_user_has_role(required_role public.app_role) returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.profile_id = (select auth.uid()) and ra.role = required_role
  );
$$;

revoke all on function private.set_updated_at() from public;
revoke all on function private.prevent_update_delete() from public;
revoke all on function private.prevent_source_snapshot_change() from public;
revoke all on function private.current_user_has_role(public.app_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_has_role(public.app_role) to authenticated;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger skus_set_updated_at before update on public.skus for each row execute function private.set_updated_at();
create trigger templates_set_updated_at before update on public.templates for each row execute function private.set_updated_at();
create trigger export_profiles_set_updated_at before update on public.export_profiles for each row execute function private.set_updated_at();
create trigger products_preserve_source before update on public.products for each row execute function private.prevent_source_snapshot_change();
create trigger skus_preserve_source before update on public.skus for each row execute function private.prevent_source_snapshot_change();
create trigger task_files_append_only before update or delete on public.task_files for each row execute function private.prevent_update_delete();
create trigger generated_contents_append_only before update or delete on public.generated_contents for each row execute function private.prevent_update_delete();
create trigger approvals_append_only before update or delete on public.approvals for each row execute function private.prevent_update_delete();
create trigger skill_runs_append_only before update or delete on public.skill_runs for each row execute function private.prevent_update_delete();
create trigger audit_logs_append_only before update or delete on public.audit_logs for each row execute function private.prevent_update_delete();
create trigger template_versions_append_only before update or delete on public.template_versions for each row execute function private.prevent_update_delete();
create trigger template_fields_append_only before update or delete on public.template_fields for each row execute function private.prevent_update_delete();
create trigger field_mappings_append_only before update or delete on public.field_mappings for each row execute function private.prevent_update_delete();
create trigger export_records_append_only before update or delete on public.export_records for each row execute function private.prevent_update_delete();
create trigger model_runs_append_only before update or delete on public.model_runs for each row execute function private.prevent_update_delete();
create trigger integration_runs_append_only before update or delete on public.integration_runs for each row execute function private.prevent_update_delete();

-- All public tables are RLS-protected. Business workflow writes are deliberately
-- denied to browser clients; FastAPI/service_role will own those future mutations.
alter table public.profiles enable row level security;
alter table public.role_assignments enable row level security;
alter table public.tasks enable row level security;
alter table public.task_files enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.issues enable row level security;
alter table public.generated_contents enable row level security;
alter table public.approvals enable row level security;
alter table public.skill_runs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.template_fields enable row level security;
alter table public.field_mappings enable row level security;
alter table public.export_profiles enable row level security;
alter table public.export_records enable row level security;
alter table public.model_runs enable row level security;
alter table public.integration_runs enable row level security;
alter table public.idempotency_records enable row level security;

grant select on public.profiles, public.role_assignments, public.templates, public.template_versions, public.template_fields, public.export_profiles to authenticated;
grant insert, update, delete on public.templates, public.export_profiles to authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read_self on public.role_assignments for select to authenticated using (profile_id = (select auth.uid()));
create policy templates_read_enabled on public.templates for select to authenticated using ((is_enabled and archived_at is null) or (select private.current_user_has_role('admin')));
create policy template_versions_read_enabled on public.template_versions for select to authenticated using (exists (select 1 from public.templates t where t.id = template_id and ((t.is_enabled and t.archived_at is null) or (select private.current_user_has_role('admin')))));
create policy template_fields_read_enabled on public.template_fields for select to authenticated using (exists (select 1 from public.template_versions tv join public.templates t on t.id = tv.template_id where tv.id = template_version_id and ((t.is_enabled and t.archived_at is null) or (select private.current_user_has_role('admin')))));
create policy export_profiles_read_enabled on public.export_profiles for select to authenticated using ((is_enabled and archived_at is null) or (select private.current_user_has_role('admin')));
create policy templates_admin_write on public.templates for all to authenticated using ((select private.current_user_has_role('admin'))) with check ((select private.current_user_has_role('admin')));
create policy export_profiles_admin_write on public.export_profiles for all to authenticated using ((select private.current_user_has_role('admin'))) with check ((select private.current_user_has_role('admin')));

comment on table public.tasks is 'V1 task aggregate persistence. Status validation remains in WorkflowService, not database triggers.';
comment on table public.task_files is 'Append-only source/export metadata; a storage_path can never be overwritten.';
comment on table public.audit_logs is 'Append-only audit history. Browser clients receive no update/delete policy.';
comment on table public.integration_runs is 'V3 connector records only; no named platform or live connector is introduced by this migration.';
