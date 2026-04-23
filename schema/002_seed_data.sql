-- ============================================================================
-- OMNIFEED Seed Data
-- Run after 001_omnifeed_schema.sql
-- Customize per client before running
-- ============================================================================

-- Default impact category mappings
INSERT INTO impact_category_mapping (category, impact_level) VALUES
  ('safety_compliance', 'critical'),
  ('design_conflicts', 'high'),
  ('resource_blockers', 'high'),
  ('workflow_issues', 'medium'),
  ('miscellaneous', 'low')
ON CONFLICT (category) DO NOTHING;
