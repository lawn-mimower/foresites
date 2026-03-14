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

### todo
- `action_item` — concrete daily/weekly target task
- `open_date` — when the task was opened
- `expected_closing_date` — deadline
- `closed_date` — when completed (NULL if still open)

## Category Name Mapping

When displaying categories to users, use these readable names:

| DB value | Display name |
|----------|-------------|
| safety_compliance | Safety Compliance |
| design_quality | Design Quality |
| resource_availability | Resource Availability |
| workflow_efficiency | Workflow Efficiency |
| other | Other |
