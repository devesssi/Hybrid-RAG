# VerbaMind — grounded document intelligence

VerbaMind is a full-stack Hybrid RAG application for asking verifiable questions over uploaded PDFs. It combines semantic retrieval with PostgreSQL full-text search, fuses results with Reciprocal Rank Fusion (RRF), and returns the source context alongside every answer.

## Why this is a portfolio project

- **Hybrid retrieval:** Gemini embeddings provide semantic retrieval; PostgreSQL FTS catches exact terms, names, and identifiers.
- **RRF fusion:** Dense and keyword rankings are blended rather than relying on one retrieval signal.
- **Parent-child retrieval:** small, overlapping child chunks are embedded for precision; their parent paragraph is supplied for useful answer context.
- **Grounding:** the generator is instructed to answer only from retrieved sources, cite `[Source N]`, and abstain when evidence is missing.
- **Inspectable outputs:** the UI shows every ranked source block that was supplied to the LLM.
- **Production-aware design:** secrets and database URLs use environment variables; upload size/type validation is enforced server-side.

## Architecture

```text
PDF upload → PDF.js extraction → overlapping child chunks → Gemini embeddings
                                              ↓
                                      PostgreSQL + pgvector
                                              ↓
Question → vector search + PostgreSQL FTS → RRF → source-labelled context → Groq
```

## Stack

Next.js App Router · TypeScript · PostgreSQL + pgvector · Drizzle ORM · Gemini embeddings · Groq generation · LangGraph · LangSmith (optional) · Tailwind CSS

## Run locally

1. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` and `GROQ_API_KEY`. Do not commit this file.
2. Start local Postgres with pgvector:

   ```bash
   docker compose up -d
   ```

3. Install packages and create the schema:

   ```bash
   pnpm install
   pnpm db:push
   pnpm dev
   ```

4. Open `http://localhost:3000`, upload a PDF (up to 10 MB), and ask a question.

## Deploy

Use Vercel for the Next.js application and a hosted PostgreSQL database with the `vector` extension enabled (for example Neon, Supabase, or Railway).

Set these environment variables in the deployment project:

```text
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
GROQ_API_KEY=...
LANGCHAIN_TRACING_V2=true        # optional
LANGCHAIN_API_KEY=...            # optional
LANGCHAIN_PROJECT=verbamind      # optional
```

Run `pnpm db:push` against the production `DATABASE_URL` once, then deploy the application. The build command is `pnpm build` and the start command is `pnpm start`.

## Production notes

- `MemorySaver` preserves conversation state only for the active server instance. Move chat history to Redis or Postgres before claiming durable multi-user memory.
- Add authentication and a persistent rate limiter before making uploads public; LLM API endpoints otherwise incur costs for anyone who reaches them.
- Store documents per user/tenant and filter retrieval by owner before using private data.
- Build a small labelled question set and measure retrieval recall and grounded-answer quality before tuning thresholds.

## Verification

```bash
pnpm typecheck
pnpm build
```
