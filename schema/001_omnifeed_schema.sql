-- ============================================================================
-- OMNIFEED Unified Schema
-- Consolidated from live Supabase database (March 2026)
-- Run in order on a fresh Supabase project to replicate
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SITE
-- ============================================================================

CREATE TABLE site (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name       TEXT NOT NULL,
  site_manager    TEXT,
  passphrase      TEXT,
  date_of_start   DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. WEBSITE_USER
-- ============================================================================

CREATE TABLE website_user (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'user',
  department    TEXT,
  designation   TEXT,
  phone_number  TEXT,
  site_id       UUID REFERENCES site(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE website_user
  ADD CONSTRAINT website_user_role_check
  CHECK (role IN (
    'Super admin',
    'Sr. engineer',
    'Jr. engineer',
    'Trainee',
    'Safety',
    'Site dw',
    'Podium',
    'Store',
    'Sr. foreman',
    'UWT & STP',
    'admin',
    'super_admin',
    'user'
  ));

CREATE INDEX idx_user_site ON website_user(site_id);

-- ============================================================================
-- 3. SNAG
-- ============================================================================

CREATE TABLE snag (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID REFERENCES site(id) ON DELETE CASCADE,
  feedback_type   TEXT,
  feedback        TEXT,
  category        TEXT,
  transcription   TEXT,
  image_url       TEXT,
  voice_url       TEXT,
  suggestion      TEXT,
  phone_number    NUMERIC,
  reporter_name   TEXT,
  status          TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT now(),
  assigned_at     TIMESTAMPTZ
);

CREATE INDEX idx_snag_site ON snag(site_id);

-- ============================================================================
-- 4. SNAG_ASSIGNMENT
-- ============================================================================

CREATE TABLE snag_assignment (
  assignment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snag_id           UUID REFERENCES snag(id) ON DELETE CASCADE,
  site_id           UUID REFERENCES site(id) ON DELETE CASCADE,
  assigned_user_id  UUID REFERENCES website_user(user_id) ON DELETE SET NULL,
  assigner_id       UUID REFERENCES website_user(user_id),
  status            TEXT DEFAULT 'open',
  priority          TEXT,
  is_active         BOOLEAN DEFAULT TRUE,
  assigner_remarks  TEXT,
  rejection_remarks TEXT,
  rejection_count   INTEGER DEFAULT 0,
  solution          TEXT,
  proof             TEXT,
  time_requested    INTERVAL,
  due_date          TIMESTAMPTZ,
  assigned_at       TIMESTAMPTZ DEFAULT now(),
  acknowledged_at   TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ
);

ALTER TABLE snag_assignment
  ADD CONSTRAINT snag_assignment_status_check
  CHECK (status IN ('open', 'in_progress', 'in_review', 'resolved', 'rejected'));

CREATE INDEX idx_assignment_user ON snag_assignment(assigned_user_id);

-- ============================================================================
-- 5. TODO
-- ============================================================================

CREATE TABLE todo (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID REFERENCES website_user(user_id) ON DELETE CASCADE,
  action_item           TEXT NOT NULL,
  status                TEXT DEFAULT 'pending',
  notes                 TEXT,
  open_date             TIMESTAMPTZ DEFAULT now(),
  expected_closing_date TIMESTAMPTZ,
  closed_date           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE todo
  ADD CONSTRAINT todo_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed'));

-- ============================================================================
-- 6. CHAT_SESSION
-- ============================================================================

CREATE TABLE chat_session (
  session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES website_user(user_id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_session_user ON chat_session(user_id, updated_at DESC);

-- ============================================================================
-- 7. CHAT_MESSAGE
-- ============================================================================

CREATE TABLE chat_message (
  message_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_session(session_id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_call', 'tool_result')),
  content     TEXT NOT NULL,
  chart_data  JSONB,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_message_session ON chat_message(session_id, created_at);

-- ============================================================================
-- 8. IMPACT_CATEGORY_MAPPING
-- ============================================================================

CREATE TABLE impact_category_mapping (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL UNIQUE,
  impact_level TEXT NOT NULL CHECK (impact_level IN ('low', 'medium', 'high', 'critical')),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  updated_by   UUID REFERENCES website_user(user_id)
);

-- ============================================================================
-- 9. MAPPING_CHANGE_LOG
-- ============================================================================

CREATE TABLE mapping_change_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by UUID NOT NULL REFERENCES website_user(user_id),
  category   TEXT NOT NULL,
  old_impact TEXT NOT NULL,
  new_impact TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-resolve snag when assignment is resolved
CREATE OR REPLACE FUNCTION resolve_snag_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.resolved_at IS NOT NULL THEN
    UPDATE snag
    SET status = 'resolved'
    WHERE id = NEW.snag_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_snag
  AFTER UPDATE ON snag_assignment
  FOR EACH ROW
  WHEN (OLD.resolved_at IS NULL AND NEW.resolved_at IS NOT NULL)
  EXECUTE FUNCTION resolve_snag_trigger();

-- ============================================================================
-- READ-ONLY ROLE (for AI agent SQL tool)
-- ============================================================================

-- Change password before running in production
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'omnifeed_reader') THEN
    CREATE ROLE omnifeed_reader WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO omnifeed_reader;
GRANT USAGE ON SCHEMA public TO omnifeed_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO omnifeed_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO omnifeed_reader;

-- Revoke access to chat tables (private conversations)
REVOKE SELECT ON TABLE chat_session FROM omnifeed_reader;
REVOKE SELECT ON TABLE chat_message FROM omnifeed_reader;
