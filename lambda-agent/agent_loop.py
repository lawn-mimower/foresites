import os
import json
import re
import time
from google import genai
from google.genai import types
from google.genai.errors import ClientError, ServerError

from tools.sql_tool import execute_sql
from tools.chart_tool import build_chart, build_table, build_kpi, build_findings
from system_prompt import get_system_prompt

MAX_TOOL_ROUNDS = 8
_MAX_HISTORY_CHARS = 800_000  # ~800K chars guard for context window

# ── Cached Gemini client (saves ~150ms/warm start) ───────────────

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


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

TABLE_TOOL_DECL = types.FunctionDeclaration(
    name="build_table",
    description="Build a structured data table artifact for the artifact panel. Use when SQL results should be presented as a formatted table alongside the narrative.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "title": types.Schema(type="STRING", description="Table title."),
            "columns": types.Schema(
                type="ARRAY",
                items=types.Schema(type="STRING"),
                description="Column header labels.",
            ),
            "rows": types.Schema(
                type="ARRAY",
                items=types.Schema(
                    type="ARRAY",
                    items=types.Schema(type="STRING"),
                ),
                description="Table rows — each row is an array of string values.",
            ),
        },
        required=["title", "columns", "rows"],
    ),
)

KPI_TOOL_DECL = types.FunctionDeclaration(
    name="build_kpi",
    description="Build KPI (Key Performance Indicator) cards to display 2-5 key metrics prominently in the artifact panel. Use for headline numbers from reports.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "title": types.Schema(type="STRING", description="KPI section title."),
            "metrics": types.Schema(
                type="ARRAY",
                items=types.Schema(
                    type="OBJECT",
                    properties={
                        "label": types.Schema(type="STRING", description="Metric label."),
                        "value": types.Schema(type="STRING", description='Metric value as string (e.g. "53", "4.2 days", "87%").'),
                        "accent": types.Schema(type="STRING", description='Color accent: "red", "green", "amber", or "default".'),
                    },
                    required=["label", "value"],
                ),
                description="List of KPI metrics to display.",
            ),
        },
        required=["title", "metrics"],
    ),
)

FINDINGS_TOOL_DECL = types.FunctionDeclaration(
    name="build_findings",
    description="Build a key findings list highlighting 3-7 critical observations, anomalies, or recommendations in the artifact panel.",
    parameters=types.Schema(
        type="OBJECT",
        properties={
            "title": types.Schema(type="STRING", description="Findings section title."),
            "items": types.Schema(
                type="ARRAY",
                items=types.Schema(type="STRING"),
                description="List of finding statements.",
            ),
        },
        required=["title", "items"],
    ),
)

TOOLS = types.Tool(function_declarations=[
    SQL_TOOL_DECL, CHART_TOOL_DECL,
    TABLE_TOOL_DECL, KPI_TOOL_DECL, FINDINGS_TOOL_DECL,
])

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
    elif name == "build_table":
        return build_table(
            title=args.get("title", ""),
            columns=args.get("columns", []),
            rows=args.get("rows", []),
        )
    elif name == "build_kpi":
        return build_kpi(
            title=args.get("title", ""),
            metrics=args.get("metrics", []),
        )
    elif name == "build_findings":
        return build_findings(
            title=args.get("title", ""),
            items=args.get("items", []),
        )
    else:
        return {"error": f"Unknown tool: {name}"}


def _history_to_contents(history: list[dict]) -> list[types.Content]:
    """Convert stored chat history to Gemini Content objects.

    Appends tool-usage hints from metadata so the model has context
    about which tools were used in prior turns.
    """
    contents = []
    for msg in history:
        role = msg["role"]
        if role == "user":
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=msg["content"])],
                )
            )
        elif role == "assistant":
            text = msg["content"]
            # Append tool-usage context from metadata if available
            metadata = msg.get("metadata")
            if isinstance(metadata, dict):
                thinking = metadata.get("thinking")
                if thinking and isinstance(thinking, list):
                    tools_used = sorted(set(t.get("tool", "") for t in thinking if t.get("tool")))
                    if tools_used:
                        text += f"\n\n[Tools used: {', '.join(tools_used)}]"
            contents.append(
                types.Content(
                    role="model",
                    parts=[types.Part.from_text(text=text)],
                )
            )
    return contents


