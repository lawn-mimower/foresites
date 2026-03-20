# Schema Annotations

Human-written notes that cannot be introspected from the database.

## Sensitive Columns

- `website_user.password_hash` — **DO NOT expose** in query results
- `site.passphrase` — **DO NOT expose** in query results

## Column Semantics

### snag
- `feedback` — the issue description reported by the worker
- `suggestion` — the reporter's suggested fix (optional)
- `image_url` — S3 key or full URL for image snags
- `voice_url` — S3 key for voice note snags
- `transcription` — voice note transcription text
- `assigned_at` — timestamp when the snag was assigned (not resolved)

### snag_assignment
- `assigner_remarks` — task instruction written by the Sr. Engineer when assigning
- `solution` — Jr. Engineer's description of the fix they applied
- `proof` — S3 key of the completion photo uploaded by Jr. Engineer
- `time_requested` — Jr. Engineer's resolution time estimate (e.g. '4 hours', '2 days')
- `due_date` — deadline set by Sr. Engineer
- `acknowledged_at` — when Jr. Engineer acknowledged assignment via WhatsApp (sets status to in_progress)
- `resolved_at` — when Sr. Engineer approved the resolution
- `rejection_remarks` — reason Sr. Engineer rejected the proof (if status = 'rejected')
- `rejection_count` — number of times this assignment has been rejected/sent back for revision. Incremented on explicit rejection AND on reassignment after closure. A snag is "under revision" when `rejection_count > 0` and the assignment is still active (`is_active = true`). To find all snags that have ever been rejected or sent back, query `rejection_count > 0`.
- `is_active` — BOOLEAN DEFAULT TRUE. TRUE for the current/live assignment, FALSE for historical or deactivated entries. **Always filter `is_active = true` when counting current workload or open items.** Only one assignment per snag should have `is_active = true`.
- `priority` — assignment priority level set by Sr. Engineer (e.g., 'high', 'medium', 'low'). May be NULL for older assignments.
- `due_date` — explicit deadline set by Sr. Engineer. Prefer this over computed overdue (e.g., `acknowledged_at + time_requested`).
- `assigner_id` — UUID of the Sr. Engineer who created this assignment (FK → website_user.user_id). Useful for "who assigns the most" analysis.

### todo
- `action_item` — concrete daily/weekly target task
- `open_date` — when the task was opened
- `expected_closing_date` — deadline
- `closed_date` — when completed (NULL if still open)

### impact_category_mapping
- `category` — snag category name (matches `snag.category` values). UNIQUE constraint.
- `impact_level` — one of: `low`, `medium`, `high`, `critical`. Configured by admins.
- `updated_by` — FK to website_user who last changed this mapping.

Use this table to weight analysis by impact. JOIN on `snag.category = impact_category_mapping.category`.

### mapping_change_log
- Audit trail for impact_category_mapping changes.
- `changed_by` — FK → website_user.user_id
- `old_impact` / `new_impact` — before/after impact level

## Category Name Mapping

When displaying categories to users, use these readable names:

| DB value | Display name |
|----------|-------------|
| safety_compliance | Safety Compliance |
| design_quality | Design Quality |
| resource_availability | Resource Availability |
| workflow_efficiency | Workflow Efficiency |
| other | Other |

The `impact_category_mapping` table allows admins to assign impact levels (low/medium/high/critical) to each category. Join this table when impact-weighted analysis is needed.
