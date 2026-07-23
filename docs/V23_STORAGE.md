# V23 Storage

Objects are private, server-managed resources. Source paths are
`tasks/{task_id}/sources/{file_id}/source.xlsx`; export paths use `exports` and
never contain an untrusted original filename. Local storage validates size,
extension, ZIP signature and traversal before writing immutable UUID paths.

The `task-files` bucket migration deliberately creates no browser policy or
public URL. `SUPABASE_SERVICE_ROLE_KEY` is server-only, is never returned by the
API, and is not committed. Database-write failure must trigger storage deletion;
an unsuccessful compensation is reported as `STORAGE_COMPENSATION_FAILED` and
recorded for orphan cleanup.
