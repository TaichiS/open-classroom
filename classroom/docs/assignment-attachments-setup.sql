-- 作業附件設定：經確認後，在既有 classroom Supabase 專案執行一次。
-- 此檔不會由建置或測試自動執行。先在可拋棄的測試專案驗證，再套用正式環境。
begin;

create table public.assignment_attachments (
  id uuid primary key default gen_random_uuid(),
  -- 刪除作業前須先透過附件 API 移除檔案，避免僅刪除資料列而留下儲存物件。
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null unique,
  mime_type text not null,
  size bigint not null check (size between 1 and 26214400),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleting')),
  created_at timestamptz not null default now()
);
create index assignment_attachments_assignment_created_idx
  on public.assignment_attachments (assignment_id, created_at);

-- JWT 與 CLI API Key 共用後端授權。前端不能繞過 API 操作附件資料。
alter table public.assignment_attachments enable row level security;
revoke all on public.assignment_attachments from public, anon, authenticated;
grant select, insert, update, delete on public.assignment_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assignment-attachments', 'assignment-attachments', false, 26214400, array[
  'application/pdf', 'text/markdown', 'text/plain', 'text/csv', 'application/json',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'image/png', 'image/jpeg', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4'
]);

-- 不建立匿名或 authenticated 的 Storage policy。
-- 檔案操作僅由後端服務角色執行，或使用該 API 核准後簽發的短期連結。
commit;
