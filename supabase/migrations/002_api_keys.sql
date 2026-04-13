create table public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  key_hash text not null unique,
  label text not null,
  role text not null check (role in ('teacher', 'student')),
  last_used_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.api_keys enable row level security;

create policy "keys_select_own" on public.api_keys
  for select using (auth.uid() = user_id);

create policy "keys_delete_own" on public.api_keys
  for delete using (auth.uid() = user_id);

-- INSERT 由 API route 用 service role 執行，不需要 RLS policy
