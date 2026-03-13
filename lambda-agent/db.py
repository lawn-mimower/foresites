import os
import psycopg2
from psycopg2.extras import RealDictCursor

_read_conn = None
_write_conn = None

_KEEPALIVE_PARAMS = {
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
}


def _get_connection(dsn):
    conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor, **_KEEPALIVE_PARAMS)
    conn.autocommit = True
    return conn


def get_read_conn():
    global _read_conn
    if _read_conn is None or _read_conn.closed:
        _read_conn = _get_connection(os.environ["SUPABASE_DB_URL"])
    return _read_conn


def get_write_conn():
    global _write_conn
    if _write_conn is None or _write_conn.closed:
        _write_conn = _get_connection(os.environ["SUPABASE_DB_WRITE_URL"])
    return _write_conn


def close_read_conn():
    """Close and reset the read connection for targeted reconnection."""
    global _read_conn
    if _read_conn and not _read_conn.closed:
        _read_conn.close()
    _read_conn = None


def close_all():
    global _read_conn, _write_conn
    for conn in (_read_conn, _write_conn):
        if conn and not conn.closed:
            conn.close()
    _read_conn = None
    _write_conn = None
