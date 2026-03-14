from skill_loader import load_system_prompt


def get_system_prompt() -> str:
    """Return the system prompt, refreshing if schema cache has advanced."""
    return load_system_prompt()
