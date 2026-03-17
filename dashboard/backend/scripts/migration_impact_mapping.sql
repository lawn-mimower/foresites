-- Migration: Impact Category Mapping tables
-- Run in Supabase SQL Editor

-- Table: category → impact mapping (5 rows, one per category)
CREATE TABLE IF NOT EXISTS impact_category_mapping (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL UNIQUE,
  impact_level TEXT NOT NULL CHECK (impact_level IN ('low','medium','high','critical')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES website_user(user_id)
);

-- Seed data (matches current hardcoded defaults)
INSERT INTO impact_category_mapping (category, impact_level) VALUES
  ('safety_compliance','critical'),
  ('design_conflicts','high'),
  ('resource_blockers','high'),
  ('workflow_issues','medium'),
  ('miscellaneous','low')
ON CONFLICT (category) DO NOTHING;

-- Table: change log (enforces 2/day/superadmin limit via application code)
CREATE TABLE IF NOT EXISTS mapping_change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_by UUID NOT NULL REFERENCES website_user(user_id),
  category TEXT NOT NULL,
  old_impact TEXT NOT NULL,
  new_impact TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);
