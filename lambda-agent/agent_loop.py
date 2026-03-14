import os
import json
import re
import time
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

from tools.sql_tool import execute_sql
from tools.chart_tool import build_chart
from system_prompt import get_system_prompt

MAX_TOOL_ROUNDS = 8


class RateLimitError(Exception):
    """Raised when the LLM API returns a rate-limit / quota error."""
    pass


class AgentError(Exception):
    """Raised when the LLM API returns a non-recoverable error."""
    pass

# Tool declarations for Gemini function calling
SQL_TOOL_DECL = types.FunctionDeclaration(
    name="execute_sql",
    description="Execute a read-only SQL query against the PostgreSQL database. Only SELECT and WITH (CTE) queries are allowed. Returns columns, rows, and row_count.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "sql": types.Schema(
                type="STRING",
                description="The SQL SELECT query to execute. Must start with SELECT or WITH. Include a LIMIT clause.",
            ),
        },
        required=["sql"],
    ),
)

CHART_TOOL_DECL = types.FunctionDeclaration(
    name="build_chart",
    description="Build a chart configuration for the frontend to render. Use when query results have 3+ data points suitable for visualization. The frontend renders charts client-side using Recharts.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "chart_type": types.Schema(
                type="STRING",
                description='Chart type: "bar", "line", "pie", or "area".',
            ),
            "title": types.Schema(
                type="STRING", description="Chart title."
            ),
            "labels": types.Schema(
                type="ARRAY",
                items=types.Schema(type="STRING"),
                description="X-axis labels (list of strings).",
            ),
            "datasets": types.Schema(
                type="ARRAY",
                items=types.Schema(
                    type="OBJECT",
                    properties={
                        "label": types.Schema(
                            type="STRING", description="Dataset label."
                        ),
                        "values": types.Schema(
                            type="ARRAY",
                            items=types.Schema(type="NUMBER"),
                            description="Data values corresponding to labels.",
                        ),
                    },
                    required=["label", "values"],
                ),
                description="One or more datasets to plot.",
            ),
            "x_label": types.Schema(
                type="STRING", description="X-axis label."
            ),
            "y_label": types.Schema(
                type="STRING", description="Y-axis label."
            ),
        },
        required=["chart_type", "title", "labels", "datasets"],
    ),
)

TOOLS = types.Tool(function_declarations=[SQL_TOOL_DECL, CHART_TOOL_DECL])

# Regex to extract table names from SQL for observability
_TABLE_RE = re.compile(r"\bFROM\s+(\w+)|\bJOIN\s+(\w+)", re.IGNORECASE)


def _extract_tables(sql: str) -> list[str]:
    """Extract table names referenced in a SQL query."""
    matches = _TABLE_RE.findall(sql)
    tables = set()
    for groups in matches:
        for g in groups:
            if g:
                tables.add(g.lower())
    return sorted(tables)


def _dispatch_tool(name: str, args: dict) -> dict:
    """Call the appropriate tool and return its result."""
    if name == "execute_sql":
        return execute_sql(args["sql"])
    elif name == "build_chart":
        return build_chart(
            chart_type=args.get("chart_type", "bar"),
            title=args.get("title", ""),
            labels=args.get("labels", []),
            datasets=args.get("datasets", []),
            x_label=args.get("x_label", ""),
            y_label=args.get("y_label", ""),
        )
    else:
        return {"error": f"Unknown tool: {name}"}


def _history_to_contents(history: list[dict]) -> list[types.Content]:
    """Convert stored chat history to Gemini Content objects."""
    contents = []
    for msg in history:
        role = msg["role"]
        # Only user and assistant (model) roles are valid for Gemini contents
        if role == "user":
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=msg["content"])],
                )
            )
        elif role == "assistant":
            contents.append(
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text=msg["content"])],
                )
            )
        # tool_call and tool_result are internal — skip for history rebuild
    return contents


def run_agent(user_message: str, history: list[dict]) -> dict:
    """Run the agent loop.

    Args:
        user_message: The current user message.
        history: Previous messages from memory.

    Returns:
        {"text": str, "chart_data": dict|None, "metadata": dict}
    """
    model_id = os.environ.get("GEMINI_MODEL_ID", "gemini-2.0-flash")

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    # Build conversation contents
    contents = _history_to_contents(history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )
    )

    system_prompt = get_system_prompt()

    chart_data = None
    start = time.time()
    tool_rounds = 0
    api_calls = 0
    sql_queries = []
    tables_accessed = set()

    while tool_rounds < MAX_TOOL_ROUNDS:
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=[TOOLS],
                    temperature=0.3,
                ),
            )
            api_calls += 1
        except ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                raise RateLimitError(str(e))
            raise AgentError(str(e))
        except ServerError as e:
            raise AgentError(str(e))

        # Guard against empty/blocked responses
        if not response.candidates:
            return {
                "text": "I wasn't able to generate a response. Please try rephrasing your question.",
                "chart_data": chart_data,
                "metadata": _build_metadata(
                    model_id, api_calls, tool_rounds, start,
                    sql_queries, tables_accessed, None,
                ),
            }

        candidate = response.candidates[0]
        parts = candidate.content.parts or []

        # Extract token usage if available
        usage = getattr(response, "usage_metadata", None)

        # Check if any part is a function call
        function_calls = [p for p in parts if p.function_call]

        if not function_calls:
            # No tool calls — extract text response
            text_parts = [p.text for p in parts if p.text]
            final_text = "\n".join(text_parts) if text_parts else "I couldn't generate a response."

            return {
                "text": final_text,
                "chart_data": chart_data,
                "metadata": _build_metadata(
                    model_id, api_calls, tool_rounds, start,
                    sql_queries, tables_accessed, usage,
                ),
            }

        # Process function calls
        contents.append(candidate.content)

        function_response_parts = []
        for part in function_calls:
            fc = part.function_call
            tool_args = dict(fc.args)

            # Track SQL queries
            if fc.name == "execute_sql" and "sql" in tool_args:
                sql = tool_args["sql"]
                sql_queries.append(sql)
                tables_accessed.update(_extract_tables(sql))

            tool_result = _dispatch_tool(fc.name, tool_args)

            if fc.name == "build_chart" and "error" not in tool_result:
                chart_data = tool_result

            function_response_parts.append(
                types.Part.from_function_response(
                    name=fc.name,
                    response=tool_result,
                )
            )

        contents.append(
            types.Content(role="user", parts=function_response_parts)
        )
        tool_rounds += 1

    # Exceeded max rounds
    return {
        "text": "I ran out of steps processing your request. Please try a simpler question.",
        "chart_data": chart_data,
        "metadata": _build_metadata(
            model_id, api_calls, tool_rounds, start,
            sql_queries, tables_accessed, None,
        ),
    }


def _build_metadata(
    model_id: str,
    api_calls: int,
    tool_rounds: int,
    start: float,
    sql_queries: list[str],
    tables_accessed: set[str],
    usage,
) -> dict:
    """Build the metadata dict for observability."""
    meta = {
        "model": model_id,
        "api_calls": api_calls,
        "tool_rounds": tool_rounds,
        "latency_ms": int((time.time() - start) * 1000),
        "sql_queries_count": len(sql_queries),
        "tables_accessed": sorted(tables_accessed),
    }

    if usage:
        meta["prompt_tokens"] = getattr(usage, "prompt_token_count", None)
        meta["response_tokens"] = getattr(usage, "candidates_token_count", None)
        meta["total_tokens"] = getattr(usage, "total_token_count", None)

    return meta
