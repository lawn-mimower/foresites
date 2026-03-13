"""Test different Supabase connection methods."""
import psycopg2
from psycopg2.extras import RealDictCursor

TESTS = [
    ("Transaction pooler (6543)", "postgresql://postgres.isvtqntqjkoaaijmjxfa:***REMOVED-DB-PASSWORD***@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"),
    ("Session pooler (5432)", "postgresql://postgres.isvtqntqjkoaaijmjxfa:***REMOVED-DB-PASSWORD***@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"),
    ("Direct connection", "postgresql://postgres:***REMOVED-DB-PASSWORD***@db.isvtqntqjkoaaijmjxfa.supabase.co:5432/postgres"),
]

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
