# Analytics Recipes

When the user asks for a "report", "briefing", "analysis", or any of the trigger phrases below, follow the corresponding multi-query recipe. Run each query as a separate `execute_sql` call, then synthesize findings into a concise narrative with charts where appropriate.

---

## 1. Morning Briefing

**Triggers:** "morning briefing", "daily update", "what happened overnight", "good morning", "start of day report"

Run these queries in order:

**Q1 — New snags (last 24h)**
```sql
SELECT st.site_name, s.category, s.feedback, s.status, s.created_at
FROM snag s
JOIN site st ON s.site_id = st.id
WHERE s.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC
LIMIT 50
```

**Q2 — Overdue assignments (past due_date and not resolved)**
```sql
SELECT st.site_name, u.username AS assigned_to, sa.assigner_remarks,
       sa.due_date, sa.acknowledged_at,
       NOW() - sa.assigned_at AS elapsed
FROM snag_assignment sa
JOIN site st ON sa.site_id = st.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status IN ('open', 'in_progress')
  AND sa.is_active = true
  AND sa.due_date IS NOT NULL
  AND sa.due_date < NOW()
ORDER BY sa.due_date ASC
LIMIT 30
```

**Q3 — Pending proof reviews (awaiting Sr. Eng approval)**
```sql
SELECT st.site_name, u.username AS assigned_to, sa.assigner_remarks, sa.status
FROM snag_assignment sa
JOIN site st ON sa.site_id = st.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status = 'in_review'
  AND sa.is_active = true
ORDER BY sa.assigned_at
LIMIT 30
```

**Q4 — Todo status snapshot**
```sql
SELECT u.username, t.action_item, t.status, t.expected_closing_date
FROM todo t
JOIN website_user u ON t.user_id = u.user_id
WHERE t.status != 'completed'
  AND t.expected_closing_date <= CURRENT_DATE + INTERVAL '2 days'
ORDER BY t.expected_closing_date
LIMIT 30
```

**Synthesis:** Summarize as: "X new snags reported, Y assignments overdue, Z proofs awaiting review, W todos due soon." Highlight the most critical items (safety category first). Use a bar chart for new snags by site if 3+ sites have reports.

---

## 2. Bottleneck Finder

**Triggers:** "bottleneck", "what's stuck", "blockers", "delayed", "overdue"

**Q1 — Assignments stuck longest**
```sql
SELECT st.site_name, u.username AS assigned_to, s.feedback,
       sa.status, sa.assigned_at,
       EXTRACT(EPOCH FROM (NOW() - sa.assigned_at)) / 3600 AS hours_since_assigned
FROM snag_assignment sa
JOIN snag s ON sa.snag_id = s.id
JOIN site st ON sa.site_id = st.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status NOT IN ('resolved')
  AND sa.is_active = true
ORDER BY hours_since_assigned DESC
LIMIT 20
```

**Q2 — Engineers with most open assignments**
```sql
SELECT u.username, u.designation, COUNT(*) AS open_count
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status NOT IN ('resolved')
  AND sa.is_active = true
GROUP BY u.username, u.designation
ORDER BY open_count DESC
LIMIT 15
```

**Q3 — Sites with highest unresolved snag ratio**
```sql
WITH site_stats AS (
    SELECT s.site_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE s.status = 'pending') AS pending
    FROM snag s
    GROUP BY s.site_id
)
SELECT st.site_name, ss.total, ss.pending,
       ROUND(ss.pending::NUMERIC / NULLIF(ss.total, 0) * 100, 1) AS pending_pct
FROM site_stats ss
JOIN site st ON ss.site_id = st.id
ORDER BY pending_pct DESC
LIMIT 10
```

**Synthesis:** Identify the top 3 bottlenecks. Name the engineer, site, and snag. Suggest action: reassign, escalate, or check on-site. Bar chart: open assignments per engineer.

---

## 3. Safety Trends (Heinrich's Triangle)

