"""Test different Supabase connection methods.

Set whichever of these you want to exercise (see lambda-agent/.env.example):
  SUPABASE_DB_URL          transaction pooler, port 6543
  SUPABASE_DB_SESSION_URL  session pooler, port 5432
  SUPABASE_DB_DIRECT_URL   direct connection, port 5432
"""
import os

import psycopg2
from psycopg2.extras import RealDictCursor

CANDIDATES = [
    ("Transaction pooler (6543)", "SUPABASE_DB_URL"),
    ("Session pooler (5432)", "SUPABASE_DB_SESSION_URL"),
    ("Direct connection", "SUPABASE_DB_DIRECT_URL"),
]

TESTS = [(name, os.environ[var]) for name, var in CANDIDATES if os.environ.get(var)]
if not TESTS:
    raise SystemExit("Set at least one of: " + ", ".join(var for _, var in CANDIDATES))

for name, dsn in TESTS:
    print(f"\n--- {name} ---")
    try:
        conn = psycopg2.connect(dsn, cursor_factory=RealDictCursor, connect_timeout=10)
        conn.autocommit = True
        with conn.cursor() as cur:
            # Test read
            cur.execute("SELECT COUNT(*) as cnt FROM snag")
            print(f"  Read OK: {cur.fetchone()['cnt']} snags")

            # Test write
            cur.execute(
                "INSERT INTO chat_session (user_id, title) VALUES (%s, %s) RETURNING session_id",
                ("102d3f28-c91e-456d-9d37-b6de042bd5a8", "conn test"),
            )
            sid = cur.fetchone()["session_id"]
            print(f"  Write OK: session {sid}")
            cur.execute("DELETE FROM chat_session WHERE session_id = %s", (str(sid),))
            print("  Cleanup OK")
        conn.close()
    except Exception as e:
        print(f"  FAILED: {e}")
