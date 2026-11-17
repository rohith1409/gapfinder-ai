create extension if not exists vector;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  course text,
  exam_date date,
  available_days integer default 5,
  study_hours_per_day integer default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  document_type text not null,
  storage_path text,
  file_size bigint,
  extracted_text text,
  metadata jsonb default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  document_id uuid references documents(id) on delete cascade,
  chunk_content text not null,
  topic text,
  section_title text,
  page_number integer,
  chunk_index integer,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  parent_topic_id uuid references topics(id),
  exam_importance integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  topic_id uuid references topics(id),
  question_text text not null,
  question_type text not null,
  difficulty text not null,
  options jsonb,
  correct_answer text,
  explanation text,
  citations jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  difficulty text,
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  quiz_id uuid references quizzes(id) on delete cascade,
  score numeric default 0,
  overall_status text,
  created_at timestamptz not null default now()
);

create table if not exists student_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  quiz_attempt_id uuid references quiz_attempts(id) on delete cascade,
  question_id uuid references questions(id),
  submitted_answer text,
  is_correct boolean,
  score numeric default 0,
  feedback text,
  correct_answer text,
  created_at timestamptz not null default now()
);

create table if not exists topic_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  topic text not null,
  score numeric default 0,
  status text not null,
  correct_answers integer default 0,
  incorrect_answers integer default 0,
  attempts integer default 0,
  diagnosis text,
  recommended_action text,
  created_at timestamptz not null default now()
);

create table if not exists revision_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  title text,
  generated_at timestamptz not null default now(),
  exam_date date
);

create table if not exists revision_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references revision_plans(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  day integer,
  topic text not null,
  subtopic text,
  duration_minutes integer default 30,
  priority text,
  activity text,
  completed boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  citations jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_id on documents(user_id);
create index if not exists idx_document_chunks_user_document on document_chunks(user_id, document_id);
create index if not exists idx_topics_user_id on topics(user_id);
create index if not exists idx_quiz_attempts_user_id on quiz_attempts(user_id);
create index if not exists idx_revision_tasks_plan_id on revision_tasks(plan_id);

alter table profiles enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table topics enable row level security;
alter table questions enable row level security;
alter table quizzes enable row level security;
alter table quiz_attempts enable row level security;
alter table student_answers enable row level security;
alter table topic_performance enable row level security;
alter table revision_plans enable row level security;
alter table revision_tasks enable row level security;
alter table chat_history enable row level security;

create policy "Users can view their own profiles" on profiles for select using (auth.uid() = id);
create policy "Users can update their own profiles" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profiles" on profiles for insert with check (auth.uid() = id);

create policy "Users can manage their own documents" on documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own chunks" on document_chunks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own topics" on topics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own questions" on questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own quizzes" on quizzes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own attempts" on quiz_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own answers" on student_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own performance" on topic_performance for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own revision plans" on revision_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own revision tasks" on revision_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their own chat history" on chat_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  chunk_content text,
  topic text,
  section_title text,
  page_number int,
  similarity float
)
language sql stable as $$
  select dc.id, dc.document_id, dc.chunk_content, dc.topic, dc.section_title, dc.page_number,
         1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.user_id = p_user_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
