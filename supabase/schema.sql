-- ================================================
-- 학원 관리 시스템 - Supabase Schema
-- ================================================
-- Supabase 대시보드 > SQL Editor 에 전체 붙여넣고 실행하세요.
-- 재실행 시에도 안전하게 초기화 후 생성합니다.
-- ================================================


-- ------------------------------------------------
-- 0-A. 기존 객체 초기화 (재실행 대비)
-- ------------------------------------------------
drop table if exists lunch_orders         cascade;
drop table if exists attendance           cascade;
drop table if exists student_assignments  cascade;
drop table if exists assignments          cascade;
drop table if exists enrollments          cascade;
drop table if exists classroom_schedules  cascade;
drop table if exists courses              cascade;
drop table if exists classrooms           cascade;
drop table if exists teachers             cascade;
drop table if exists students             cascade;
drop table if exists profiles             cascade;

drop type if exists user_role         cascade;
drop type if exists attendance_status cascade;
drop type if exists day_of_week       cascade;

drop function if exists handle_new_user()                    cascade;
drop function if exists get_my_role()                        cascade;
drop function if exists get_my_student_id()                  cascade;
drop function if exists check_classroom_schedule_overlap()   cascade;


-- ------------------------------------------------
-- 0-B. Extensions
-- ------------------------------------------------
create extension if not exists "uuid-ossp";


-- ------------------------------------------------
-- 1. ENUM 타입 정의
-- ------------------------------------------------
create type user_role as enum ('admin', 'manager', 'user');
create type attendance_status as enum ('present', 'absent', 'late', 'excused');
create type day_of_week as enum ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');


-- ------------------------------------------------
-- 2. profiles (모든 유저 공통 정보)
--    Supabase auth.users 와 1:1 연결
-- ------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null,
  role        user_role not null default 'user',
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 유저 가입 시 자동으로 profiles 생성하는 트리거
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)   -- 이름 없으면 이메일 앞부분 사용
    ),
    'user'::user_role                 -- 기본값 user (admin이 나중에 변경)
  )
  on conflict (id) do nothing;        -- 중복 실행 방지
  return new;
exception when others then
  -- 트리거 실패가 유저 생성을 막지 않도록 에러 무시
  raise log 'handle_new_user error: %', sqlerrm;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- ------------------------------------------------
