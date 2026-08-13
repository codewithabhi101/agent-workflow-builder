# AI Agent Workflow Builder

A mini n8n-style workflow builder where organizations chain AI agent steps (LLM calls, HTTP requests, conditional branches, approval gates) with two independent layers of permission enforcement.

**Live app:** https://workflow-frontend-green.vercel.app
**Backend repo:** https://github.com/codewithabhi101/agent-workflow-builder
**Frontend repo:** https://github.com/codewithabhi101/workflow-frontend

## Stack

- nhost (Postgres + Hasura + Auth + Storage + Serverless Functions)
- Hasura GraphQL Engine
- PostgreSQL
- Node.js / TypeScript Action handlers
- Next.js frontend

## Setup

1. Clone both repos.
2. Create an nhost project, connect it to this repo under Settings -> Deployments for auto-deploy of nhost/functions/.
3. Set env vars on nhost: PGHOST, PGPASSWORD, PGDATABASE (Postgres connection info from Settings -> Database).
4. Run the schema SQL against your database via the Hasura console SQL tab, track all tables, let Hasura auto-suggest relationships.
5. Apply org+role scoped permissions to each table for owner/editor/viewer roles.
6. Create two Hasura Actions (triggerWorkflowRun, approveStep) pointing at the deployed function URLs.
7. Frontend: npm install, add .env.local with NEXT_PUBLIC_HASURA_URL, NEXT_PUBLIC_HASURA_WS_URL, NEXT_PUBLIC_HASURA_ADMIN_SECRET, then npm run dev.

## LLM calls

llm_call steps use a stubbed LLM response with a disclosed artificial 800ms delay rather than a live third-party API key, to keep the demo runnable without reviewers needing their own keys.

## Auth

The deployed demo uses fixed test user IDs (no login screen) to keep the reviewer path to the Final Task scenario short. The backend security model (Hasura row permissions + Action-handler role checks) does not depend on this and works identically once a real login flow forwards x-hasura-user-id from a verified session.

## Known limitations

- Layer 2 gating (owner-only for db_write/notify/webhook steps) is implemented as a Postgres trigger, but no step-creation UI exists yet to exercise it.
- Only manual and webhook-shaped trigger paths are demonstrated; scheduled and database_event triggers are modeled in the schema but not wired to auto-fire in this version.
