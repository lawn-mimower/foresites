import re
import json
from db import get_read_conn, close_read_conn
import psycopg2

# Blocked SQL keywords (case-insensitive)
_BLOCKED_RE = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|EXECUTE|COPY"
    r"|pg_catalog|information_schema|pg_stat"
    r"|pg_sleep|dblink|lo_import|lo_export"
    r")\b",
    re.IGNORECASE,
)

# Sensitive columns to strip from results
_SENSITIVE_COLUMNS = {"password_hash", "passphrase"}

# Max rows returned
_MAX_ROWS = 100


def _strip_comments(sql: str) -> str:
    """Remove SQL line comments (--) and block comments (/* */)."""
    # Remove block comments (non-greedy, handles nested poorly but sufficient)
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    # Remove line comments
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def _validate_query(sql: str) -> str | None:
    """Returns an error message if the query is invalid, else None."""
    # Strip comments before validation to prevent bypass
    cleaned = _strip_comments(sql)
    stripped = cleaned.strip().rstrip(";").strip()

    # Layer 1: regex blocklist
    match = _BLOCKED_RE.search(stripped)
    if match:
        return f"Blocked keyword detected: {match.group(0).upper()}. Only SELECT queries are allowed."

    # Layer 2: must start with SELECT or WITH
    upper = stripped.upper()
    if not (upper.startswith("SELECT") or upper.startswith("WITH")):
        return "Query must start with SELECT or WITH."

    # Layer 3: semicolon-in-middle check (multi-statement injection)
    if ";" in stripped:
        return "Multiple statements are not allowed. Submit one query at a time."

    return None


def _ensure_limit(sql: str) -> str:
    """Append LIMIT if not present."""
    if "LIMIT" not in sql.upper():
        sql = sql.rstrip().rstrip(";")
        sql += f" LIMIT {_MAX_ROWS}"
    return sql


def execute_sql(sql: str) -> dict:
    """Validate and execute a read-only SQL query. Returns structured result."""
    error = _validate_query(sql)
    if error:
        return {"error": error}

    sql = _ensure_limit(sql)

    for attempt in range(2):
        try:
            conn = get_read_conn()
            with conn.cursor() as cur:
                cur.execute("SET statement_timeout = '10s';")
                cur.execute(sql)
                rows = cur.fetchall()

                if not rows:
                    return {"columns": [], "rows": [], "row_count": 0}

                # Get column names, strip sensitive columns
                columns = [desc[0] for desc in cur.description]
                safe_indices = [
                    i for i, col in enumerate(columns) if col not in _SENSITIVE_COLUMNS
                ]
                safe_columns = [columns[i] for i in safe_indices]

                safe_rows = []
                for row in rows:
                    values = list(row.values())
                    safe_row = [
                        _serialize(values[i]) for i in safe_indices
                    ]
                    safe_rows.append(safe_row)

                return {
                    "columns": safe_columns,
                    "rows": safe_rows,
                    "row_count": len(safe_rows),
                }

        except psycopg2.OperationalError:
            if attempt == 0:
                # Connection likely stale — reset and retry once
                close_read_conn()
                continue
            return {"error": "Database connection failed after retry."}
        except Exception as e:
            return {"error": str(e)}

    return {"error": "Unexpected error during query execution."}


def _serialize(val):
    """Make values JSON-serializable."""
    if val is None:
        return None
    if isinstance(val, (int, float, bool, str)):
        return val
    # datetime, uuid, etc.
    return str(val)
