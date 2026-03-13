# PgBouncer-Safe SQL Patterns

Supabase routes connections through PgBouncer in **transaction mode**. This affects what SQL features are safe to use.

## Allowed
- Standard SELECT queries
- CTEs (`WITH ... AS`)
- Temporary `SET` within a single statement (e.g., `SET LOCAL statement_timeout = '10s'`)
- All standard aggregate and window functions

## Avoid
- **Persistent `SET` commands** — `SET statement_timeout` without `LOCAL` persists on the pooled connection and affects other users. Use `SET LOCAL` or `SET` within a transaction block that resets on commit.
- **`PREPARE` / `EXECUTE` statements** — prepared statements don't survive connection reassignment in transaction mode.
- **Advisory locks** (`pg_advisory_lock`) — the lock may be released when PgBouncer reassigns the connection.
- **`LISTEN` / `NOTIFY`** — requires a persistent connection; incompatible with pooling.
- **Multi-statement transactions** spanning multiple tool calls — each tool call may get a different backend connection.

## Lambda Connection Behavior
- Lambda reuses connections across warm invocations via the module-level `_read_conn` singleton.
- On cold start, a new connection is established.
- If a connection becomes stale (PgBouncer timeout, Lambda freeze > idle limit), the `sql_tool` automatically retries with a fresh connection.
- TCP keepalives (`keepalives=1, keepalives_idle=30`) detect dead connections faster than waiting for a query timeout.
