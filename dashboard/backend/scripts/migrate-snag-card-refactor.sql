-- Snag Card Refactor: DB Migration
-- Run this in Supabase SQL editor BEFORE deploying the new code.

-- 1. Add priority column to snag_assignment (assigner-set priority: low/medium/high/urgent)
ALTER TABLE snag_assignment
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT NULL;

-- 2. Add is_active column for single-assignee model
-- Old assignments get is_active = false on reassignment; only one active per snag.
ALTER TABLE snag_assignment
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. Set all existing assignments as active (backward compat)
UPDATE snag_assignment SET is_active = TRUE WHERE is_active IS NULL;
