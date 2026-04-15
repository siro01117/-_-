-- ================================================================
-- Migration: courses.duration_minutes (수업 기본 시간 설정)
-- 수업 생성 시 기본 수업 시간(분)을 설정하면,
-- 교실 시간표에서 해당 수업의 일정을 추가할 때 종료 시간을 자동으로 계산합니다.
-- ================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS duration_minutes int CHECK (duration_minutes > 0);
