# V23 persistence boundary

V1 continues to default to `DATA_REPOSITORY=memory`; no existing HTTP endpoint,
response envelope, or WorkflowService transition changes when this setting is
left at its default.

`PostgresRepository` is an explicit psycopg 3 / `psycopg_pool` boundary. It is
constructed only after application startup configuration is read; module import
does not connect to PostgreSQL. Each `PostgresUnitOfWork` borrows one connection,
uses one transaction, rolls back unless `commit()` is called, and returns the
connection to the pool. Task updates use `version` as their optimistic-lock
value and surface a stable `CONCURRENT_MODIFICATION` domain error.

`ActorContext` is a replaceable boundary. `StaticActorProvider` is permitted
only in development and tests. Production must later provide an authenticated
actor provider; JWT validation is deliberately outside this milestone.

`SUPABASE_DB_URL` is server-only and must not be placed in frontend variables
or committed `.env` files. Local Supabase integration is performed by CI; this
milestone does not connect to a production Supabase project. B3 will add the
storage adapter and object-store compensation boundary.
