-- ================================================================
-- StudyCUBE 통합 수정 마이그레이션
-- Supabase 대시보드 → SQL Editor 에서 전체 붙여넣고 실행하세요.
-- ================================================================


-- ----------------------------------------------------------------
-- [1] profiles.role : ENUM → text 변환
--     커스텀 역할(roles 테이블)을 profiles에 저장하려면 text 타입이어야 함
-- ----------------------------------------------------------------

-- 1-A. get_my_role() 함수 먼저 제거 (ENUM 타입 반환이라 타입 변경 전 제거 필요)
DROP FUNCTION IF EXISTS get_my_role();

-- 1-B. profiles.role 컬럼을 text로 변환
ALTER TABLE profiles
  ALTER COLUMN role TYPE text USING role::text;

-- 1-C. 기존 user_role ENUM 제거 (더 이상 불필요)
DROP TYPE IF EXISTS user_role;

-- 1-D. get_my_role() 재생성 — 이제 text 반환
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1-E. 기본값 설정 (신규 유저의 role 기본값)
ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'user';


-- ----------------------------------------------------------------
-- [2] roles 테이블 기본 역할 권한 업데이트
--     코드(RoleManager, PortalGrid)의 카테고리 구조와 일치시킴:
--       admin     → admin + manager + student-manage + schedule + apply
--       manager   → manager + student-manage + schedule + apply
--       user      → schedule + apply  (구: user 카테고리 삭제)
-- ----------------------------------------------------------------

-- admin 역할
UPDATE roles
SET
  permissions = '{
    "admin":          ["users", "full-schedule"],
    "manager":        ["classroom-schedule", "attendance", "lunch", "courses"],
    "student-manage": ["students-register", "students-schedule", "students-assignments"],
    "schedule":       ["my-schedule", "assignments"],
    "apply":          ["student-lunch", "student-enroll"]
  }'::jsonb,
  category_order = ARRAY['admin', 'manager', 'student-manage', 'schedule', 'apply']
WHERE name = 'admin';

-- manager 역할
UPDATE roles
SET
  permissions = '{
    "manager":        ["classroom-schedule", "attendance", "lunch", "courses"],
    "student-manage": ["students-register", "students-schedule", "students-assignments"],
    "schedule":       ["my-schedule", "assignments"],
    "apply":          ["student-lunch", "student-enroll"]
  }'::jsonb,
  category_order = ARRAY['manager', 'student-manage', 'schedule', 'apply']
WHERE name = 'manager';

-- user(학생) 역할 — 구 'user' 카테고리를 schedule + apply로 교체
UPDATE roles
SET
  permissions = '{
    "schedule": ["my-schedule", "assignments"],
    "apply":    ["student-lunch", "student-enroll"]
  }'::jsonb,
  category_order = ARRAY['schedule', 'apply']
WHERE name = 'user';


-- ----------------------------------------------------------------
-- [3] instructors.profile_id 추가 (선생님 ↔ 유저 연동)
-- ----------------------------------------------------------------
ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'instructors_profile_id_unique'
  ) THEN
    ALTER TABLE instructors ADD CONSTRAINT instructors_profile_id_unique UNIQUE (profile_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_instructors_profile_id ON instructors(profile_id);


-- ----------------------------------------------------------------
-- [4] courses.duration_minutes 추가 (수업 기본 시간 → 종료시간 자동계산)
-- ----------------------------------------------------------------
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS duration_minutes int CHECK (duration_minutes > 0);


-- ================================================================
-- 완료! 아래 쿼리로 결과를 확인하세요:
-- SELECT name, label, category_order, permissions FROM roles;
-- \d profiles  -- role 컬럼 타입이 text인지 확인
-- ================================================================
