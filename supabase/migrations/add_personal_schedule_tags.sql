-- ================================================================
-- Migration: personal_schedules.tags (일정 태그)
-- ================================================================
ALTER TABLE personal_schedules
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
