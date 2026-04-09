-- ── instructors 테이블 (독립형, 인증 계정 불필요) ──────────────────
CREATE TABLE IF NOT EXISTS instructors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  subjects   text[]      NOT NULL DEFAULT '{}',
  color      text        NOT NULL DEFAULT '#6366f1',
  memo       text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;

-- 로그인 유저는 읽기 가능
CREATE POLICY "auth_read_instructors" ON instructors
  FOR SELECT TO authenticated USING (true);

-- admin/manager만 수정 가능
CREATE POLICY "manager_manage_instructors" ON instructors
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- ── courses 테이블에 instructor_id 추가 ──────────────────────────
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL;

-- ── courses 테이블에 enrolled_names 추가 (학생 이름 직접 저장) ───
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enrolled_names text[] NOT NULL DEFAULT '{}';
