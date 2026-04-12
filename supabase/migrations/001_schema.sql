-- =====================
-- TABLES
-- =====================

-- profiles：擴展 auth.users，儲存角色與顯示名稱
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('teacher', 'student')),
  avatar text,
  created_at timestamptz default now() not null
);

-- courses
create table public.courses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text not null,
  cover_image text,
  course_code text unique not null,
  teacher_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- course_members
create table public.course_members (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  current_assignment_index integer default 0 not null,
  unique(course_id, student_id)
);

-- assignments
create table public.assignments (
  id uuid default gen_random_uuid() primary key,
  course_id uuid references public.courses(id) on delete cascade not null,
  title text not null,
  description text not null,
  order_index integer not null,
  submit_type text not null check (submit_type in ('complete', 'file', 'link', 'image')),
  release_date timestamptz default now() not null,
  due_date timestamptz,
  is_active boolean default false not null,
  showcase_enabled boolean default false not null,
  showcase_require_approval boolean default true not null,
  created_at timestamptz default now() not null
);

-- submissions
create table public.submissions (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  status text not null check (status in ('pending', 'completed', 'late')) default 'pending',
  submit_data text,
  submitted_at timestamptz,
  feedback text,
  showcase_approved boolean,
  showcase_rejected boolean,
  showcase_reject_reason text,
  unique(assignment_id, student_id)
);

-- discussion_messages
create table public.discussion_messages (
  id uuid default gen_random_uuid() primary key,
  assignment_id uuid references public.assignments(id) on delete cascade not null,
  course_id uuid references public.courses(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  parent_id uuid references public.discussion_messages(id) on delete cascade,
  created_at timestamptz default now() not null,
  updated_at timestamptz
);

-- =====================
-- REALTIME
-- =====================
alter publication supabase_realtime add table public.discussion_messages;

-- =====================
-- ROW LEVEL SECURITY
-- =====================
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.discussion_messages enable row level security;

-- profiles：任何人可讀，只能更新自己
create policy "profiles_select" on public.profiles for select using (auth.uid() is not null);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- courses：教師可建立/更新自己的，所有登入用戶可讀
create policy "courses_select" on public.courses for select using (auth.uid() is not null);
create policy "courses_insert" on public.courses for insert with check (auth.uid() = teacher_id);
create policy "courses_update" on public.courses for update using (auth.uid() = teacher_id);
create policy "courses_delete" on public.courses for delete using (auth.uid() = teacher_id);

-- course_members：學生可加入（insert），可讀自己的，教師可讀自己課程的，學生可更新自己的
create policy "members_select_own" on public.course_members
  for select using (
    auth.uid() = student_id
    or auth.uid() in (select teacher_id from public.courses where id = course_id)
  );
create policy "members_insert" on public.course_members
  for insert with check (auth.uid() = student_id);
create policy "members_update_own" on public.course_members
  for update using (auth.uid() = student_id);

-- assignments：教師 CRUD 自己課程的，學生可讀已加入課程的 active 作業
create policy "assignments_select" on public.assignments
  for select using (
    auth.uid() in (select teacher_id from public.courses where id = course_id)
    or (
      is_active = true
      and auth.uid() in (select student_id from public.course_members where course_id = assignments.course_id)
    )
  );
create policy "assignments_insert" on public.assignments
  for insert with check (
    auth.uid() in (select teacher_id from public.courses where id = course_id)
  );
create policy "assignments_update" on public.assignments
  for update using (
    auth.uid() in (select teacher_id from public.courses where id = course_id)
  );
create policy "assignments_delete" on public.assignments
  for delete using (
    auth.uid() in (select teacher_id from public.courses where id = course_id)
  );

-- submissions：學生可 CRUD 自己的，教師可讀/更新自己課程的
create policy "submissions_select" on public.submissions
  for select using (
    auth.uid() = student_id
    or auth.uid() in (
      select c.teacher_id from public.courses c
      join public.assignments a on a.course_id = c.id
      where a.id = assignment_id
    )
  );
create policy "submissions_insert" on public.submissions
  for insert with check (auth.uid() = student_id);
create policy "submissions_update_student" on public.submissions
  for update using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
create policy "submissions_update_teacher" on public.submissions
  for update using (
    auth.uid() in (
      select c.teacher_id from public.courses c
      join public.assignments a on a.course_id = c.id
      where a.id = assignment_id
    )
  );

-- discussion_messages：課程成員可讀/新增（含教師）
create policy "discussions_select" on public.discussion_messages
  for select using (
    auth.uid() in (select student_id from public.course_members where course_id = discussion_messages.course_id)
    or auth.uid() in (select teacher_id from public.courses where id = course_id)
  );
create policy "discussions_insert" on public.discussion_messages
  for insert with check (
    auth.uid() = user_id
    and (
      auth.uid() in (select student_id from public.course_members where course_id = discussion_messages.course_id)
      or auth.uid() in (select teacher_id from public.courses where id = course_id)
    )
  );
create policy "discussions_update_own" on public.discussion_messages
  for update using (auth.uid() = user_id);

-- =====================
-- STORAGE BUCKET
-- =====================
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false);

-- Path convention: submissions/{user_id}/{assignment_id}/{filename}
create policy "submission_upload" on storage.objects
  for insert with check (
    bucket_id = 'submissions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "submission_select" on storage.objects
  for select using (
    bucket_id = 'submissions'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or auth.uid() in (
        select c.teacher_id from public.courses c
        join public.assignments a on a.course_id = c.id
        where a.id::text = (storage.foldername(name))[2]
      )
    )
  );

-- =====================
-- INDEXES
-- =====================
create index on public.courses (teacher_id);
create index on public.course_members (course_id);
create index on public.course_members (student_id);
create index on public.assignments (course_id);
create index on public.assignments (order_index);
create index on public.submissions (assignment_id);
create index on public.submissions (student_id);
create index on public.discussion_messages (assignment_id);
create index on public.discussion_messages (course_id);
create index on public.discussion_messages (parent_id);
