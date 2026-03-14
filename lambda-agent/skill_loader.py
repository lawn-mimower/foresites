"""Reads skill/ directory and assembles the system prompt.

Caches the result at module level so Lambda warm starts skip I/O.
Falls back to an inline prompt if skill files are missing.
Schema is introspected from PostgreSQL at runtime; falls back to schema.md.
"""

import logging
import os
import re

from schema_introspect import get_schema, get_cache_timestamp

logger = logging.getLogger(__name__)

_SKILL_DIR = os.path.join(os.path.dirname(__file__), "skill")

# schema.md removed — handled via introspection + fallback
# schema-annotations.md added — human notes that can't be introspected
_REFERENCE_FILES = [
    "schema-annotations.md",
    "query-patterns.md",
    "security-rules.md",
    "pgbouncer-patterns.md",
    "chart-guidelines.md",
    "analytics-recipes.md",
]

_cached_prompt: str | None = None
_prompt_schema_timestamp: float = 0.0


def _strip_frontmatter(text: str) -> str:
    """Remove YAML frontmatter (--- ... ---) from markdown."""
    return re.sub(r"\A---\s*\n.*?\n---\s*\n", "", text, count=1, flags=re.DOTALL)


def _read_file(path: str) -> str | None:
    """Read a file and return its contents, or None if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return None


def _get_schema_section() -> str:
    """Get schema markdown: introspect from DB, fall back to schema.md."""
    schema = get_schema()
    if schema is not None:
        return schema

    logger.info("Schema introspection returned None; falling back to schema.md")
    fallback = _read_file(os.path.join(_SKILL_DIR, "references", "schema.md"))
    return fallback or ""


def load_system_prompt() -> str:
    """Assemble the system prompt from skill/ files.

    Cached after first call; cache is invalidated when the schema
    introspection cache advances past the prompt cache timestamp.
    """
    global _cached_prompt, _prompt_schema_timestamp

    schema_ts = get_cache_timestamp()
    if _cached_prompt is not None and schema_ts <= _prompt_schema_timestamp:
        return _cached_prompt

    skill_md = _read_file(os.path.join(_SKILL_DIR, "SKILL.md"))

    # Fallback: if SKILL.md is missing, return a minimal inline prompt
    if skill_md is None:
        _cached_prompt = (
            "You are OMNIFEED AI, an intelligent assistant for construction site management. "
            "You help users analyze snags, site data, and generate reports."
        )
        _prompt_schema_timestamp = schema_ts
        return _cached_prompt

    parts = [_strip_frontmatter(skill_md).strip()]

    # Schema section (introspected or fallback)
    schema_section = _get_schema_section()
    if schema_section:
        parts.append(schema_section.strip())

    # Reference files
    refs_dir = os.path.join(_SKILL_DIR, "references")
    for filename in _REFERENCE_FILES:
        content = _read_file(os.path.join(refs_dir, filename))
        if content:
            parts.append(content.strip())

    _cached_prompt = "\n\n---\n\n".join(parts)
    _prompt_schema_timestamp = schema_ts
    return _cached_prompt
