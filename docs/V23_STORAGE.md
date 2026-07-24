# V23 Storage

Objects are private, server-managed resources. Source paths are
`tasks/{task_id}/sources/{file_id}/source.xlsx`; export paths use `exports` and
never contain an untrusted original filename. Local storage validates size,
extension, ZIP signature and traversal before writing immutable UUID paths.

`FILE_STORAGE=local` is the default. `FILE_STORAGE=supabase` is a server-only
mode and requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_STORAGE_BUCKET`; no browser receives a service-role key, public URL,
or signed URL. `SUPABASE_STORAGE_TIMEOUT_SECONDS` defaults to 10 seconds.

Upload and export first write an immutable object, then register its `TaskFile`
inside the workflow transaction. If database registration fails, the service
deletes that newly written object. If deletion fails, the request returns
`STORAGE_COMPENSATION_FAILED`; this is not a distributed transaction guarantee,
and the structured server log records an orphan-cleanup warning without keys or
file content. `TaskFile` stores hash, size, and MIME internally; V1 workspace
responses retain their existing public file fields.

The private `task-files` bucket defaults to 10 MiB, so runtime
`MAX_UPLOAD_BYTES` cannot exceed 10 MiB. Local disposable verification uses
`supabase start`, `supabase db reset --local`, and the service role supplied by
`supabase status -o env`. Production credentials must never be committed.

The `task-files` bucket migration deliberately creates no browser policy or
public URL. `SUPABASE_SERVICE_ROLE_KEY` is server-only, is never returned by the
API, and is not committed. Database-write failure must trigger storage deletion;
an unsuccessful compensation is reported as `STORAGE_COMPENSATION_FAILED` and
recorded for orphan cleanup.
