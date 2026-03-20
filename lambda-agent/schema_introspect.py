"""Introspect PostgreSQL schema at runtime with TTL cache.

Falls back to None so callers can use the hardcoded schema.md.
"""

import time
import logging
from db import get_read_conn, close_read_conn
import psycopg2

logger = logging.getLogger(__name__)

_TABLE_WHITELIST = [
    "site",
    "snag",
    "snag_assignment",
    "website_user",
    "todo",
    "impact_category_mapping",
    "chat_session",
    "chat_message",
]

# Columns to hide from the LLM
_SENSITIVE_COLUMNS = {"password_hash", "passphrase"}

_TTL_SECONDS = 30 * 60  # 30 minutes

_cached_schema: str | None = None
_cache_timestamp: float = 0.0

# ── Queries ──────────────────────────────────────────────────────────

_Q_COLUMNS = """\
SELECT table_name, column_name, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = ANY(%s)
ORDER BY table_name, ordinal_position;
"""

_Q_FOREIGN_KEYS = """\
SELECT tc.table_name, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  AND tc.table_name = ANY(%s);
"""

_Q_CHECKS = """\
SELECT c.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS constraint_def
FROM pg_constraint con
JOIN pg_class c ON con.conrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE con.contype = 'c' AND n.nspname = 'public' AND c.relname = ANY(%s);
"""

# ── Type mapping ─────────────────────────────────────────────────────

_TYPE_MAP = {
    "uuid": "UUID",
    "text": "TEXT",
    "varchar": "TEXT",
    "int4": "INTEGER",
    "int8": "BIGINT",
    "numeric": "NUMERIC",
    "float8": "DOUBLE",
    "bool": "BOOLEAN",
    "date": "DATE",
    "timestamp": "TIMESTAMP",
    "timestamptz": "TIMESTAMPTZ",
    "interval": "INTERVAL",
    "jsonb": "JSONB",
    "json": "JSON",
}


def _friendly_type(udt_name: str) -> str:
    return _TYPE_MAP.get(udt_name, udt_name.upper())


# ── Public API ───────────────────────────────────────────────────────

def get_schema() -> str | None:
    """Return cached schema markdown, re-introspecting if TTL expired.

    Returns None on failure so callers can fall back to schema.md.
    """
    global _cached_schema, _cache_timestamp

    now = time.time()
    if _cached_schema is not None and (now - _cache_timestamp) < _TTL_SECONDS:
        return _cached_schema

    result = introspect_schema()
    if result is not None:
        _cached_schema = result
        _cache_timestamp = now
        return result

    # Introspection failed — return stale cache if available
    if _cached_schema is not None:
        logger.warning("Schema introspection failed; using stale cache")
        return _cached_schema

    return None


def get_cache_timestamp() -> float:
    """Return the timestamp of the last successful introspection."""
    return _cache_timestamp


def invalidate_cache() -> None:
    """Clear cached schema (for testing)."""
    global _cached_schema, _cache_timestamp
    _cached_schema = None
    _cache_timestamp = 0.0


def introspect_schema() -> str | None:
    """Run introspection queries and return markdown, or None on failure."""
    try:
        conn = get_read_conn()
        with conn.cursor() as cur:
            cur.execute(_Q_COLUMNS, (_TABLE_WHITELIST,))
            columns = cur.fetchall()

            cur.execute(_Q_FOREIGN_KEYS, (_TABLE_WHITELIST,))
            fks = cur.fetchall()

            cur.execute(_Q_CHECKS, (_TABLE_WHITELIST,))
            checks = cur.fetchall()

        return _build_schema_markdown(columns, fks, checks)

    except psycopg2.OperationalError:
        logger.warning("Schema introspection failed (OperationalError), resetting connection")
        close_read_conn()
        return None
    except Exception:
        logger.exception("Schema introspection failed")
        return None


# ── Markdown builder ─────────────────────────────────────────────────

def _build_schema_markdown(columns, fks, checks) -> str:
    """Pure function: assemble markdown from query results."""
    if not columns:
        return None

    # Index FKs: (table, column) -> "FK → foreign_table.foreign_column"
    fk_map = {}
    for row in fks:
        key = (row["table_name"], row["column_name"])
        fk_map[key] = f"FK → {row['foreign_table']}.{row['foreign_column']}"

    # Index CHECK constraints: table -> list of constraint_def strings
    check_map: dict[str, list[str]] = {}
    for row in checks:
        check_map.setdefault(row["table_name"], []).append(row["constraint_def"])

    # Group columns by table
    tables: dict[str, list] = {}
    for row in columns:
        tbl = row["table_name"]
        col = row["column_name"]
        if col in _SENSITIVE_COLUMNS:
            continue
        tables.setdefault(tbl, []).append(row)

    # Build markdown
    parts = ["# Database Schema (auto-introspected)\n"]

    for tbl in _TABLE_WHITELIST:
        if tbl not in tables:
            continue

        parts.append(f"## {tbl}")
        parts.append("| Column | Type | Notes |")
        parts.append("|--------|------|-------|")

        # Parse check constraints for this table to extract enum-like values
        col_enums = _extract_check_enums(check_map.get(tbl, []))

        for row in tables[tbl]:
            col = row["column_name"]
            udt = row["udt_name"]
            nullable = row["is_nullable"]

            type_str = _friendly_type(udt)
            notes_parts = []

            # PK heuristic: known PK column names
            if col in ("id", "assignment_id", "user_id", "session_id", "message_id"):
                # Only mark as PK if it's the first column in the table (ordinal check)
                if row == tables[tbl][0]:
                    type_str += ", PK"

            fk = fk_map.get((tbl, col))
            if fk:
                notes_parts.append(fk)

            # Check enum values for this column
            if col in col_enums:
                notes_parts.append(f"One of: {', '.join(col_enums[col])}")

            if nullable == "YES" and col not in ("id", "assignment_id"):
                notes_parts.append("nullable")

            parts.append(f"| {col} | {type_str} | {' | '.join(notes_parts) if notes_parts else ''} |")

        parts.append("")

    return "\n".join(parts)


def _extract_check_enums(constraint_defs: list[str]) -> dict[str, list[str]]:
    """Parse CHECK constraint definitions to extract enum-like value lists.

    Example input: "CHECK ((status = ANY (ARRAY['pending'::text, 'resolved'::text])))"
    Returns: {"status": ["pending", "resolved"]}
    """
    import re

    result = {}
    for cdef in constraint_defs:
        # Match pattern: column_name = ANY (ARRAY['val1'::text, 'val2'::text, ...])
        match = re.search(
            r"\(\((\w+)\s*=\s*ANY\s*\(ARRAY\[(.*?)\]\)",
            cdef,
        )
        if match:
            col = match.group(1)
            vals_raw = match.group(2)
            vals = re.findall(r"'([^']*)'", vals_raw)
            if vals:
                result[col] = vals
            continue

        # Match pattern: column_name = 'val1' OR column_name = 'val2' ...
        match = re.search(r"\(\((\w+)\s*=\s*'", cdef)
        if match:
            col = match.group(1)
            vals = re.findall(r"'([^']*)'", cdef)
            if vals:
                result[col] = vals

    return result
