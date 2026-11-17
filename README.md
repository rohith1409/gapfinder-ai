# GapFinder AI

GapFinder AI helps students find knowledge gaps from quiz attempts, study uploaded materials, and follow an adaptive revision plan. It supports a local demo mode and an optional Supabase/OpenAI/Groq-backed mode.

## Features

- Upload selectable-text PDF and TXT documents, extract text, and split it into source chunks.
- Ask questions against uploaded materials. The cloud mode uses OpenAI embeddings and Supabase pgvector cosine similarity; the demo mode uses local lexical matching.
- Generate quizzes from retrieved material with Groq. Each generated question must cite valid retrieved chunk IDs.
- Evaluate quiz answers, calculate per-topic scores and Weak/Medium/Strong labels, compare topic scores across attempts, and generate revision priorities using exam importance and weakness.
- Save cloud materials, quizzes, attempts, answers, topic reports, revision plans/tasks, and assistant conversations under the authenticated Supabase user. Revision task completion is saved.
- Continue using localStorage-backed demo flows without external credentials.

Cloud uploads persist extracted text, chunk metadata, and embeddings; original file bytes are not retained.

## Modes and credentials

### Local demo

With Supabase variables unset, the app uses localStorage and seeded demo data. Demo login:

- Email: `aarav@demo.com`
- Password: `demo-password`

Demo retrieval is lexical, not semantic. The built-in quiz and deterministic evaluation are intended to keep the interface usable without external services; they are not a substitute for the cloud AI workflows.

### Cloud-backed features

Configure Supabase Auth and apply [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. Set the following in `.env.local` or the existing Vercel project's environment settings:

| Variable | Required for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth and cloud database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase Auth and user-scoped API access |
| `OPENAI_API_KEY` | `text-embedding-3-small` vectors (1536 dimensions) for document ingestion and semantic retrieval |
| `GROQ_API_KEY` | Grounded quiz generation, AI answer evaluation, and topic explanations |
| `GROQ_MODEL` | Optional Groq model override; defaults to `llama-3.3-70b-versatile` |
| `MAX_UPLOAD_SIZE_MB` | Optional server upload limit; defaults to 10 MB |
| `NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB` | Optional matching browser-side upload limit; defaults to 10 MB |

Never expose provider keys in `NEXT_PUBLIC_*` variables or commit real credentials. Do not configure a Supabase service-role key for this app. Cloud data access uses the signed-in student's access token and database RLS; vector search is scoped to that user and can optionally filter by document and topic.

Cloud mode requires all three services for the full workflow. Supabase alone enables sign-in and persistence, but material ingestion and semantic search need the OpenAI key; quiz generation, answer evaluation, and explanations need the Groq key. The API reports missing configuration instead of claiming AI completion. PDF text extraction runs in the browser; scanned/image-only PDFs are not OCR'd.

## Local setup

```bash
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. If you change `.env.local`, restart the development server.

## Validation

```bash
npm run lint
npm run build
```

There is no automated end-to-end test suite configured in this repository. A real cloud workflow also requires configured Supabase, OpenAI, and Groq credentials and an applied schema; without them, only local demo behavior can be verified.

## Deployment

Deploy this repository to the existing Vercel project without relinking or replacing other Vercel projects. Add only the environment variables required for the intended mode in Vercel's project settings, then redeploy. Verify auth, document upload, grounded quiz generation, scoring, citations, revision completion, and user isolation with a configured test account before submitting the cloud deployment.
