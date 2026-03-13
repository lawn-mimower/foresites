# Database Schema

## site
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| site_name | TEXT | |
| site_manager | TEXT | |
| passphrase | TEXT | **DO NOT expose** |
| date_of_start | DATE | |
| created_at | TIMESTAMPTZ | |

## snag
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| reporter_name | TEXT | Reporter name |
| phone_number | NUMERIC | Reporter phone |
| site_id | UUID, FK → site.id | |
| category | TEXT | One of: safety_compliance, design_quality, resource_availability, workflow_efficiency, other |
| feedback | TEXT | The issue description |
| suggestion | TEXT | Suggested fix |
| status | TEXT | "pending" or "resolved" |
| feedback_type | TEXT | "text", "image", or "voice" |
| image_url | TEXT | S3 key or URL (for image snags) |
| voice_url | TEXT | S3 key (for voice snags) |
| transcription | TEXT | Voice note transcription |
| created_at | TIMESTAMPTZ | |
| assigned_at | TIMESTAMPTZ | When resolved |

## snag_assignment
| Column | Type | Notes |
|--------|------|-------|
| assignment_id | UUID, PK | |
| snag_id | UUID, FK → snag.id | |
| site_id | UUID, FK → site.id | |
| assigned_user_id | UUID, FK → website_user.user_id | Jr. Engineer assigned to fix |
| assigned_at | TIMESTAMPTZ | When Sr. Eng assigned |
| acknowledged_at | TIMESTAMPTZ | When Jr. Eng acknowledged via WhatsApp |
| time_requested | INTERVAL | Jr. Eng's resolution estimate (e.g. '4 hours', '2 days') |
| status | TEXT | "open", "acknowledged", "in_progress", "proof_submitted", "resolved", "rejected" |
| description | TEXT | Task instruction from Sr. Eng |
| proof | TEXT | S3 key of completion photo from Jr. Eng |
| resolved_at | TIMESTAMPTZ | When Sr. Eng approved |
| rejection_remarks | TEXT | Why Sr. Eng rejected proof (if rejected) |

## website_user
| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID, PK | |
| username | TEXT | |
| email | TEXT | |
| password_hash | TEXT | **DO NOT expose** |
| role | TEXT | "Jr. engineer", "Sr. engineer", "Super admin", etc. |
| department | TEXT | |
| designation | TEXT | |
| site_id | UUID, FK → site.id | |
| created_at | TIMESTAMPTZ | |

## todo
| Column | Type | Notes |
|--------|------|-------|
| id | UUID, PK | |
| user_id | UUID, FK → website_user.user_id | Jr. Eng assigned the task |
| action_item | TEXT | Concrete daily/weekly target |
| status | TEXT | "pending", "in_progress", "completed" |
| notes | TEXT | Context or instructions |
| open_date | TIMESTAMPTZ | When task was opened |
| expected_closing_date | TIMESTAMPTZ | Deadline |
| closed_date | TIMESTAMPTZ | When completed (NULL if open) |
| created_at | TIMESTAMPTZ | |

## Category Name Mapping

When displaying categories to users, use these readable names:

| DB value | Display name |
|----------|-------------|
| safety_compliance | Safety Compliance |
| design_quality | Design Quality |
| resource_availability | Resource Availability |
| workflow_efficiency | Workflow Efficiency |
| other | Other |
