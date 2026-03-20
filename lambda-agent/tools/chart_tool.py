def build_chart(
    chart_type: str,
    title: str,
    labels: list,
    datasets: list,
    x_label: str = "",
    y_label: str = "",
) -> dict:
    """Return a structured chart config for frontend rendering via Recharts.

    Args:
        chart_type: "bar", "line", "pie", or "area"
        title: Chart title
        labels: X-axis labels (list of strings)
        datasets: List of {"label": str, "values": list[number]}
        x_label: X-axis label
        y_label: Y-axis label

    Returns:
        Structured chart config dict.
    """
    valid_types = {"bar", "line", "pie", "area"}
    if chart_type not in valid_types:
        chart_type = "bar"

    return {
        "chart_type": chart_type,
        "title": title,
        "labels": labels,
        "datasets": [
            {"label": ds.get("label", ""), "values": ds.get("values", [])}
            for ds in datasets
        ],
        "x_label": x_label,
        "y_label": y_label,
    }


def build_table(title: str, columns: list, rows: list) -> dict:
    """Build a structured data table artifact for the frontend artifact panel.

    Args:
        title: Table title
        columns: Column header labels
        rows: List of row arrays (each row is a list of string values)

    Returns:
        Artifact dict with type "table".
    """
    return {
        "type": "table",
        "title": title,
        "columns": [str(c) for c in columns],
        "rows": [[str(v) for v in row] for row in rows],
    }


def build_kpi(title: str, metrics: list) -> dict:
    """Build KPI (Key Performance Indicator) cards artifact.

    Args:
        title: KPI section title
        metrics: List of {"label": str, "value": str, "accent": str}
                 accent can be "red", "green", "amber", or "default"

    Returns:
        Artifact dict with type "kpi".
    """
    return {
        "type": "kpi",
        "title": title,
        "metrics": [
            {
                "label": str(m.get("label", "")),
                "value": str(m.get("value", "")),
                "accent": m.get("accent", "default"),
            }
            for m in metrics
        ],
    }


def build_findings(title: str, items: list) -> dict:
    """Build a key findings list artifact.

    Args:
        title: Findings section title
        items: List of finding statement strings

    Returns:
        Artifact dict with type "findings".
    """
    return {
        "type": "findings",
        "title": title,
        "items": [str(item) for item in items],
    }
