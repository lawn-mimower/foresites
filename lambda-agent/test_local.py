"""Local test for the Lambda agent — tests DB connection and writes."""
import os

# Set env vars before importing anything
os.environ["SUPABASE_DB_URL"] = "postgresql://postgres.isvtqntqjkoaaijmjxfa:***REMOVED-DB-PASSWORD***@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
os.environ["SUPABASE_DB_WRITE_URL"] = os.environ["SUPABASE_DB_URL"]
os.environ["GEMINI_API_KEY"] = "***REMOVED-GOOGLE-API-KEY***"
os.environ["GEMINI_MODEL_ID"] = "gemini-2.0-flash"

from db import get_write_conn, get_read_conn

# Test 1: Basic connection
print("--- Test 1: Basic read query ---")
try:
    conn = get_read_conn()
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) as cnt FROM snag")
        result = cur.fetchone()
        print(f"Snag count: {result['cnt']}")
except Exception as e:
    print(f"FAILED: {e}")

# Test 2: Write (INSERT into chat_session)
print("\n--- Test 2: Write to chat_session ---")
try:
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO chat_session (user_id, title) VALUES (%s, %s) RETURNING session_id",
            ("102d3f28-c91e-456d-9d37-b6de042bd5a8", "Test Session"),
        )
        session_id = cur.fetchone()["session_id"]
        print(f"Created session: {session_id}")

        # Clean up
        cur.execute("DELETE FROM chat_session WHERE session_id = %s", (str(session_id),))
        print("Cleaned up test session")
except Exception as e:
    print(f"FAILED: {e}")

print("\n--- Test 3: Write with explicit commit (no autocommit) ---")
try:
    from db import close_all
    close_all()

    import psycopg2
    from psycopg2.extras import RealDictCursor
    conn = psycopg2.connect(os.environ["SUPABASE_DB_WRITE_URL"], cursor_factory=RealDictCursor)
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO chat_session (user_id, title) VALUES (%s, %s) RETURNING session_id",
            ("102d3f28-c91e-456d-9d37-b6de042bd5a8", "Test Session 2"),
        )
        session_id = cur.fetchone()["session_id"]
        conn.commit()
        print(f"Created session (explicit commit): {session_id}")

        cur.execute("DELETE FROM chat_session WHERE session_id = %s", (str(session_id),))
        conn.commit()
        print("Cleaned up test session")
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")

print("\nDone.")
