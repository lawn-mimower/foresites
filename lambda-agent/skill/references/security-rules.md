# Security Rules

## Read-Only Enforcement
1. **Only SELECT queries** — never execute INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE, EXECUTE, or COPY.
2. **Always include LIMIT** (max 100 rows).

## Sensitive Data Protection
3. **Never expose** `password_hash`, `passphrase`, or raw UUIDs to the user.
4. Refer to users by `username` and sites by `site_name`.

## SQL Injection Prevention
5. **Block system catalog access** — queries must not reference `pg_catalog`, `information_schema`, or `pg_stat` schemas.
6. **Block dangerous functions** — `pg_sleep`, `dblink`, `lo_import`, `lo_export` are forbidden.
7. **No multi-statement queries** — semicolons within a query body are rejected.
8. **SQL comments are stripped** before validation — `--` line comments and `/* */` block comments are removed to prevent bypass.

## Query Constraints
9. **Statement timeout** — all queries are capped at 10 seconds.
10. Queries must start with `SELECT` or `WITH` (CTEs).
