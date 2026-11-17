create extension if not exists vector;

create table if not exists profiles (
  id uuid primary key,
  full_name text not null,
  email text not null unique,
  course text,
  exam_date date,
  available_days integer not null default 5 check (available_days > 0),
  study_hours_per_day numeric not null default 2 check (study_hours_per_day > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  document_type text not null,
  storage_path text,
  file_size bigint,
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_content text not null,
  topic text,
  section_title text,
  page_number integer check (page_number is null or page_number > 0),
  chunk_index integer not null,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique(document_id, chunk_index)
);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  parent_topic_id uuid references topics(id) on delete set null,
  exam_importance integer not null default 50 check (exam_importance between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  question_text text not null,
  question_type text not null,
  difficulty text not null,
  options jsonb,
  correct_answer text,
  explanation text,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  difficulty text,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  score numeric not null default 0 check (score between 0 and 100),
  overall_status text,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists student_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  question_data jsonb,
  submitted_answer text,
  is_correct boolean,
  score numeric not null default 0 check (score between 0 and 100),
  feedback text,
  correct_answer text,
  created_at timestamptz not null default now()
);

create table if not exists topic_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_attempt_id uuid references quiz_attempts(id) on delete cascade,
  topic text not null,
  score numeric not null default 0 check (score between 0 and 100),
  status text not null check (status in ('Weak', 'Medium', 'Strong')),
  correct_answers integer not null default 0,
  incorrect_answers integer not null default 0,
  attempts integer not null default 0,
  diagnosis text,
  recommended_action text,
  previous_score numeric,
  improvement numeric,
  created_at timestamptz not null default now()
);

create table if not exists revision_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  quiz_attempt_id uuid references quiz_attempts(id) on delete set null,
  title text not null default 'Personalized revision plan',
  generated_at timestamptz not null default now(),
  exam_date date
);

create table if not exists revision_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references revision_plans(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  day integer not null check (day > 0),
  topic text not null,
  subtopic text,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  priority text not null check (priority in ('High', 'Medium', 'Low')),
  activity text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  question text not null,
  answer text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table quizzes add column if not exists questions jsonb not null default '[]'::jsonb;
alter table quiz_attempts add column if not exists answers jsonb not null default '[]'::jsonb;
alter table student_answers add column if not exists question_data jsonb;
alter table topic_performance add column if not exists quiz_attempt_id uuid references quiz_attempts(id) on delete cascade;
alter table topic_performance add column if not exists previous_score numeric;
alter table topic_performance add column if not exists improvement numeric;
alter table revision_plans add column if not exists quiz_attempt_id uuid references quiz_attempts(id) on delete set null;

create index if not exists idx_documents_user_created on documents(user_id, created_at desc);
create index if not exists idx_document_chunks_user_document on document_chunks(user_id, document_id);
create index if not exists idx_topics_user_id on topics(user_id);
create index if not exists idx_quiz_attempts_user_created on quiz_attempts(user_id, created_at desc);
create index if not exists idx_revision_tasks_plan_id on revision_tasks(user_id, plan_id);
create index if not exists idx_document_chunks_embedding on document_chunks using hnsw (embedding vector_cosine_ops);

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

drop policy if exists "Users can view their own profiles" on profiles;
drop policy if exists "Users can update their own profiles" on profiles;
drop policy if exists "Users can insert their own profiles" on profiles;
create policy "Users can view their own profiles" on profiles for select using (auth.uid() = id);
create policy "Users can update their own profiles" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users can insert their own profiles" on profiles for insert with check (auth.uid() = id);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'documents', 'document_chunks', 'topics', 'questions', 'quizzes',
    'quiz_attempts', 'student_answers', 'topic_performance',
    'revision_plans', 'revision_tasks', 'chat_history'
  ]
  loop
    execute format('drop policy if exists %I on %I', 'Users can manage their own ' || table_name, table_name);
    execute format(
      'create policy %I on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      'Users can manage their own ' || table_name,
      table_name
    );
  end loop;
end
$$;

drop function if exists match_document_chunks(vector, float, int, uuid);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold float default 0.25,
  match_count int default 8,
  p_document_ids uuid[] default null,
  p_topic text default null
)
returns table (
  id uuid,
  document_id uuid,
  document_name text,
  chunk_content text,
  topic text,
  section_title text,
  page_number int,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select dc.id, dc.document_id, d.name, dc.chunk_content, dc.topic, dc.section_title,
         dc.page_number, 1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id and d.user_id = auth.uid()
  where dc.user_id = auth.uid()
    and dc.embedding is not null
    and (p_document_ids is null or dc.document_id = any(p_document_ids))
    and (p_topic is null or dc.topic = p_topic)
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 20));
$$;
