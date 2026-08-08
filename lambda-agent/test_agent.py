"""Test the full agent loop locally.

Requires SUPABASE_DB_URL and GEMINI_API_KEY in the environment; see
lambda-agent/.env.example.
"""
import os

# tools.sql_tool and agent_loop read these at import time.
os.environ.setdefault("SUPABASE_DB_WRITE_URL", os.environ["SUPABASE_DB_URL"])
os.environ.setdefault("GEMINI_MODEL_ID", "gemini-2.5-flash")

# Test SQL tool directly first
print("--- Test SQL tool ---")
from tools.sql_tool import execute_sql
result = execute_sql("SELECT COUNT(*) as cnt FROM snag")
print(f"SQL result: {result}")

print("\n--- Test agent loop ---")
from agent_loop import run_agent
result = run_agent("How many snags are there?", [])
print(f"Response: {result['text']}")
print(f"Tool rounds: {result['metadata']['tool_rounds']}")
print(f"Chart data: {result['chart_data']}")
