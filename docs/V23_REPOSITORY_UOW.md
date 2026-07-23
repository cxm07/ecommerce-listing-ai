# Repository and Unit of Work boundary

B2A encapsulates the V1 in-memory collections behind repository read/write methods. `WorkflowApplication` exposes task queries to routes and no route reads repository containers directly.

Every mutating application command uses a Unit of Work. The memory implementation snapshots its private maps on entry; an exception or omitted commit restores that snapshot, while commit is lock-protected. `WorkflowService` remains the sole owner of legal state transitions.

B2B will implement the same boundary with a PostgreSQL transaction, `psycopg`, server-only configuration, request/actor restrictions, and optimistic locking. B2A does not connect to PostgreSQL, Supabase Auth, or Storage.
