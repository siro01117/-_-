-- ================================================
-- schedule_overrides 테이블
-- 임시/고정 변경사항을 기록
-- ================================================

create table if not exists schedule_overrides (
  id               uuid primary key default uuid_generate_v4(),
  -- 기존 고정 일정 참조 (수정/삭제 시), null이면 새로 추가된 일정
  base_schedule_id uuid references classroom_schedules(id) on delete cascade,
  classroom_id     uuid not null references classrooms(id) on delete cascade,
  teacher_id       uuid references teachers(id) on delete set null,
  course_id        uuid references courses(id) on delete set null,
  day              day_of_week not null,
  start_time       time not null,
  end_time         time not null,
  is_cancelled     boolean not null default false, -- 해당 슬롯 삭제/취소
  -- 변경 유형
  override_type    text not null check (override_type in ('permanent', 'temporary')),
  -- 적용 기간 (해당 주 월요일 기준)
  apply_from       date not null,
  apply_until      date,    -- null = permanent (고정 변경)
  weeks_count      int,     -- 임시 변경 시 주 수 (1 = 이번 주만)
  memo             text,
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- RLS
alter table schedule_overrides enable row level security;

create policy "schedule_overrides: admin/manager 전체 접근"
  on schedule_overrides for all
  using (get_my_role() in ('admin', 'manager'));

create policy "schedule_overrides: user 조회"
  on schedule_overrides for select
  using (get_my_role() = 'user');
