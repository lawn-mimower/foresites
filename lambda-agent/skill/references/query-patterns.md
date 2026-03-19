# Query Patterns & Best Practices

## Example Queries

### Count snags
```sql
SELECT COUNT(*) AS snag_count FROM snag LIMIT 100
```

### Snags for a site (JOIN required)
```sql
SELECT s.id, s.category, s.feedback, s.status, s.created_at
FROM snag s
JOIN site st ON s.site_id = st.id
WHERE st.site_name ILIKE '%alpha%'
LIMIT 100
```

### Snags by category
```sql
SELECT category, COUNT(*) AS snag_count
FROM snag
GROUP BY category
LIMIT 100
```

### Snags by site
```sql
SELECT st.site_name, COUNT(*) AS snag_count
FROM snag s
JOIN site st ON s.site_id = st.id
GROUP BY st.site_name
LIMIT 100
```

### Pending snags assigned to a user (JOIN required)
```sql
SELECT s.feedback, s.category, sa.status, sa.assigner_remarks
FROM snag s
JOIN snag_assignment sa ON s.id = sa.snag_id
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE u.username ILIKE '%john%' AND sa.status = 'open'
LIMIT 100
```

### Snags under revision (rejected at least once, still active)
```sql
SELECT s.id, s.feedback, s.category, sa.status, sa.rejection_count,
       sa.rejection_remarks, u.username AS assignee, st.site_name
FROM snag_assignment sa
JOIN snag s ON sa.snag_id = s.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
JOIN site st ON sa.site_id = st.id
WHERE sa.rejection_count > 0 AND sa.is_active = true
ORDER BY sa.rejection_count DESC, sa.assigned_at DESC
LIMIT 100
```

### Snags currently rejected (awaiting re-work by assignee)
```sql
SELECT s.feedback, s.category, sa.rejection_remarks, sa.rejection_count,
       u.username AS assignee, st.site_name
FROM snag_assignment sa
JOIN snag s ON sa.snag_id = s.id
JOIN website_user u ON sa.assigned_user_id = u.user_id
JOIN site st ON sa.site_id = st.id
WHERE sa.status IN ('rejected', 'in_progress') AND sa.rejection_count > 0
  AND sa.is_active = true
ORDER BY sa.rejection_count DESC
LIMIT 100
```

### Engineers with most rejections
```sql
SELECT u.username, SUM(sa.rejection_count) AS total_rejections,
       COUNT(*) FILTER (WHERE sa.rejection_count > 0) AS assignments_rejected
FROM snag_assignment sa
JOIN website_user u ON sa.assigned_user_id = u.user_id
WHERE sa.rejection_count > 0
GROUP BY u.username
ORDER BY total_rejections DESC
LIMIT 20
```

## PostgreSQL Best Practices

1. **Prefer named columns** over `SELECT *` — only fetch what's needed.
2. **Always alias aggregations** — `COUNT(*) AS snag_count`, not bare `COUNT(*)`.
3. **Use `DATE_TRUNC`** for time grouping:
   ```sql
   SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS snag_count
   FROM snag GROUP BY month ORDER BY month
   ```
4. **Use CTEs** for multi-step queries:
   ```sql
   WITH site_counts AS (
       SELECT site_id, COUNT(*) AS cnt FROM snag GROUP BY site_id
   )
   SELECT st.site_name, sc.cnt
   FROM site_counts sc
   JOIN site st ON sc.site_id = st.id
   ORDER BY sc.cnt DESC
   ```
5. **`ILIKE`** for case-insensitive matching — always use for name lookups.
6. **JOIN patterns for FK lookups**:
   - Site name: `JOIN site ON snag.site_id = site.id WHERE site.site_name ILIKE '%name%'`
   - Username: `JOIN website_user ON ... WHERE website_user.username ILIKE '%name%'`
7. **Never use `site_name` directly on the `snag` table** — it doesn't exist. Always JOIN the `site` table.
8. **Never use `username` directly on the `snag` table** — always JOIN `website_user` via `snag_assignment`.
