"""Reads skill/ directory and assembles the system prompt.

Caches the result at module level so Lambda warm starts skip I/O.
Falls back to an inline prompt if skill files are missing.
"""

import os
import re

_SKILL_DIR = os.path.join(os.path.dirname(__file__), "skill")

# Deliberate ordering — schema first, then patterns, then rules
_REFERENCE_FILES = [
    "schema.md",
    "query-patterns.md",
    "security-rules.md",
    "pgbouncer-patterns.md",
    "chart-guidelines.md",
]

_cached_prompt: str | None = None


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


def load_system_prompt() -> str:
    """Assemble the system prompt from skill/ files. Cached after first call."""
    global _cached_prompt
    if _cached_prompt is not None:
        return _cached_prompt

    skill_md = _read_file(os.path.join(_SKILL_DIR, "SKILL.md"))

    # Fallback: if SKILL.md is missing, return a minimal inline prompt
    if skill_md is None:
        _cached_prompt = (
            "You are OMNIFEED AI, an intelligent assistant for construction site management. "
            "You help users analyze snags, site data, and generate reports."
        )
        return _cached_prompt

    parts = [_strip_frontmatter(skill_md).strip()]

    refs_dir = os.path.join(_SKILL_DIR, "references")
    for filename in _REFERENCE_FILES:
        content = _read_file(os.path.join(refs_dir, filename))
        if content:
            parts.append(content.strip())

    _cached_prompt = "\n\n---\n\n".join(parts)
    return _cached_prompt
