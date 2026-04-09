-- Supabase SQL Editor에서 실행하세요
-- profiles 테이블에 theme 컬럼 추가

alter table profiles
  add column if not exists theme text not null default 'dark'
  check (theme in ('dark', 'light'));
