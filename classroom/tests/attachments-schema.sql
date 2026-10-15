-- 只能在全新、可拋棄的本機 PostgreSQL 執行。此測試建立 Supabase 所需的最小假結構。
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role bypassrls; end if;
end $$;
create table public.assignments (id uuid primary key);
grant usage on schema public to service_role, anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
\ir ../docs/assignment-attachments-setup.sql

insert into public.assignments values ('00000000-0000-4000-8000-000000000001');
set role service_role;
insert into public.assignment_attachments (assignment_id, file_name, storage_path, mime_type, size)
values ('00000000-0000-4000-8000-000000000001', '教材.md', 'test/file.md', 'text/markdown', 10);
reset role;

do $$
begin
  if has_table_privilege('anon', 'public.assignment_attachments', 'select')
    or has_table_privilege('authenticated', 'public.assignment_attachments', 'select,insert,update,delete') then
    raise exception '前端角色不應有附件資料表權限';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.assignment_attachments'::regclass) then
    raise exception 'RLS 未啟用';
  end if;
  if not exists (select 1 from storage.buckets where id = 'assignment-attachments' and public = false and file_size_limit = 26214400) then
    raise exception '私人儲存空間設定錯誤';
  end if;
  begin
    update public.assignment_attachments set size = 26214401;
    raise exception '超大附件未被限制';
  exception when check_violation then null;
  end;
  begin
    update public.assignment_attachments set status = 'unknown';
    raise exception '無效狀態未被限制';
  exception when check_violation then null;
  end;
  begin
    delete from public.assignments;
    raise exception '有附件的作業不應直接刪除';
  exception when foreign_key_violation or restrict_violation then null;
  end;
end $$;
select '附件 SQL、權限、容量限制與刪除保護驗證通過' as result;
