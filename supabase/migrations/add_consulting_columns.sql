-- ================================================
-- 전체 마이그레이션 (순서대로 실행)
-- 1. schedule_overrides 테이블 생성
-- 2. classroom_schedules 상담 지원 (course_id nullable, notes 추가)
-- 3. 상담 전용 컬럼 추가 + 데이터 마이그레이션
-- ================================================

-- ────────────────────────────────────────────────
-- 1단계: schedule_overrides 테이블 생성
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_overrides (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_schedule_id uuid REFERENCES classroom_schedules(id) ON DELETE CASCADE,
  classroom_id     uuid NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  teacher_id       uuid REFERENCES teachers(id) ON DELETE SET NULL,
  course_id        uuid REFERENCES courses(id) ON DELETE SET NULL,
  day              day_of_week NOT NULL,
  start_time       time NOT NULL,
  end_time         time NOT NULL,
  is_cancelled     boolean NOT NULL DEFAULT false,
  override_type    text NOT NULL CHECK (override_type IN ('permanent', 'temporary')),
  apply_from       date NOT NULL,
  apply_until      date,
  weeks_count      int,
  memo             text,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS (이미 있으면 무시)
ALTER TABLE schedule_overrides ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'schedule_overrides' AND policyname = 'schedule_overrides: admin/manager 전체 접근'
  ) THEN
    CREATE POLICY "schedule_overrides: admin/manager 전체 접근"
      ON schedule_overrides FOR ALL
      USING (get_my_role() IN ('admin', 'manager'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'schedule_overrides' AND policyname = 'schedule_overrides: user 조회'
  ) THEN
    CREATE POLICY "schedule_overrides: user 조회"
      ON schedule_overrides FOR SELECT
      USING (get_my_role() = 'user');
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- 2단계: classroom_schedules 상담 지원
-- ────────────────────────────────────────────────
ALTER TABLE classroom_schedules
  ALTER COLUMN course_id DROP NOT NULL;

ALTER TABLE classroom_schedules
  ADD COLUMN IF NOT EXISTS notes text;

-- ────────────────────────────────────────────────
-- 3단계: 상담 전용 컬럼 추가
-- ────────────────────────────────────────────────
ALTER TABLE classroom_schedules
  ADD COLUMN IF NOT EXISTS consulting_student       text,
  ADD COLUMN IF NOT EXISTS consulting_teacher       text,
  ADD COLUMN IF NOT EXISTS consulting_teacher_color text;

ALTER TABLE schedule_overrides
  ADD COLUMN IF NOT EXISTS consulting_student       text,
  ADD COLUMN IF NOT EXISTS consulting_teacher       text,
  ADD COLUMN IF NOT EXISTS consulting_teacher_color text;

-- ────────────────────────────────────────────────
-- 4단계: 기존 notes 데이터 마이그레이션
--   notes 형식: "학생이름||선생님이름||색상" 또는 "학생이름||선생님이름"
--   ⚠️ 중복 방지 트리거가 UPDATE에도 발동하므로 잠시 비활성화
-- ────────────────────────────────────────────────
ALTER TABLE classroom_schedules DISABLE TRIGGER trg_no_classroom_overlap;

UPDATE classroom_schedules
SET
  consulting_student       = split_part(notes, '||', 1),
  consulting_teacher       = NULLIF(split_part(notes, '||', 2), ''),
  consulting_teacher_color = NULLIF(split_part(notes, '||', 3), '')
WHERE notes IS NOT NULL
  AND notes LIKE '%||%'
  AND consulting_student IS NULL;

ALTER TABLE classroom_schedules ENABLE TRIGGER trg_no_classroom_overlap;

UPDATE schedule_overrides
SET
  consulting_student       = split_part(memo, '||', 1),
  consulting_teacher       = NULLIF(split_part(memo, '||', 2), ''),
  consulting_teacher_color = NULLIF(split_part(memo, '||', 3), '')
WHERE memo IS NOT NULL
  AND memo LIKE '%||%'
  AND consulting_student IS NULL;

-- notes 컬럼은 안전하게 유지 (나중에 확인 후 DROP 가능)
