-- V23-B3: private server-managed object bucket. Browser roles receive no policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-files', 'task-files', false, 10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public=false, file_size_limit=10485760,
  allowed_mime_types=excluded.allowed_mime_types;

-- No storage.objects policies are created: only the backend service role may access this bucket.
