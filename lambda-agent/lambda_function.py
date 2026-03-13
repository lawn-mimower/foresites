import json
import traceback

from agent_loop import run_agent, RateLimitError, AgentError
from memory import (
    create_session,
    load_history,
    save_message,
    get_user_sessions,
    get_session_messages,
    verify_session_owner,
)
from db import close_all


def lambda_handler(event, context):
    """AWS Lambda handler for the OMNIFEED chat agent.

    Expected request body:
    {
        "action": "message" | "get_sessions" | "get_messages" | "create_session",
        "user_id": "uuid",
        "session_id": "uuid" (for message/get_messages),
        "message": "user text" (for message action),
        "title": "session title" (for create_session, optional)
    }
    """
    try:
        # Parse body — API Gateway may pass string or dict
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        elif isinstance(event.get("body"), dict):
            body = event["body"]
        else:
            body = event

        action = body.get("action", "message")
        user_id = body.get("user_id")

        if not user_id:
            return _response(400, {"error": "user_id is required"})

        # Route by action
        if action == "get_sessions":
            sessions = get_user_sessions(user_id)
            return _response(200, {"sessions": sessions})

        elif action == "get_messages":
            session_id = body.get("session_id")
            if not session_id:
                return _response(400, {"error": "session_id is required"})
            if not verify_session_owner(session_id, user_id):
                return _response(403, {"error": "Access denied"})
            messages = get_session_messages(session_id)
            return _response(200, {"messages": messages})

        elif action == "create_session":
            title = body.get("title", "New Chat")
            session_id = create_session(user_id, title)
            return _response(200, {"session_id": session_id})

        elif action == "message":
            message = body.get("message", "").strip()
            session_id = body.get("session_id")

            if not message:
                return _response(400, {"error": "message is required"})

            # Auto-create session if not provided
            if not session_id:
                # Use first few words as title
                title = message[:50] + ("..." if len(message) > 50 else "")
                session_id = create_session(user_id, title)

            # Verify ownership
            if not verify_session_owner(session_id, user_id):
                return _response(403, {"error": "Access denied"})

            # Save user message
            save_message(session_id, "user", message)

            # Load conversation history
            history = load_history(session_id, limit=20)

            # Run agent (exclude the message we just saved — it's the current input)
            # History already includes it since we saved before loading,
            # so pass history without the last message as context
            agent_history = history[:-1] if history else []
            result = run_agent(message, agent_history)

            # Save assistant response
            save_message(
                session_id,
                "assistant",
                result["text"],
                chart_data=result.get("chart_data"),
                metadata=result.get("metadata"),
            )

            return _response(200, {
                "session_id": session_id,
                "response": result["text"],
                "chart_data": result.get("chart_data"),
                "metadata": result.get("metadata"),
            })

        else:
            return _response(400, {"error": f"Unknown action: {action}"})

    except RateLimitError:
        return _response(429, {"error": "AI service quota exceeded. Please wait a minute and try again."})
    except AgentError as e:
        traceback.print_exc()
        return _response(502, {"error": "AI service error. Please try again shortly."})
    except Exception as e:
        traceback.print_exc()
        return _response(500, {"error": str(e)})


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body, default=str),
    }
