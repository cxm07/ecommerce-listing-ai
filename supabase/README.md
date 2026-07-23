# Supabase migrations

This directory holds reviewed PostgreSQL migrations only. B1 adds the V23 core schema and initial RLS baseline in `migrations/20260723132000_v23_core_schema.sql`.

## Local workflow

1. Install/use the Supabase CLI only in a developer environment where it is already approved.
2. Start or link a **non-production** local/dev database.
3. Apply migrations using the CLI's current documented migration workflow.
4. Verify RLS policies and run the repository regression suites.

Run the credential-free structural check from the repository root:

```powershell
python scripts/validate_v23_schema.py
```

Do not commit `.env`, database passwords, access tokens, publishable keys, or service-role keys. B1 does not create a Storage bucket, connect FastAPI, or permit browser writes to workflow tables. For a disposable local database, a reset/rebuild is acceptable; any shared or production rollback requires an approved, forward-only migration or restore plan.
