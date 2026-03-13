import json
from db import get_write_conn


def create_session(user_id: str, title: str = "New Chat") -> str:
    """Create a new chat session. Returns session_id."""
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO chat_session (user_id, title) VALUES (%s, %s) RETURNING session_id",
            (user_id, title),
        )
        return str(cur.fetchone()["session_id"])


def load_history(session_id: str, limit: int = 20) -> list[dict]:
    """Load recent messages for a session, oldest first.

    Returns list of {"role": str, "content": str, "chart_data": dict|None}.
    """
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT role, content, chart_data
            FROM chat_message
            WHERE session_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (session_id, limit),
        )
        rows = cur.fetchall()

    # Reverse so oldest first
    rows.reverse()
    return [
        {
            "role": r["role"],
            "content": r["content"],
            "chart_data": r["chart_data"],
        }
        for r in rows
    ]


def save_message(
    session_id: str,
    role: str,
    content: str,
    chart_data: dict | None = None,
    metadata: dict | None = None,
) -> str:
    """Save a message to the database. Returns message_id."""
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO chat_message (session_id, role, content, chart_data, metadata)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING message_id
            """,
            (
                session_id,
                role,
                content,
                json.dumps(chart_data) if chart_data else None,
                json.dumps(metadata or {}),
            ),
        )
        msg_id = str(cur.fetchone()["message_id"])

    # Update session timestamp
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE chat_session SET updated_at = now() WHERE session_id = %s",
            (session_id,),
        )

    return msg_id


def get_user_sessions(user_id: str, limit: int = 20) -> list[dict]:
    """List sessions for a user, most recent first."""
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT session_id, title, created_at, updated_at
            FROM chat_session
            WHERE user_id = %s
            ORDER BY updated_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
        return [
            {
                "session_id": str(r["session_id"]),
                "title": r["title"],
                "created_at": str(r["created_at"]),
                "updated_at": str(r["updated_at"]),
            }
            for r in cur.fetchall()
        ]


def get_session_messages(session_id: str) -> list[dict]:
    """Get all messages for a session, oldest first."""
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT message_id, role, content, chart_data, metadata, created_at
            FROM chat_message
            WHERE session_id = %s
            ORDER BY created_at ASC
            """,
            (session_id,),
        )
        return [
            {
                "message_id": str(r["message_id"]),
                "role": r["role"],
                "content": r["content"],
                "chart_data": r["chart_data"],
                "metadata": r["metadata"],
                "created_at": str(r["created_at"]),
            }
            for r in cur.fetchall()
        ]


def verify_session_owner(session_id: str, user_id: str) -> bool:
    """Check that a session belongs to the given user."""
    conn = get_write_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM chat_session WHERE session_id = %s AND user_id = %s",
            (session_id, user_id),
        )
        return cur.fetchone() is not None