def _trim_history(history: list[dict]) -> list[dict]:
    """Drop oldest messages if combined content exceeds context window guard."""
    total = sum(len(m.get("content", "")) for m in history)
    trimmed = list(history)
    while total > _MAX_HISTORY_CHARS and len(trimmed) > 2:
        dropped = trimmed.pop(0)
        total -= len(dropped.get("content", ""))
    return trimmed


def _generate_with_retry(client, model_id, contents, system_prompt, max_attempts=3):
    """Call generate_content with exponential backoff on ServerError."""
    for attempt in range(max_attempts):
        try:
            return client.models.generate_content(
                model=model_id,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    tools=[TOOLS],
                    temperature=0.3,
                ),
            )
        except ServerError:
            if attempt == max_attempts - 1:
                raise AgentError("AI service temporarily unavailable")
            time.sleep(2 ** attempt)  # 1s, 2s, 4s
        except ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                raise RateLimitError(str(e))
            raise AgentError(str(e))


# ── Streaming generator ──────────────────────────────────────────

def run_agent_stream(user_message: str, history: list[dict], user_context: dict = None):
    """Generator that yields NDJSON event dicts for the streaming response.

    Yields events:
        {"event": "thinking", "data": {...}}    — after each tool call
        {"event": "artifacts", "data": {...}}   — collected artifacts before text
        {"event": "text", "data": {"token": str}} — streamed text tokens
        {"event": "title", "data": {"title": str}} — auto-generated title
        {"event": "done", "data": {"metadata": {...}}} — final metadata
        {"event": "_complete", "data": {...}}   — internal, not forwarded; carries
                                                   full text/artifacts/metadata for DB save
    """
    model_id = os.environ.get("GEMINI_MODEL_ID", "gemini-2.0-flash")
    client = _get_client()

    # Trim history if it exceeds context window guard
    trimmed_history = _trim_history(history)
    contents = _history_to_contents(trimmed_history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )
    )

    system_prompt = get_system_prompt()

    # Inject user context into system prompt
    if user_context:
        username = user_context.get("username", "a user")
        role = user_context.get("role", "team member")
        ctx = f"\n\nYou are assisting {username}, a {role}."
        dept = user_context.get("department")
        if dept:
            ctx += f" Department: {dept}."
        site_id = user_context.get("site_id")
        if site_id:
            ctx += " When they refer to 'my site' or 'my assignments', scope queries to their site unless they ask otherwise."
        system_prompt += ctx

    chart_data = None
    artifacts = []
    thinking = []
    start = time.time()
    tool_rounds = 0
    api_calls = 0
    sql_queries = []
    tables_accessed = set()
    usage = None

    while tool_rounds < MAX_TOOL_ROUNDS:
        response = _generate_with_retry(client, model_id, contents, system_prompt)
        api_calls += 1

        # Guard against empty/blocked responses
        if not response.candidates:
            final_text = "I wasn't able to generate a response. Please try rephrasing your question."
            yield {"event": "text", "data": {"token": final_text}}
            yield {"event": "done", "data": {"metadata": _build_metadata(
                model_id, api_calls, tool_rounds, start,
                sql_queries, tables_accessed, None,
            )}}
            yield {"event": "_complete", "data": {
                "text": final_text,
                "chart_data": chart_data,
                "artifacts": artifacts if artifacts else None,
                "thinking": thinking if thinking else None,
                "metadata": _build_metadata(
                    model_id, api_calls, tool_rounds, start,
                    sql_queries, tables_accessed, None,
                ),
            }}
            return

        candidate = response.candidates[0]
        parts = candidate.content.parts or []
        usage = getattr(response, "usage_metadata", None)
        function_calls = [p for p in parts if p.function_call]

        if not function_calls:
            # ── Final text round — stream the response ────────────
            text_parts = [p.text for p in parts if p.text]
            non_streamed_text = "\n".join(text_parts) if text_parts else "I couldn't generate a response."

            # Yield artifacts BEFORE text so the panel can render while text streams
            if artifacts:
                yield {"event": "artifacts", "data": {"artifacts": artifacts}}

            # Attempt to re-call with streaming for real token-by-token delivery
            final_text = ""
            try:
                stream_response = client.models.generate_content_stream(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        tools=[TOOLS],
                        temperature=0.3,
                    ),
                )
                hit_tool_call = False
                for chunk in stream_response:
                    if not chunk.candidates:
                        continue
                    for part in (chunk.candidates[0].content.parts or []):
                        if part.function_call:
                            # Unexpected tool call in final round — abort streaming
                            hit_tool_call = True
                            break
                        if part.text:
                            yield {"event": "text", "data": {"token": part.text}}
                            final_text += part.text
                    if hit_tool_call:
                        break

                if hit_tool_call or not final_text:
                    # Fall back to the non-streamed text
                    final_text = non_streamed_text
                    for token in _word_tokens(final_text):
                        yield {"event": "text", "data": {"token": token}}

            except Exception:
                # Streaming failed — fall back to non-streamed text
                final_text = non_streamed_text
                for token in _word_tokens(final_text):
                    yield {"event": "text", "data": {"token": token}}

            # Auto-generate a title from the first ~60 chars
            title_preview = final_text[:60].split("\n")[0]
            if title_preview:
                yield {"event": "title", "data": {"title": title_preview}}

            metadata = _build_metadata(
                model_id, api_calls, tool_rounds, start,
                sql_queries, tables_accessed, usage,
            )
            yield {"event": "done", "data": {"metadata": metadata}}

            # Internal complete event for DB save
            yield {"event": "_complete", "data": {
                "text": final_text,
                "chart_data": chart_data,
                "artifacts": artifacts if artifacts else None,
                "thinking": thinking if thinking else None,
                "metadata": metadata,
            }}
            return

        # ── Tool round — process function calls ──────────────────
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

            tool_start = time.time()
            tool_result = _dispatch_tool(fc.name, tool_args)
            tool_ms = int((time.time() - tool_start) * 1000)

            # Build and yield thinking event
            if fc.name == "execute_sql":
                row_count = tool_result.get("row_count", 0) if isinstance(tool_result, dict) else 0
                sql_preview = tool_args.get("sql", "")[:80]
                thinking_event = {
                    "tool": fc.name,
                    "description": f"Querying: {sql_preview}...",
                    "rows": row_count,
                    "ms": tool_ms,
                }
            elif fc.name.startswith("build_"):
                artifact_type = fc.name.replace("build_", "")
                thinking_event = {
                    "tool": fc.name,
                    "description": f"Building {artifact_type}: {tool_args.get('title', '')}",
                    "ms": tool_ms,
                }
            else:
                thinking_event = {
                    "tool": fc.name,
                    "description": f"Calling {fc.name}",
                    "ms": tool_ms,
                }

            thinking.append(thinking_event)
            yield {"event": "thinking", "data": thinking_event}

            # Collect artifacts
            if fc.name == "build_chart" and "error" not in tool_result:
                chart_data = tool_result  # backward compat
                artifacts.append({
                    "type": "chart",
                    "title": tool_args.get("title", "Chart"),
                    "data": tool_result,
                })
            elif fc.name in ("build_table", "build_kpi", "build_findings") and "error" not in tool_result:
                artifacts.append(tool_result)

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
    final_text = "I ran out of steps processing your request. Please try a simpler question."
    yield {"event": "text", "data": {"token": final_text}}
    metadata = _build_metadata(
        model_id, api_calls, tool_rounds, start,
        sql_queries, tables_accessed, None,
    )
    yield {"event": "done", "data": {"metadata": metadata}}
    yield {"event": "_complete", "data": {
        "text": final_text,
        "chart_data": chart_data,
        "artifacts": artifacts if artifacts else None,
        "thinking": thinking if thinking else None,
        "metadata": metadata,
    }}


