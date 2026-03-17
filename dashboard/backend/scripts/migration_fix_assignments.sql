-- Migration: Fix assignment data inconsistencies
-- Run in Supabase SQL Editor

-- 1. Backfill null assigner_id on old assignments (set to Super Admin)
UPDATE snag_assignment
SET assigner_id = '102d3f28-c91e-456d-9d37-b6de042bd5a8'
WHERE assigner_id IS NULL;

-- 2. Deduplicate active assignments — keep only the newest per snag
-- First, identify duplicates
WITH ranked AS (
  SELECT
    assignment_id,
    snag_id,
    assigned_at,
    ROW_NUMBER() OVER (PARTITION BY snag_id ORDER BY assigned_at DESC) AS rn
  FROM snag_assignment
  WHERE is_active = true
)
UPDATE snag_assignment
SET is_active = false
WHERE assignment_id IN (
  SELECT assignment_id FROM ranked WHERE rn > 1
);

-- 3. Fix any assignments stuck in 'rejected' status — map to 'in_progress'
UPDATE snag_assignment
SET status = 'in_progress'
WHERE status = 'rejected';
