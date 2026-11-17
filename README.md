# GapFinder AI

GapFinder AI helps students find knowledge gaps from their study materials, source-grounded quizzes, and adaptive revision plans. The project has two distinct modes: an offline local demo and a Supabase/OpenAI/Groq-backed account workflow.

## What is implemented

- Supabase email/password authentication and persistent student profiles.
- Private PDF/TXT storage in a private Supabase Storage bucket. RLS restricts each account to its own files and database rows.
- Server-side PDF/TXT extraction, page and heading metadata, overlapped text chunks, OpenAI embeddings, and pgvector cosine-similarity search.
- Groq-generated source-grounded quizzes and answer evaluation. Each generated question is tied to retrieved chunk IDs and citations are resolved from stored document metadata.
- RAG topic explanations, source citations, insufficient-context responses, and per-account chat history with follow-up context.
- Persisted quiz attempts, student answers, topic-level Weak/Medium/Strong analysis, improvement between attempts, and adaptive revision plans with saved task completion.
- Persistent cloud dashboards and topic maps. Incomplete cloud configuration reports an error instead of silently switching a signed-in workflow to mock data.

Uploaded file bytes, extracted text, chunk content, and embeddings are stored separately. Scanned/image-only PDFs are not OCR'd. The current cloud results page displays the latest attempt for a quiz.

## Modes and limitations

### Local demo

With Supabase variables unset, the app uses localStorage and seeded demo data. Demo login:

- Email: `aarav@demo.com`
- Password: `demo-password`

Demo retrieval is lexical, not semantic. Demo quiz questions and deterministic scoring are fixtures to exercise the UI; they are not live AI results, Supabase persistence, or a cloud-authenticated experience. The app shell labels this mode explicitly.

### Cloud mode

Cloud mode requires a Supabase URL and anon/publishable key. Document ingestion additionally requires OpenAI embeddings; grounded quizzes, answer evaluation, and explanations require Groq. Missing provider configuration returns a clear API error rather than simulated AI output. No service-role key is needed: server routes use the authenticated student's access token and RLS.

## Environment variables

Copy `.env.example` to `.env.local` and set real values locally. In Vercel, add the same variables under the existing project's Environment Variables settings; never use `NEXT_PUBLIC_` for provider secrets.

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cloud | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cloud | Browser-safe anon/publishable key; requests are still protected by user auth and RLS |
| `OPENAI_API_KEY` | Ingestion/RAG | Server-only API key for embeddings |
| `OPENAI_EMBEDDING_MODEL` | No | Embedding model; defaults to `text-embedding-3-small` and must return 1,536 dimensions |
| `GROQ_API_KEY` | Quiz/evaluation/explanations | Server-only API key for grounded inference |
| `GROQ_MODEL` | No | Groq model override; defaults to `llama-3.3-70b-versatile` |
| `MAX_UPLOAD_SIZE_MB` | No | Server upload limit; defaults to 10 MB |
| `NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB` | No | Browser-side matching limit; defaults to 10 MB |

`SUPABASE_SERVICE_ROLE_KEY` is intentionally not used. Do not put it in the project or Vercel settings.

## Supabase setup

1. Create a Supabase project and enable Email/Password under **Authentication → Providers**. Configure email confirmation and redirect URLs for localhost and the deployed app as appropriate.
2. Open **SQL Editor**, run the complete [`supabase/schema.sql`](./supabase/schema.sql) script, and confirm it succeeds. It enables pgvector, creates the private `study-materials` Storage bucket, database indexes, the owner-scoped similarity RPC, grants, and RLS policies.
3. Copy the Project URL and anon/publishable key from **Project Settings → API** to `.env.local` or Vercel. Do not use the service-role key.
4. Configure `OPENAI_API_KEY` and `GROQ_API_KEY` for the features that need them. Restart the local server after changing environment variables.
5. Create a test account, upload a small text PDF and TXT file, complete a quiz, revisit the dashboard and revision plan, then refresh and sign in again to check persistence.

The schema script is intended to be rerun safely for its supported objects. Review Supabase SQL output and RLS policies before using it on a project containing existing data. Cloud migrations and RLS cannot be verified without access to the target Supabase project.

## Local development and checks

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. To verify code locally:

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run build
```

`npm test` covers chunk overlap and metadata, server-side TXT/PDF extraction, score classifications, gap reports, and revision-plan priorities/scheduling. When cloud credentials are absent, provider-backed functions cannot be end-to-end tested. The local demo remains available but does not exercise pgvector, Supabase RLS, or Groq.

## RAG and data flow

1. The browser uploads the original file directly to the private Storage bucket using the signed-in user's session.
2. An authenticated route downloads only that user's stored object, validates the file, extracts text and page/heading metadata, and creates overlapping chunks.
3. The server requests 1,536-dimensional embeddings from OpenAI and stores chunks/vectors in Postgres. RLS protects both document rows and chunks.
4. A question is embedded separately and sent to `match_document_chunks`. The SQL function applies cosine similarity, optional topic/document filters, and `auth.uid()` ownership restrictions.
5. Retrieved source chunks are passed to Groq as evidence, separate from the retrieval step. Generated answer citation IDs are checked against the retrieved set and metadata from the database; no citation is constructed from model-generated page/source text.
6. Quiz responses, topic reports, profile, revision tasks, and RAG turns are persisted under the authenticated user. Quiz results and quizzes can be reloaded from the database.

The core schema is in `supabase/schema.sql`. It includes `profiles`, `documents`, `document_chunks`, `topics`, `quizzes`, `student_answers`, `quiz_attempts`, `topic_performance`, `revision_plans`, `revision_tasks`, and `chat_history`.

## Vercel deployment

Use the existing Vercel project connected to this repository; do not relink or replace other projects.

1. Apply and validate the Supabase schema first.
2. Add the required Supabase variables and the OpenAI/Groq secrets for the cloud features you intend to use in **Vercel → Project → Settings → Environment Variables**. Provider keys must be server-only.
3. Trigger a deployment from the updated GitHub branch (or redeploy the latest commit) and wait for the deployment to finish successfully.
4. Verify signup/login, private file upload and retrieval, source citations, quiz submission/results after refresh, revision-task completion, and user isolation with test accounts. A successful homepage response alone does not verify the cloud workflow.

The public Vercel deployment may remain in demo mode until the project variables and database migration are configured. This repository cannot confirm or apply settings in the Vercel/Supabase dashboards without access to those projects.