**Triggers:** "safety", "safety trends", "safety report", "Heinrich", "incidents", "near miss"

**Context:** Heinrich's Triangle principle — high snag volume in safety_compliance = near-misses at the pyramid base. Aggressive resolution prevents escalation to actual incidents.

**Q1 — Safety snag volume over time**
```sql
SELECT DATE_TRUNC('week', created_at) AS week,
       COUNT(*) AS safety_snags
FROM snag
WHERE category = 'safety_compliance'
GROUP BY week
ORDER BY week
LIMIT 52
```

**Q2 — Safety snags by site**
```sql
SELECT st.site_name, COUNT(*) AS safety_count
FROM snag s
JOIN site st ON s.site_id = st.id
WHERE s.category = 'safety_compliance'
GROUP BY st.site_name
ORDER BY safety_count DESC
LIMIT 10
```

**Q3 — Safety resolution rate**
```sql
WITH safety AS (
    SELECT s.id,
           s.status AS snag_status,
           sa.status AS assignment_status,
           sa.resolved_at,
           s.created_at,
           EXTRACT(EPOCH FROM (sa.resolved_at - s.created_at)) / 3600 AS hours_to_resolve
    FROM snag s
    LEFT JOIN snag_assignment sa ON s.id = sa.snag_id
    WHERE s.category = 'safety_compliance'
)
SELECT COUNT(*) AS total_safety,
       COUNT(*) FILTER (WHERE snag_status = 'resolved') AS resolved,
       ROUND(AVG(hours_to_resolve) FILTER (WHERE hours_to_resolve IS NOT NULL), 1) AS avg_hours_to_resolve
FROM safety
LIMIT 1
```

**Q4 — Top reporters for safety issues (field intelligence)**
```sql
SELECT reporter_name, COUNT(*) AS reports
FROM snag
WHERE category = 'safety_compliance'
GROUP BY reporter_name
ORDER BY reports DESC
LIMIT 10
```

**Synthesis:** Frame using Heinrich's Triangle — "X safety reports this month represent near-misses. Sites with rising trends need immediate attention." Line chart for weekly trend. Bar chart for site comparison. Call out top reporter as "safety champion."

---

## 4. Site Health Score

**Triggers:** "site health", "site report", "how is [site] doing", "site overview", "site comparison"

Run per-site or across all sites:

**Q1 — Snag volume and resolution**
```sql
SELECT st.site_name,
       COUNT(s.id) AS total_snags,
       COUNT(s.id) FILTER (WHERE s.status = 'resolved') AS resolved,
       COUNT(s.id) FILTER (WHERE s.status = 'pending') AS pending,
       ROUND(COUNT(s.id) FILTER (WHERE s.status = 'resolved')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100, 1) AS resolution_pct
FROM snag s
JOIN site st ON s.site_id = st.id
GROUP BY st.site_name
ORDER BY resolution_pct ASC
LIMIT 10
```

**Q2 — Category breakdown per site**
```sql
SELECT st.site_name, s.category, COUNT(*) AS cnt
FROM snag s
JOIN site st ON s.site_id = st.id
GROUP BY st.site_name, s.category
ORDER BY st.site_name, cnt DESC
LIMIT 50
```

**Q3 — Average resolution time per site**
```sql
SELECT st.site_name,
       ROUND(AVG(EXTRACT(EPOCH FROM (sa.resolved_at - sa.assigned_at)) / 3600), 1) AS avg_hours
FROM snag_assignment sa
JOIN site st ON sa.site_id = st.id
WHERE sa.status = 'resolved' AND sa.resolved_at IS NOT NULL
GROUP BY st.site_name
ORDER BY avg_hours DESC
LIMIT 10
```

**Q4 — Staff allocation per site**
```sql
SELECT st.site_name, u.role, COUNT(*) AS staff_count
FROM website_user u
JOIN site st ON u.site_id = st.id
GROUP BY st.site_name, u.role
ORDER BY st.site_name, staff_count DESC
LIMIT 30
```

