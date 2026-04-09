-- courses.name 을 nullable 로 변경 (이름 없이 과목+선생님으로만 운영)
ALTER TABLE courses ALTER COLUMN name DROP NOT NULL;

-- 메모 컬럼 추가
ALTER TABLE courses ADD COLUMN IF NOT EXISTS memo text;
