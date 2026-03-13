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
