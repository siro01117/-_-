-- ================================================================
-- User System V2: Dynamic Roles + Extended Profiles
-- ================================================================

-- 1. roles 테이블 생성
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text    UNIQUE NOT NULL,            -- 내부 키 (slug)
  label          text    NOT NULL,                   -- 화면 표시 이름
  color          text    NOT NULL DEFAULT '#6366f1',
  permissions    jsonb   NOT NULL DEFAULT '{}',      -- { categoryId: [moduleKey, ...] }
  category_order text[]  NOT NULL DEFAULT '{}',      -- 보여줄 카테고리 순서
  show_in_signup boolean NOT NULL DEFAULT true,      -- 회원가입 역할 선택에 노출
  created_at     timestamptz DEFAULT now()
);

-- 기본 역할 시드
INSERT INTO roles (name, label, color, permissions, category_order, show_in_signup)
VALUES
  (
    'admin', '관리자', '#00ff85',
    '{"admin":["users"],"manager":["classroom-schedule","attendance","lunch","courses"],"student-manage":["students-register","students-schedule","students-assignments"]}'::jsonb,
    ARRAY['admin','manager','student-manage'],
    false
  ),
  (
    'manager', '매니저', '#5badff',
    '{"manager":["classroom-schedule","attendance","lunch","courses"],"student-manage":["students-register","students-schedule","students-assignments"]}'::jsonb,
    ARRAY['manager','student-manage'],
    false
  ),
  (
    'user', '학생', '#888888',
    '{"user":["student-schedule","student-assignments","student-lunch","student-enroll"]}'::jsonb,
    ARRAY['user'],
    true
  )
ON CONFLICT (name) DO NOTHING;

-- RLS for roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_roles" ON roles;
CREATE POLICY "public_read_roles" ON roles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_manage_roles" ON roles;
CREATE POLICY "admin_manage_roles" ON roles
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- 2. profiles 테이블 확장
-- ----------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_id        text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate       date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone           text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender          text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

-- 기존 유저는 모두 approved
UPDATE profiles SET approval_status = 'approved' WHERE approval_status IS NULL;
