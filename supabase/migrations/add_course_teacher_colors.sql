-- ============================================================
--  StudyCUBE: course & teacher color system
--  Supabase SQL Editor 에서 실행하세요.
-- ============================================================

-- courses 테이블에 과목, 강조색 추가
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS subject      text,
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#6366f1';

-- teachers 테이블에 메인 색 추가 (블록 배경색)
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#1e293b';

-- 기존 데이터에 기본값 채우기 (이미 DEFAULT로 처리되지만 명시)
UPDATE teachers SET color = '#1e293b' WHERE color IS NULL;
UPDATE courses  SET accent_color = '#6366f1' WHERE accent_color IS NULL;