**Synthesis:** Score each site: resolution_pct (weight 40%), avg resolution time (30%), safety snag ratio (30%). Present as a ranked table. Bar chart comparing resolution rates. Flag sites below 50% resolution as "needs attention."

---

## 5. Pareto Analysis (80/20 Rule)

**Triggers:** "pareto", "80/20", "recurring", "most common", "top issues"

**Q1 — Top snag descriptions by frequency (fuzzy grouping)**
```sql
SELECT category,
       LEFT(feedback, 80) AS issue_summary,
       COUNT(*) AS occurrences
FROM snag
GROUP BY category, LEFT(feedback, 80)
ORDER BY occurrences DESC
LIMIT 20
```

**Q2 — Categories ranked by volume**
```sql
SELECT category, COUNT(*) AS cnt,
       ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM snag) * 100, 1) AS pct
FROM snag
GROUP BY category
ORDER BY cnt DESC
LIMIT 10
```

**Q3 — Rejected / revised assignments (quality of fixes)**
```sql
SELECT u.username, SUM(sa.rejection_count) AS total_rejections,
       COUNT(*) AS assignments_affected
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.rejection_count > 0 AND sa.is_active = true
GROUP BY u.username
ORDER BY total_rejections DESC
LIMIT 15
```

**Synthesis:** "The top 3 issue types account for X% of all snags — classic Pareto. Focus resolution efforts on [categories]." Pie chart for category distribution. Bar chart for top issue descriptions.

---

## 6. Engineer Performance

**Triggers:** "performance", "engineer report", "who resolved most", "team performance", "workload"

**Q1 — Resolution counts per engineer**
```sql
SELECT u.username, u.designation, u.role,
       COUNT(*) FILTER (WHERE sa.status = 'resolved') AS resolved,
       COUNT(*) FILTER (WHERE sa.status NOT IN ('resolved')) AS active,
       COUNT(*) FILTER (WHERE sa.rejection_count > 0) AS ever_rejected
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.is_active = true
GROUP BY u.username, u.designation, u.role
ORDER BY resolved DESC
LIMIT 20
```

**Q2 — Average acknowledgment time (responsiveness)**
```sql
SELECT u.username,
       ROUND(AVG(EXTRACT(EPOCH FROM (sa.acknowledged_at - sa.assigned_at)) / 3600), 1) AS avg_ack_hours,
       COUNT(*) AS assignments
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.acknowledged_at IS NOT NULL
  AND sa.is_active = true
GROUP BY u.username
ORDER BY avg_ack_hours ASC
LIMIT 15
```

**Q3 — Average resolution time**
```sql
SELECT u.username,
       ROUND(AVG(EXTRACT(EPOCH FROM (sa.resolved_at - sa.assigned_at)) / 3600), 1) AS avg_resolve_hours,
       COUNT(*) FILTER (WHERE sa.status = 'resolved') AS resolved_count
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.resolved_at IS NOT NULL
  AND sa.is_active = true
GROUP BY u.username
ORDER BY avg_resolve_hours ASC
LIMIT 15
```

**Q4 — Todo completion rate**
```sql
SELECT u.username,
       COUNT(*) AS total_todos,
       COUNT(*) FILTER (WHERE t.status = 'completed') AS completed,
       ROUND(COUNT(*) FILTER (WHERE t.status = 'completed')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS completion_pct
FROM todo t
JOIN website_user u ON t.user_id = u.user_id
GROUP BY u.username
ORDER BY completion_pct DESC
LIMIT 15
```

**Synthesis:** Rank engineers by: resolution count, avg resolution time, acknowledgment speed, todo completion rate. Bar chart comparing resolved counts. Highlight fastest responders and anyone with high rejection rates as needing support.

---

## 7. Weekly Executive Summary

**Triggers:** "weekly report", "executive summary", "weekly summary", "this week"

Combines elements from multiple recipes:

**Q1 — Week-over-week snag trend**
```sql
SELECT DATE_TRUNC('week', created_at) AS week,
       COUNT(*) AS snags
FROM snag
WHERE created_at >= NOW() - INTERVAL '8 weeks'
GROUP BY week
ORDER BY week
LIMIT 10
```

**Q2 — This week's resolution rate**
```sql
SELECT COUNT(*) AS total_this_week,
       COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_this_week,
       ROUND(COUNT(*) FILTER (WHERE status = 'resolved')::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS resolution_pct
FROM snag
WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
LIMIT 1
```

**Q3 — Top category this week**
```sql
SELECT category, COUNT(*) AS cnt
FROM snag
WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY category
ORDER BY cnt DESC
LIMIT 5
```

**Q4 — Sites needing attention**
```sql
WITH site_week AS (
    SELECT s.site_id, COUNT(*) AS new_snags,
           COUNT(*) FILTER (WHERE s.status = 'pending') AS still_pending
    FROM snag s
    WHERE s.created_at >= DATE_TRUNC('week', CURRENT_DATE)
    GROUP BY s.site_id
)
SELECT st.site_name, sw.new_snags, sw.still_pending
FROM site_week sw
JOIN site st ON sw.site_id = st.id
WHERE sw.still_pending > 0
ORDER BY sw.still_pending DESC
LIMIT 10
```

**Synthesis:** "This week: X new snags (+/- Y% vs last week), Z% resolution rate. Top issue: [category]. Sites needing attention: [list]." Line chart for 8-week trend. Keep it to 3-4 sentences for executive consumption.

---

## 8. Issue Co-occurrence

**Triggers:** "co-occurrence", "what issues travel together", "related issues", "correlated", "linked categories"

Finds category pairs that appear at the same site in the same week — indicates shared root causes.

**Q1 — Category co-occurrence pairs**
```sql
WITH snag_weeks AS (
    SELECT id, site_id, category, DATE_TRUNC('week', created_at) AS week
    FROM snag
)
SELECT a.category AS category_a, b.category AS category_b,
       COUNT(*) AS co_occurrences
FROM snag_weeks a
JOIN snag_weeks b ON a.site_id = b.site_id
  AND a.week = b.week
  AND a.category < b.category
GROUP BY a.category, b.category
ORDER BY co_occurrences DESC
LIMIT 20
```

**Q2 — Top co-occurring sites**
```sql
WITH snag_weeks AS (
    SELECT s.site_id, s.category, DATE_TRUNC('week', s.created_at) AS week
    FROM snag s
)
SELECT st.site_name, a.category AS cat_a, b.category AS cat_b,
       COUNT(*) AS times_together
FROM snag_weeks a
JOIN snag_weeks b ON a.site_id = b.site_id AND a.week = b.week AND a.category < b.category
JOIN site st ON a.site_id = st.id
GROUP BY st.site_name, a.category, b.category
ORDER BY times_together DESC
LIMIT 15
```

**Synthesis:** Present as a table of category pairs with co-occurrence count. Use `build_table` for the pair matrix. Flag the strongest pair: "Safety x Resource co-occurred X times — likely share a staffing root cause." Use `build_findings` for key insights.

---

## 9. Sequential Pattern Detection

**Triggers:** "what follows", "sequential", "chain", "predict", "after what", "what comes next"

Finds temporal sequences: after category A appears at a site, what category follows within 14 days?

**Q1 — Sequential category patterns**
```sql
WITH ordered AS (
    SELECT site_id, category, created_at,
           LEAD(category) OVER (PARTITION BY site_id ORDER BY created_at) AS next_category,
           LEAD(created_at) OVER (PARTITION BY site_id ORDER BY created_at) AS next_at
    FROM snag
)
SELECT category AS first_category, next_category AS follows_with,
       COUNT(*) AS occurrences,
       ROUND(AVG(EXTRACT(EPOCH FROM (next_at - created_at)) / 86400)::NUMERIC, 1) AS avg_gap_days
FROM ordered
WHERE next_category IS NOT NULL
  AND next_category != category
  AND next_at - created_at <= INTERVAL '14 days'
GROUP BY category, next_category
ORDER BY occurrences DESC
LIMIT 20
```