def _word_tokens(text: str):
    """Split text into word-boundary tokens for fallback pseudo-streaming."""
    for word in text.split(" "):
        yield word + " "


# ── Synchronous fallback (kept for non-streaming callers) ────────

def run_agent(user_message: str, history: list[dict], user_context: dict = None) -> dict:
    """Run the agent loop (synchronous). Returns full result dict.

    Args:
        user_message: The current user message.
        history: Previous messages from memory.
        user_context: Optional dict with username, role, site_id, department.

    Returns:
        {"text": str, "chart_data": dict|None, "artifacts": list|None,
         "thinking": list|None, "metadata": dict}
    """
    model_id = os.environ.get("GEMINI_MODEL_ID", "gemini-2.0-flash")
    client = _get_client()

    # Trim history if too large
    trimmed_history = _trim_history(history)
    contents = _history_to_contents(trimmed_history)
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )
    )

    system_prompt = get_system_prompt()

    # Inject user context into system prompt
    if user_context:
        username = user_context.get("username", "a user")
        role = user_context.get("role", "team member")
        ctx = f"\n\nYou are assisting {username}, a {role}."
        dept = user_context.get("department")
        if dept:
            ctx += f" Department: {dept}."
        site_id = user_context.get("site_id")
        if site_id:
            ctx += " When they refer to 'my site' or 'my assignments', scope queries to their site unless they ask otherwise."
        system_prompt += ctx

    chart_data = None
    artifacts = []
    thinking = []
    start = time.time()
    tool_rounds = 0
    api_calls = 0
    sql_queries = []
    tables_accessed = set()

    while tool_rounds < MAX_TOOL_ROUNDS:
        response = _generate_with_retry(client, model_id, contents, system_prompt)
        api_calls += 1

        # Guard against empty/blocked responses
        if not response.candidates:
            return {
                "text": "I wasn't able to generate a response. Please try rephrasing your question.",
                "chart_data": chart_data,
                "artifacts": artifacts if artifacts else None,
                "thinking": thinking if thinking else None,
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
                "artifacts": artifacts if artifacts else None,
                "thinking": thinking if thinking else None,
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

            tool_start = time.time()
            tool_result = _dispatch_tool(fc.name, tool_args)
            tool_ms = int((time.time() - tool_start) * 1000)

            # Track thinking events
            if fc.name == "execute_sql":
                row_count = tool_result.get("row_count", 0) if isinstance(tool_result, dict) else 0
                sql_preview = tool_args.get("sql", "")[:80]
                thinking.append({
                    "tool": fc.name,
                    "description": f"Querying: {sql_preview}...",
                    "rows": row_count,
                    "ms": tool_ms,
                })
            elif fc.name.startswith("build_"):
                artifact_type = fc.name.replace("build_", "")
                thinking.append({
                    "tool": fc.name,
                    "description": f"Building {artifact_type}: {tool_args.get('title', '')}",
                    "ms": tool_ms,
                })

            # Collect artifacts
            if fc.name == "build_chart" and "error" not in tool_result:
                chart_data = tool_result  # backward compat
                artifacts.append({
                    "type": "chart",
                    "title": tool_args.get("title", "Chart"),
                    "data": tool_result,
                })
            elif fc.name in ("build_table", "build_kpi", "build_findings") and "error" not in tool_result:
                artifacts.append(tool_result)

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
        "artifacts": artifacts if artifacts else None,
        "thinking": thinking if thinking else None,
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
