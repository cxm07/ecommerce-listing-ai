-- Runtime assertions for the V23-B1 migration. This script is run only against
-- the disposable local database started by CI.
begin;

do $$
declare expected text[] := array['profiles','role_assignments','tasks','task_files','products','skus','issues','generated_contents','approvals','skill_runs','audit_logs','templates','template_versions','template_fields','field_mappings','export_profiles','export_records','model_runs','integration_runs','idempotency_records']; missing_count integer;
begin
  select count(*) into missing_count from unnest(expected) name where to_regclass('public.' || name) is null;
  if missing_count <> 0 then raise exception 'missing V23 tables: %', missing_count; end if;
end $$;

do $$
begin
  if (select count(*) from pg_type where typname = 'task_status') <> 1 then raise exception 'task_status missing'; end if;
  if (select count(*) from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid where typname = 'task_status' and enumlabel = 'EXPORTED') <> 1 then raise exception 'V1 status missing'; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'templates' and policyname = 'templates_admin_write') <> 1 then raise exception 'template admin policy missing'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'audit_logs' and c.relrowsecurity) <> 1 then raise exception 'audit RLS missing'; end if;
end $$;

-- Profile rows need an auth.users parent; create disposable local auth identities.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@example.test', 'not-a-password', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', 'not-a-password', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-000000000101', 'operator'), ('00000000-0000-4000-8000-000000000102', 'admin');
insert into public.role_assignments (profile_id, role) values ('00000000-0000-4000-8000-000000000101', 'operator'), ('00000000-0000-4000-8000-000000000102', 'admin');
insert into public.tasks (id, task_name, category, creator_id) values ('00000000-0000-4000-8000-000000000201', 'Validation task', 'test', '00000000-0000-4000-8000-000000000101');
insert into public.task_files (id, task_id, storage_path, original_filename, file_kind, size_bytes) values ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', 'tasks/201/sources/301/source.xlsx', 'source.xlsx', 'source', 1);
insert into public.products (id, task_id, product_name, source_row, source_payload) values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', 'Product', 2, '{"product_name":"Product"}');
insert into public.skus (id, product_id, sku_code, source_row, source_payload) values ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000401', 'DUPLICATE', 2, '{}'), ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000401', 'DUPLICATE', 3, '{}');
insert into public.audit_logs (task_id, actor_id, action) values ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'validated');

do $$
begin
  begin insert into public.task_files (task_id, storage_path, original_filename, file_kind, size_bytes) values ('00000000-0000-4000-8000-000000000201', 'tasks/201/sources/301/source.xlsx', 'again.xlsx', 'source', 1); raise exception 'duplicate storage path allowed'; exception when unique_violation then null; end;
  begin insert into public.skus (product_id, source_row, source_payload, stock) values ('00000000-0000-4000-8000-000000000401', 4, '{}', -1); raise exception 'negative stock allowed'; exception when check_violation then null; end;
  begin update public.products set source_row = 9 where id = '00000000-0000-4000-8000-000000000401'; raise exception 'source row update allowed'; exception when sqlstate '55000' then null; end;
  begin delete from public.audit_logs where task_id = '00000000-0000-4000-8000-000000000201'; raise exception 'audit delete allowed'; exception when sqlstate '55000' then null; end;
end $$;

rollback;