**Synthesis:** Present as a table: first_category -> follows_with (count, avg gap). Highlight predictive patterns: "When design issues appear, safety issues follow within 9 days at 70% of sites." Use `build_table` and `build_findings`.

---

## 10. Anomaly Detection

**Triggers:** "anomaly", "spike", "abnormal", "unusual", "alert", "outlier"

Z-score on weekly snag counts per site vs. that site's historical average. Flags anything >1.5 std dev above normal.

**Q1 — Anomalous sites this week**
```sql
WITH weekly AS (
    SELECT site_id, DATE_TRUNC('week', created_at) AS week, COUNT(*) AS cnt
    FROM snag
    GROUP BY site_id, DATE_TRUNC('week', created_at)
),
stats AS (
    SELECT site_id, AVG(cnt) AS avg_cnt, STDDEV(cnt) AS std_cnt
    FROM weekly
    GROUP BY site_id
),
current_week AS (
    SELECT site_id, COUNT(*) AS this_week
    FROM snag
    WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
    GROUP BY site_id
)
SELECT st.site_name, cw.this_week, ROUND(s.avg_cnt::NUMERIC, 1) AS historical_avg,
       ROUND(s.std_cnt::NUMERIC, 1) AS std_dev,
       ROUND(((cw.this_week - s.avg_cnt) / NULLIF(s.std_cnt, 0))::NUMERIC, 2) AS z_score
FROM current_week cw
JOIN stats s ON cw.site_id = s.site_id
JOIN site st ON cw.site_id = st.id
WHERE s.std_cnt > 0
ORDER BY z_score DESC
LIMIT 10
```

**Q2 — Category breakdown for anomalous sites**
```sql
WITH anomalous AS (
    SELECT site_id
    FROM (
        SELECT site_id, COUNT(*) AS this_week FROM snag
        WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)
        GROUP BY site_id
    ) cw
    JOIN (
        SELECT site_id, AVG(cnt) AS avg_cnt, STDDEV(cnt) AS std_cnt
        FROM (
            SELECT site_id, DATE_TRUNC('week', created_at) AS week, COUNT(*) AS cnt
            FROM snag GROUP BY site_id, DATE_TRUNC('week', created_at)
        ) w GROUP BY site_id
    ) s ON cw.site_id = s.site_id
    WHERE s.std_cnt > 0 AND (cw.this_week - s.avg_cnt) / s.std_cnt > 1.5
)
SELECT st.site_name, s.category, COUNT(*) AS cnt
FROM snag s
JOIN site st ON s.site_id = st.id
WHERE s.site_id IN (SELECT site_id FROM anomalous)
  AND s.created_at >= DATE_TRUNC('week', CURRENT_DATE)
GROUP BY st.site_name, s.category
ORDER BY st.site_name, cnt DESC
LIMIT 30
```

**Synthesis:** Use `build_kpi` for alert cards with site name, spike magnitude, driving categories. Flag z_score > 1.5 as warnings, > 2.0 as critical. Use `build_findings` for action items.

---

## 11. Resolution Velocity Benchmarks

**Triggers:** "velocity", "how fast", "benchmark", "resolution time", "SLA", "turnaround"

Resolution time percentiles by category — establishes baselines for SLA setting.

**Q1 — Resolution time percentiles by category**
```sql
WITH times AS (
    SELECT s.category,
           EXTRACT(EPOCH FROM (sa.resolved_at - sa.assigned_at)) / 86400 AS days_to_resolve
    FROM snag_assignment sa
    JOIN snag s ON sa.snag_id = s.id
    WHERE sa.status = 'resolved' AND sa.resolved_at IS NOT NULL
)
SELECT category,
       ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days_to_resolve))::NUMERIC, 1) AS p25_days,
       ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY days_to_resolve))::NUMERIC, 1) AS p50_days,
       ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days_to_resolve))::NUMERIC, 1) AS p75_days,
       COUNT(*) AS sample_size
FROM times
GROUP BY category
ORDER BY p50_days DESC
LIMIT 10
```

