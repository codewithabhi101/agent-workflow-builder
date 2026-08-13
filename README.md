# AI Agent Workflow Builder

A mini n8n purpose-built for chaining AI agent steps, built on nhost (Postgres + Hasura + Auth + Functions) with a Next.js frontend. Every action is checked against two independent permission layers: org+role scoping (Hasura row-level permissions) and step-level gating (enforced in the Action handlers).

**Live app:** https://workflow-frontend-green.vercel.app
**Backend repo:** this repo
**Frontend repo:** `workflow-frontend` (git submodule)

## Stack

- nhost (Postgres + Hasura GraphQL Engine + Auth + Functions)
- PostgreSQL
- GraphQL — queries, mutations, subscriptions
- Next.js / React frontend
- LLM calls: stubbed with a disclosed ~800ms artificial delay (see "LLM calls" below) — swap in a real provider by setting an API key env var

## Data model

`organizations → org_members → workflows → workflow_steps / workflow_triggers`, and `workflows → workflow_runs → step_runs`. See `/hasura/migrations` for the full schema and `/hasura/metadata` for relationships and permissions.

## Two permission layers

1. **Org + role scoping** — enforced as Hasura row-level permissions on every table, keyed off `org_members`. A role alone is never sufficient; every check also scopes to the caller's own org, so an editor in Org A cannot see or touch Org B's rows even with the same role.
2. **Step-level gating** — some step types reach outside the sandbox (`db_write`, a webhook trigger, `notify`) and are owner-only to create; enforced via a Postgres trigger. Clearing an `approval_gate` is a mid-execution decision, not a row read/write, so it's checked explicitly inside the `approveStep` Action handler against the caller's role.

## The core integration

`triggerWorkflowRun(workflow_id)` — a Hasura Action backed by an Express handler — verifies the caller is owner/editor in the workflow's org, checks the org's quota, creates the `workflow_run`, and executes steps in order. `llm_call` and `http_request` steps make real external calls with one retry on failure. Hitting an `approval_gate` step pauses the run; a second Action, `approveStep(step_run_id)`, checks the approver's role and resumes it. Every step transition updates `step_runs` / `workflow_runs`, which a GraphQL subscription streams to the frontend live.

## Setup (local)

1. Clone this repo and `workflow-frontend` (submodule): `git submodule update --init`
2. Create an nhost project (Postgres + Hasura)
3. Apply the schema: run the migrations/metadata in `/hasura` against your project (`hasura metadata apply`, `hasura migrate apply`)
4. Deploy `/functions/triggerWorkflowRun.ts` and `/functions/approveStep.ts` as nhost Functions, and wire each as a Hasura Action
5. Set these env vars on the nhost project (functions read them — nothing is hardcoded):
   - `PGHOST`
   - `PGPASSWORD`
   - `PGDATABASE`
6. Frontend: `cd workflow-frontend && npm install`, then set:
   - `NEXT_PUBLIC_HASURA_URL`
   - `NEXT_PUBLIC_HASURA_WS_URL`
   - `NEXT_PUBLIC_HASURA_ADMIN_SECRET` *(dev convenience only — see Known limitations)*
7. `npm run dev`

## LLM calls

`llm_call` steps currently call a stub (`callLLM()` in `triggerWorkflowRun.ts`) that returns a canned response after an artificial ~800ms delay, disclosed per the assignment instructions. To use a real provider (Groq/OpenRouter/Gemini all have free tiers), replace the body of `callLLM()` with a `fetch` call and add the provider's API key as an env var.

## Known limitations

- **No real end-user auth yet** — the frontend currently runs as a single hardcoded test user. The backend permission layers do not depend on this; they're enforced independently in Hasura and in the Action handlers, and were tested directly via the Hasura API Explorer with real `x-hasura-role` / `x-hasura-user-id` headers (no admin secret) — see WRITEUP.md.
- **No workflow-authoring UI yet** — workflows/steps for the demo are pre-seeded directly in Postgres; the Run/Approve flow and live subscription are fully functional against them.
- The frontend's use of the Hasura admin secret is a local/dev shortcut and should be replaced with nhost session tokens before any real deployment.

## Test data

Two orgs are seeded to demonstrate cross-org isolation — see WRITEUP.md for the exact scenario and IDs used.