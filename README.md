# GapFinder AI

GapFinder AI is an AI-powered learning platform built to diagnose student knowledge gaps, generate grounded quizzes, explain topics using uploaded study material, and produce personalized revision plans.

## What this project includes

- Landing page and auth flows for demo login/signup
- Student dashboard with saved metrics and analytics
- Material upload for PDF and TXT study content
- Topic map and exam-topic prioritization
- RAG-style retrieval backed by uploaded study content
- Diagnostic quiz generation with citations and topic mapping
- Answer evaluation and knowledge-gap analysis
- Personalized revision planning
- Explain-this-topic assistant grounded in uploaded material
- Progress tracking and saved history in local demo storage

## Technology stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Recharts
- Lucide React
- Supabase-ready database schema
- Groq API integration with a fallback grounded retrieval path
- PDF text extraction for uploaded documents

## How retrieval and grounding work

1. Uploaded material is parsed and chunked.
2. Relevant chunks are matched against the student question using keyword overlap.
3. The retrieval step filters to relevant content in the uploaded study material.
4. Generation only uses the retrieved material context.
5. Source citations are returned with each answer.
6. If the material does not contain enough evidence, the app answers with a clear insufficiency message.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the sample env file:

```bash
cp .env.example .env.local
```

3. Fill in the required values for Supabase and Groq.

4. Start the app:

```bash
npm run dev
```

5. Open http://localhost:3000

## Demo credentials

This project includes a demo login flow and uses localStorage for demonstration. You can log in with:

- Email: aarav@demo.com
- Password: demo-password

## Demo data

A sample data generation script is available at:

```bash
node scripts/generate-demo-data.mjs
```

This creates a JSON file in the `demo-data` folder.

## Database setup

Use the SQL in `supabase/schema.sql` in a Supabase project. It includes:

- profiles
- documents
- document_chunks
- topics
- questions
- quizzes
- quiz_attempts
- student_answers
- topic_performance
- revision_plans
- revision_tasks
- chat_history

It also includes pgvector support and row level security policies.

## Production build and validation

Run:

```bash
npm run lint
npm run build
```

## Vercel deployment

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Add the environment variables from `.env.example`.
4. Set the build command to `npm run build`.
5. Deploy and verify the production build.

## Limitations

This version is a production-style demo designed to run without live Supabase credentials or a real Groq account. When credentials are configured, it is ready to use the real services while preserving the same data flow.
