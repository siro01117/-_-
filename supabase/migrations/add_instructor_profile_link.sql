-- ================================================================
-- Migration: instructors.profile_id (유저 연동)
-- 선생님(instructors)을 실제 유저(profiles)에 연결하는 컬럼 추가
-- ================================================================

-- 1. instructors 테이블에 profile_id 추가 (선택적 - 유저 없이도 선생님 등록 가능)
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. 같은 유저를 여러 선생님에 중복 연결 방지
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instructors_profile_id_unique'
  ) THEN
    ALTER TABLE instructors ADD CONSTRAINT instructors_profile_id_unique UNIQUE (profile_id);
  END IF;
END $$;

-- 3. 인덱스 (profile_id로 빠른 조회)
CREATE INDEX IF NOT EXISTS idx_instructors_profile_id ON instructors(profile_id);