**Q2 — Resolution time by site**
```sql
WITH times AS (
    SELECT sa.site_id,
           EXTRACT(EPOCH FROM (sa.resolved_at - sa.assigned_at)) / 86400 AS days_to_resolve
    FROM snag_assignment sa
    WHERE sa.status = 'resolved' AND sa.resolved_at IS NOT NULL
)
SELECT st.site_name,
       ROUND(AVG(days_to_resolve)::NUMERIC, 1) AS avg_days,
       ROUND(MIN(days_to_resolve)::NUMERIC, 1) AS fastest,
       ROUND(MAX(days_to_resolve)::NUMERIC, 1) AS slowest,
       COUNT(*) AS resolved_count
FROM times t
JOIN site st ON t.site_id = st.id
GROUP BY st.site_name
ORDER BY avg_days DESC
LIMIT 10
```

**Synthesis:** Use `build_table` with category rows and P25/P50/P75 columns. Use `build_chart` (bar) for site comparison. Flag any category where P75 > 7 days as "needs SLA attention."

---

## 12. Repeat Site Analysis

**Triggers:** "repeat", "chronic", "worst sites", "site ranking", "problem sites", "high volume"

Snag density (snags per week since site start), weighted by dominant category.

**Q1 — Site snag density**
```sql
WITH site_metrics AS (
    SELECT s.site_id,
           COUNT(*) AS total_snags,
           GREATEST(EXTRACT(EPOCH FROM (CURRENT_DATE - MIN(s.created_at))) / 604800, 1) AS weeks_active,
           COUNT(*) FILTER (WHERE s.status = 'resolved') AS resolved
    FROM snag s
    GROUP BY s.site_id
)
SELECT st.site_name,
       sm.total_snags,
       ROUND(sm.total_snags::NUMERIC / sm.weeks_active, 1) AS snags_per_week,
       ROUND(sm.resolved::NUMERIC / NULLIF(sm.total_snags, 0) * 100, 1) AS resolution_pct,
       ROUND(sm.weeks_active::NUMERIC, 0) AS weeks_active
FROM site_metrics sm
JOIN site st ON sm.site_id = st.id
ORDER BY snags_per_week DESC
LIMIT 10
```

**Q2 — Dominant category per site**
```sql
SELECT DISTINCT ON (st.site_name) st.site_name, s.category, COUNT(*) AS cnt
FROM snag s
JOIN site st ON s.site_id = st.id
GROUP BY st.site_name, s.category
ORDER BY st.site_name, cnt DESC
LIMIT 10
```

**Synthesis:** Use `build_table` for ranked table with snags/week, resolution %, dominant category. Use `build_chart` (bar) for density comparison. Flag sites above 2x fleet average as needing structural attention.

---

## 13. Workload Imbalance

**Triggers:** "workload", "overloaded", "balance", "capacity", "redistribute", "fairness"

Active assignments per engineer vs. team average — flags overloaded individuals.

**Q1 — Engineer workload vs team average**
```sql
WITH engineer_load AS (
    SELECT sa.assigned_user_id, COUNT(*) AS active_count
    FROM snag_assignment sa
    WHERE sa.status NOT IN ('resolved')
      AND sa.is_active = true
    GROUP BY sa.assigned_user_id
),
team_stats AS (
    SELECT AVG(active_count) AS team_avg FROM engineer_load
)
SELECT u.username, u.designation, el.active_count,
       ROUND(ts.team_avg::NUMERIC, 1) AS team_avg,
       ROUND(el.active_count::NUMERIC / NULLIF(ts.team_avg, 0), 1) AS load_ratio
FROM engineer_load el
CROSS JOIN team_stats ts
JOIN website_user u ON el.assigned_user_id = u.user_id
ORDER BY el.active_count DESC
LIMIT 15
```

