# AI Agent Workflow Builder — Write-up

## Schema Reasoning

The schema follows the natural hierarchy described in the assignment: an organization contains members with roles, owns workflows, and each workflow is composed of ordered steps and triggers. Runs are a separate execution record from the workflow definition itself, since a single workflow can be run many times, and each run needs its own independent status and history.

- **organizations** — holds the quota (`quota_used` / `quota_limit`) so usage can be checked and incremented per org, independent of any single workflow.
- **org_members** — the join table between users and organizations, carrying the `role` (`owner` / `editor` / `viewer`). This is the single source of truth for both permission layers — every row/action check ultimately traces back to a lookup here.
- **workflows** — belongs to an org via `org_id`. This foreign key is what every downstream permission check relies on to scope access.
- **workflow_steps** — ordered via `step_order`, with a `type` (`llm_call`, `http_request`, `db_write`, `notify`, `conditional_branch`, `approval_gate`) and a `config` JSONB column so each step type can carry arbitrary parameters (prompts, URLs, conditions) without needing a new column per type.
- **workflow_triggers** — separate from steps since a trigger describes *how* a run starts, not an execution step itself.
- **workflow_runs** — one row per execution, with `status` supporting `running`, `paused`, `completed`, and `failed`.
- **step_runs** — one row per step per run, carrying `status`, `input`, `output`, `error`, `attempt_count`, and `approved_by` / `approved_at` for approval-gate steps specifically. Keeping this separate from `workflow_steps` (the definition) means the same step definition can be re-executed many times across different runs, each with its own independent record.

## How the Two Permission Layers Are Enforced Differently

**Layer 1 (org + role scoping)** is enforced entirely inside Hasura's declarative row-level permissions. Every table's insert/select/update/delete permission for the `editor`, `owner`, and `viewer` roles includes a custom check that traces back to the caller's org via the `workflow` relationship — e.g. `{"workflow": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}`. Because this is a database-level filter (not application logic), it applies uniformly to every GraphQL query, mutation, and subscription against that table, with no way to bypass it from the client. This is why a user in Org B querying `workflows` returns an empty result even with a valid `owner` role — the role alone isn't sufficient, the org match is required in the same check.

**Layer 2 (step-level gating)** is enforced in two different places depending on whether the check is a simple row condition or a runtime decision:

- For **inserting restricted step types** (`db_write`, `notify`) and **trigger types** (`webhook`), the restriction is still expressed as a Hasura permission — the `editor` role's insert check on `workflow_steps` adds `{"type": {"_nin": ["db_write", "notify", "webhook"]}}` alongside the org check, so only `owner` can create those rows. This works as a declarative permission because it's a simple, static condition on the row being inserted.
- For **clearing an approval_gate**, the check cannot be a database permission alone, since approving a step is a *decision*, not a plain field write — the same `step_runs` row is being read and mutated, but the actual business rule ("does this approver's role in this org allow approval") requires a runtime lookup that spans multiple tables (`step_runs → workflow_steps → workflow_runs → workflows → org_members`). This logic lives in the `approveStep` Action handler: it queries the step's context, confirms it's an `approval_gate` in `paused` status, resolves the caller's role via `org_members`, and only proceeds if the role is `owner` or `editor`. This is why it has to be an Action handler rather than a permission rule — Hasura's permission system can express row-level filters, but not conditional business logic that spans a multi-step decision like this.

## Approval-Gate Pause/Resume Implementation

The workflow engine (`runWorkflow.ts`) executes steps in a loop, ordered by `step_order`. When it encounters a step of type `approval_gate`, it sets that step's `step_runs.status` to `paused`, sets the parent `workflow_runs.status` to `paused`, and returns immediately — the function does not block or wait; it simply stops executing further steps and exits.

The `approveStep` Action handler is a separate entry point that resumes execution. When called, it:
1. Looks up the target `step_run`, joining through to the parent `workflow_run` and `workflow` to get the org.
2. Confirms the step is actually an `approval_gate` currently in `paused` status (rejecting otherwise).
3. Resolves the caller's role via `org_members` for that org, and rejects unless the role is `owner` or `editor`.
4. Marks the step_run `completed`, recording `approved_by` and `approved_at`.
5. Calls `resumeWorkflowAfterApproval`, which re-invokes the same `runWorkflow` engine but starting from the step *after* the approved one (`fromStepOrder = step_order + 1`), reusing the existing `workflow_run` row rather than creating a new one.

Because both entry points write through the same `step_runs` / `workflow_runs` tables, the GraphQL subscription on `step_runs` (filtered by `workflow_run_id`) reflects the pause and the resume live, with no polling or refresh needed on the client — the pause state, the approval, and the final `completed` status all stream through the same subscription as they happen.