-- 3. students (학생 상세 정보)
-- ------------------------------------------------
create table students (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  grade       text,                        -- 학년 (예: "중2", "고1")
  school      text,                        -- 학교명
  parent_name text,
  parent_phone text,
  memo        text,
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------
-- 4. teachers (강사 상세 정보)
-- ------------------------------------------------
create table teachers (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  subject     text,                        -- 담당 과목
  bio         text,
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------
-- 5. classrooms (교실)
-- ------------------------------------------------
create table classrooms (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,             -- 예: "101호", "대강의실"
  capacity      int,                       -- 수용 인원
  floor         int,                       -- 층
  seat_layout   jsonb,                     -- 좌석 배치도 (후순위 기능용)
  description   text,
  created_at    timestamptz not null default now()
);


-- ------------------------------------------------
-- 6. courses (수업/강좌)
-- ------------------------------------------------
create table courses (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,             -- 예: "고1 수학", "중등 영어 심화"
  teacher_id    uuid references teachers(id) on delete set null,
  classroom_id  uuid references classrooms(id) on delete set null,
  description   text,
  max_students  int default 20,
  is_active     boolean default true,
  created_at    timestamptz not null default now()
);


-- ------------------------------------------------
-- 7. classroom_schedules (강사별 교실 사용 시간표)
--    핵심: 교실은 고정, 시간은 유동적
-- ------------------------------------------------
create table classroom_schedules (
  id            uuid primary key default uuid_generate_v4(),
  course_id     uuid not null references courses(id) on delete cascade,
  teacher_id    uuid references teachers(id) on delete set null,
  classroom_id  uuid references classrooms(id) on delete set null,
  day           day_of_week not null,
  start_time    time not null,
  end_time      time not null,
  effective_from  date not null default current_date,  -- 이 시간표가 적용되는 시작일
  effective_until date,                                -- null이면 계속 유효
  created_at    timestamptz not null default now()
);

-- 같은 교실, 같은 요일 시간 중복 방지 트리거
create or replace function check_classroom_schedule_overlap()
returns trigger as $$
begin
  if exists (
    select 1 from classroom_schedules
    where classroom_id = new.classroom_id
      and day = new.day
      and id != new.id
      and (effective_until is null or effective_until >= current_date)
      and new.start_time < end_time
      and new.end_time > start_time
  ) then
    raise exception '해당 교실(%)의 % 요일 % ~ % 시간대에 이미 수업이 있습니다.',
      new.classroom_id, new.day, new.start_time, new.end_time;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_no_classroom_overlap
  before insert or update on classroom_schedules
  for each row execute function check_classroom_schedule_overlap();


-- ------------------------------------------------
-- 8. enrollments (수강 신청)
-- ------------------------------------------------
create table enrollments (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  course_id   uuid not null references courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  is_active   boolean default true,
  unique(student_id, course_id)
);


-- ------------------------------------------------
-- 9. assignments (과제)
-- ------------------------------------------------
create table assignments (
  id          uuid primary key default uuid_generate_v4(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  description text,
  due_date    date,
  week_start  date,                        -- 해당 주간 시작일 (주간 과제표용)
  created_at  timestamptz not null default now()
);


-- ------------------------------------------------
-- 10. student_assignments (학생별 과제 완료 여부)
-- ------------------------------------------------
create table student_assignments (
  id            uuid primary key default uuid_generate_v4(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  student_id    uuid not null references students(id) on delete cascade,
  is_done       boolean default false,
  submitted_at  timestamptz,
  memo          text,
  unique(assignment_id, student_id)
);


-- ------------------------------------------------
-- 11. attendance (출결 관리)
-- ------------------------------------------------
create table attendance (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  course_id   uuid not null references courses(id) on delete cascade,
  date        date not null,
  status      attendance_status not null default 'present',
  seat_no     text,                        -- 좌석 번호 (출결 시 좌석 배치도 연동)
  memo        text,
  created_at  timestamptz not null default now(),
  unique(student_id, course_id, date)
);


-- ------------------------------------------------
-- 12. lunch_orders (월간 도시락 신청)
-- ------------------------------------------------
create table lunch_orders (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references students(id) on delete cascade,
  year        int not null,
  month       int not null check (month between 1 and 12),
  order_dates jsonb not null default '[]',  -- 신청한 날짜 배열 ["2026-04-07", "2026-04-08"]
  submitted_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(student_id, year, month)
);


-- ================================================
-- RLS (Row Level Security) 정책
-- ================================================
-- 모든 테이블에 RLS 활성화
alter table profiles             enable row level security;
alter table students             enable row level security;
alter table teachers             enable row level security;
alter table classrooms           enable row level security;
alter table courses              enable row level security;
alter table classroom_schedules  enable row level security;
alter table enrollments          enable row level security;
alter table assignments          enable row level security;
alter table student_assignments  enable row level security;
alter table attendance           enable row level security;
alter table lunch_orders         enable row level security;


-- ------------------------------------------------
-- 헬퍼 함수: 현재 로그인 유저의 role 반환
-- ------------------------------------------------
create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function get_my_student_id()
returns uuid as $$
  select id from students where profile_id = auth.uid();
$$ language sql security definer stable;


-- ------------------------------------------------
-- profiles RLS
-- ------------------------------------------------
-- 본인 프로필은 누구나 조회 가능
create policy "profiles: 본인 조회"
  on profiles for select
  using (id = auth.uid());

-- admin/manager는 전체 조회
create policy "profiles: admin/manager 전체 조회"
  on profiles for select
  using (get_my_role() in ('admin', 'manager'));

-- admin만 role 변경 가능
create policy "profiles: admin 전체 수정"
  on profiles for update
  using (get_my_role() = 'admin');

-- 본인 기본 정보 수정 (role 제외)
create policy "profiles: 본인 수정"
  on profiles for update
  using (id = auth.uid());


-- ------------------------------------------------
-- students RLS
-- ------------------------------------------------
create policy "students: admin/manager 전체 접근"
  on students for all
  using (get_my_role() in ('admin', 'manager'));

create policy "students: 본인 조회"
  on students for select
  using (profile_id = auth.uid());


-- ------------------------------------------------
-- teachers RLS
-- ------------------------------------------------
create policy "teachers: admin/manager 전체 접근"
  on teachers for all
  using (get_my_role() in ('admin', 'manager'));

create policy "teachers: user 조회"
  on teachers for select
  using (get_my_role() = 'user');


-- ------------------------------------------------
-- classrooms RLS
-- ------------------------------------------------
create policy "classrooms: admin/manager 전체 접근"
  on classrooms for all
  using (get_my_role() in ('admin', 'manager'));

create policy "classrooms: user 조회"
  on classrooms for select
  using (get_my_role() = 'user');


-- ------------------------------------------------
-- courses RLS
-- ------------------------------------------------
create policy "courses: admin/manager 전체 접근"
  on courses for all
  using (get_my_role() in ('admin', 'manager'));

create policy "courses: user 조회"
  on courses for select
  using (get_my_role() = 'user');


-- ------------------------------------------------
-- classroom_schedules RLS
-- ------------------------------------------------
create policy "classroom_schedules: admin/manager 전체 접근"
  on classroom_schedules for all
  using (get_my_role() in ('admin', 'manager'));

create policy "classroom_schedules: user 조회"
  on classroom_schedules for select
  using (get_my_role() = 'user');


-- ------------------------------------------------
-- enrollments RLS
-- ------------------------------------------------
create policy "enrollments: admin/manager 전체 접근"
  on enrollments for all
  using (get_my_role() in ('admin', 'manager'));

create policy "enrollments: 본인 수강 조회"
  on enrollments for select
  using (student_id = get_my_student_id());

create policy "enrollments: 본인 수강 신청"
  on enrollments for insert
  with check (student_id = get_my_student_id());


-- ------------------------------------------------
-- assignments RLS
-- ------------------------------------------------
create policy "assignments: admin/manager 전체 접근"
  on assignments for all
  using (get_my_role() in ('admin', 'manager'));

-- user는 본인이 수강 중인 course의 과제만 조회
create policy "assignments: 본인 수강 과제 조회"
  on assignments for select
  using (
    exists (
      select 1 from enrollments e
      where e.course_id = assignments.course_id
        and e.student_id = get_my_student_id()
        and e.is_active = true
    )
  );


-- ------------------------------------------------
-- student_assignments RLS
-- ------------------------------------------------
create policy "student_assignments: admin/manager 전체 접근"
  on student_assignments for all
  using (get_my_role() in ('admin', 'manager'));

create policy "student_assignments: 본인 조회/수정"
  on student_assignments for all
  using (student_id = get_my_student_id());


-- ------------------------------------------------
-- attendance RLS
-- ------------------------------------------------
create policy "attendance: admin/manager 전체 접근"
  on attendance for all
  using (get_my_role() in ('admin', 'manager'));

create policy "attendance: 본인 출결 조회"
  on attendance for select
  using (student_id = get_my_student_id());


-- ------------------------------------------------
-- lunch_orders RLS
-- ------------------------------------------------
create policy "lunch_orders: admin/manager 전체 접근"
  on lunch_orders for all
  using (get_my_role() in ('admin', 'manager'));

create policy "lunch_orders: 본인 도시락 신청/조회"
  on lunch_orders for all
  using (student_id = get_my_student_id());


-- ================================================
-- 완료! 위 SQL을 Supabase SQL Editor에서 실행하세요.
-- ================================================