**Q2 — Workload by site**
```sql
SELECT st.site_name, u.username, COUNT(*) AS active_assignments
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
JOIN site st ON sa.site_id = st.id
WHERE sa.status NOT IN ('resolved')
  AND sa.is_active = true
GROUP BY st.site_name, u.username
ORDER BY active_assignments DESC
LIMIT 20
```

**Synthesis:** Use `build_chart` (bar) per engineer with active count, red line at team average. Use `build_kpi` for team stats. Flag anyone at >2x mean as overloaded. Suggest redistribution targets.

---

## 14. Priority & Impact Analysis

**Triggers:** "priority", "impact", "critical issues", "high priority", "severity"

Leverages the `priority` field on assignments and the `impact_category_mapping` table.

**Q1 — Assignment distribution by priority**
```sql
SELECT sa.priority, sa.status, COUNT(*) AS cnt
FROM snag_assignment sa
WHERE sa.is_active = true AND sa.priority IS NOT NULL
GROUP BY sa.priority, sa.status
ORDER BY sa.priority, sa.status
LIMIT 30
```

**Q2 — Impact level distribution (from category mapping)**
```sql
SELECT icm.impact_level, icm.category, COUNT(s.id) AS snag_count
FROM snag s
JOIN impact_category_mapping icm ON s.category = icm.category
GROUP BY icm.impact_level, icm.category
ORDER BY CASE icm.impact_level
    WHEN 'critical' THEN 1 WHEN 'high' THEN 2
    WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
    snag_count DESC
LIMIT 20
```

**Q3 — Unresolved high-impact snags**
```sql
SELECT st.site_name, s.category, s.feedback, s.status, icm.impact_level,
       s.created_at
FROM snag s
JOIN site st ON s.site_id = st.id
JOIN impact_category_mapping icm ON s.category = icm.category
WHERE s.status = 'pending' AND icm.impact_level IN ('critical', 'high')
ORDER BY CASE icm.impact_level WHEN 'critical' THEN 1 ELSE 2 END, s.created_at ASC
LIMIT 20
```

**Synthesis:** Use `build_kpi` for count of critical/high/medium/low unresolved snags. Use `build_chart` (bar) for priority distribution. Use `build_findings` to highlight sites with most critical unresolved items.

---

## Recipe Behavior Rules

1. **Always run all queries in a recipe** — partial reports are worse than no report.
2. **Synthesize, don't dump** — the narrative summary is the deliverable, not the raw tables.
3. **Chart the key finding** — pick 1-2 charts per recipe, not one per query.
4. **Flag anomalies** — sudden spikes, engineers with 0 resolutions, sites with 100% pending.
5. **Use readable names** — "Safety Compliance" not "safety_compliance", site names not UUIDs.
6. **If a recipe query returns no rows**, note it positively: "No overdue assignments — all on track."
7. **Adapt to scope** — if the user names a specific site, add `WHERE site_id = (SELECT id FROM site WHERE site_name ILIKE '%name%')` to all queries.
8. **Use artifact tools for reports** — for multi-query recipes, use `build_kpi` for headline numbers, `build_table` for detailed data, `build_chart` for visual trends, and `build_findings` for key takeaways. A good recipe output has 2-4 artifacts.
9. **Artifact order matters** — KPI cards first (quick wins), then chart (visual), then table (detail), then findings (action items).
10. **Always filter active assignments** — when querying current workload, open items, or bottlenecks from `snag_assignment`, add `WHERE is_active = true`. Only omit this for historical analysis (e.g., resolution time benchmarks on resolved items).
11. **Use due_date for overdue detection** — prefer `sa.due_date < NOW()` over computed estimates like `sa.acknowledged_at + sa.time_requested`.
12. **Impact-weight when possible** — if the `impact_category_mapping` table has data, join it to weight analysis by impact level. Critical safety snags should be flagged more prominently than low-impact issues.
