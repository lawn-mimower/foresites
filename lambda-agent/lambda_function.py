import json
import traceback

from agent_loop import run_agent, run_agent_stream, RateLimitError, AgentError
from memory import (
    create_session,
    load_history,
    save_message,
    get_user_sessions,
    get_session_messages,
    verify_session_owner,
)
from db import close_all

MAX_MESSAGE_LENGTH = 4000


def lambda_handler(event, context):
    """AWS Lambda handler for the OMNIFEED chat agent.

    Returns standard JSON for non-streaming actions.
    Returns application/x-ndjson for the 'message' action so Express
    can split on newlines and relay as SSE events to the browser.

    Expected request body:
    {
        "action": "message" | "get_sessions" | "get_messages" | "create_session",
        "user_id": "uuid",
        "session_id": "uuid" (for message/get_messages),
        "message": "user text" (for message action),
        "title": "session title" (for create_session, optional),
        "user_context": {"username": ..., "role": ..., ...} (optional)
    }
    """
    try:
        body = _parse_body(event)
        action = body.get("action", "message")
        user_id = body.get("user_id")

        if not user_id:
            return _json_response(400, {"error": "user_id is required"})

        # ── Non-streaming actions ─────────────────────────────────
        if action == "get_sessions":
            sessions = get_user_sessions(user_id)
            return _json_response(200, {"sessions": sessions})

        elif action == "get_messages":
            session_id = body.get("session_id")
            if not session_id:
                return _json_response(400, {"error": "session_id is required"})
            if not verify_session_owner(session_id, user_id):
                return _json_response(403, {"error": "Access denied"})
            messages = get_session_messages(session_id)
            return _json_response(200, {"messages": messages})

        elif action == "create_session":
            title = body.get("title", "New Chat")
            session_id = create_session(user_id, title)
            return _json_response(200, {"session_id": session_id})

        # ── Streaming message action ──────────────────────────────
        elif action == "message":
            return _handle_message(body, user_id)

        else:
            return _json_response(400, {"error": f"Unknown action: {action}"})

    except RateLimitError:
        return _json_response(429, {"error": "AI service quota exceeded. Please wait a minute and try again."})
    except AgentError as e:
        traceback.print_exc()
        return _json_response(502, {"error": "AI service error. Please try again shortly."})
    except Exception as e:
        traceback.print_exc()
        return _json_response(500, {"error": str(e)})


def _handle_message(body: dict, user_id: str) -> dict:
    """Handle the 'message' action — runs the agent and returns NDJSON."""
    message = body.get("message", "").strip()
    session_id = body.get("session_id")

    if not message:
        return _json_response(400, {"error": "message is required"})
    if len(message) > MAX_MESSAGE_LENGTH:
        return _json_response(400, {"error": f"Message exceeds {MAX_MESSAGE_LENGTH} character limit."})

    # Auto-create session if not provided
    if not session_id:
        title = message[:50] + ("..." if len(message) > 50 else "")
        session_id = create_session(user_id, title)

    # Verify ownership
    if not verify_session_owner(session_id, user_id):
        return _json_response(403, {"error": "Access denied"})

    # Save user message
    save_message(session_id, "user", message)

    # Load conversation history (exclude the message we just saved)
    history = load_history(session_id, limit=20)
    agent_history = history[:-1] if history else []
    user_context = body.get("user_context", {})

    # Collect NDJSON lines from the streaming generator
    ndjson_lines = []
    complete_data = None

    # First line: session event
    ndjson_lines.append(json.dumps(
        {"event": "session", "data": {"session_id": session_id}},
        default=str,
    ))

    try:
        for evt in run_agent_stream(message, agent_history, user_context=user_context):
            if evt.get("event") == "_complete":
                # Internal event — not forwarded, used for DB save
                complete_data = evt["data"]
                continue
            ndjson_lines.append(json.dumps(evt, default=str))
    except RateLimitError:
        ndjson_lines.append(json.dumps(
            {"event": "error", "data": {"error": "AI service quota exceeded. Please wait a minute and try again."}},
        ))
    except AgentError:
        traceback.print_exc()
        ndjson_lines.append(json.dumps(
            {"event": "error", "data": {"error": "AI service error. Please try again shortly."}},
        ))
    except Exception as e:
        traceback.print_exc()
        ndjson_lines.append(json.dumps(
            {"event": "error", "data": {"error": str(e)}},
        ))

    # Save assistant response to DB
    if complete_data:
        stored_metadata = dict(complete_data.get("metadata") or {})
        if complete_data.get("artifacts"):
            stored_metadata["artifacts"] = complete_data["artifacts"]
        if complete_data.get("thinking"):
            stored_metadata["thinking"] = complete_data["thinking"]

        save_message(
            session_id,
            "assistant",
            complete_data.get("text", ""),
            chart_data=complete_data.get("chart_data"),
            metadata=stored_metadata,
        )

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/x-ndjson",
            "Access-Control-Allow-Origin": "*",
            "Transfer-Encoding": "chunked",
        },
        "body": "\n".join(ndjson_lines) + "\n",
    }


# ── Helpers ───────────────────────────────────────────────────────

def _parse_body(event: dict) -> dict:
    """Extract the request body from API Gateway / Function URL event."""
    if isinstance(event.get("body"), str):
        return json.loads(event["body"])
    elif isinstance(event.get("body"), dict):
        return event["body"]
    return event


def _json_response(status_code: int, body: dict) -> dict:
    """Standard JSON response for non-streaming actions."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }
