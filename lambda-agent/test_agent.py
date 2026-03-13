"""Test the full agent loop locally."""
import os

os.environ["SUPABASE_DB_URL"] = "postgresql://postgres.isvtqntqjkoaaijmjxfa:***REMOVED-DB-PASSWORD***@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
os.environ["SUPABASE_DB_WRITE_URL"] = os.environ["SUPABASE_DB_URL"]
os.environ["GEMINI_API_KEY"] = "***REMOVED-GOOGLE-API-KEY***"
os.environ["GEMINI_MODEL_ID"] = "gemini-2.5-flash"

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
