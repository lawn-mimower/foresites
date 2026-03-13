# Chart Guidelines

## When to Use Charts
- Use the chart tool when query results have **3 or more data points** suitable for visualization.
- Do not chart single-value results (e.g., total count).
- Do not chart results with only 1-2 rows unless explicitly requested.

## Chart Type Selection

| Chart Type | Best For | Example |
|------------|----------|---------|
| **bar** | Comparing categories or discrete groups | Snags by category, snags by site |
| **line** | Trends over time | Snags per month, resolution rate over weeks |
| **pie** | Part-of-whole composition (≤7 slices) | Category distribution, status breakdown |
| **area** | Cumulative trends or volume over time | Cumulative snags over time |

## Labeling Standards
- **Title**: Descriptive, e.g., "Snags by Category" not "Chart 1".
- **X-axis label**: What the categories/time periods represent.
- **Y-axis label**: What is being measured (e.g., "Number of Snags").
- **Dataset labels**: Meaningful names for each series (e.g., "Pending", "Resolved").

## Formatting Tips
- Use readable category names (e.g., "Safety Compliance" not "safety_compliance").
- For time axes, format dates readably (e.g., "Jan 2026" not "2026-01-01T00:00:00Z").
- Keep pie charts to ≤7 slices; group small categories into "Other" if needed.
