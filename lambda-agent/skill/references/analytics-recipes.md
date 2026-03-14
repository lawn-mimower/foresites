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

**Q2 — Overdue assignments (in progress but not resolved, estimate exceeded)**
```sql
SELECT st.site_name, u.username AS assigned_to, sa.assigner_remarks,
       sa.time_requested, sa.acknowledged_at,
       NOW() - sa.acknowledged_at AS elapsed
FROM snag_assignment sa
JOIN site st ON sa.site_id = st.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status = 'in_progress'
  AND sa.acknowledged_at IS NOT NULL
  AND sa.acknowledged_at + sa.time_requested < NOW()
ORDER BY elapsed DESC
LIMIT 30
```

**Q3 — Pending proof reviews (awaiting Sr. Eng approval)**
```sql
SELECT st.site_name, u.username AS assigned_to, sa.assigner_remarks, sa.status
FROM snag_assignment sa
JOIN site st ON sa.site_id = st.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status = 'in_review'
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
ORDER BY hours_since_assigned DESC
LIMIT 20
```

**Q2 — Engineers with most open assignments**
```sql
SELECT u.username, u.designation, COUNT(*) AS open_count
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status NOT IN ('resolved')
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

**Q3 — Rejected assignments (quality of fixes)**
```sql
SELECT u.username, COUNT(*) AS rejections, sa.rejection_remarks
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.status = 'rejected'
GROUP BY u.username, sa.rejection_remarks
ORDER BY rejections DESC
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
       COUNT(*) FILTER (WHERE sa.status IN ('open', 'in_progress')) AS active,
       COUNT(*) FILTER (WHERE sa.status = 'rejected') AS rejected
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
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

## Recipe Behavior Rules

1. **Always run all queries in a recipe** — partial reports are worse than no report.
2. **Synthesize, don't dump** — the narrative summary is the deliverable, not the raw tables.
3. **Chart the key finding** — pick 1-2 charts per recipe, not one per query.
4. **Flag anomalies** — sudden spikes, engineers with 0 resolutions, sites with 100% pending.
5. **Use readable names** — "Safety Compliance" not "safety_compliance", site names not UUIDs.
6. **If a recipe query returns no rows**, note it positively: "No overdue assignments — all on track."
7. **Adapt to scope** — if the user names a specific site, add `WHERE site_id = (SELECT id FROM site WHERE site_name ILIKE '%name%')` to all queries.
