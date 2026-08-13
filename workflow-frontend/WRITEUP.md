# Write-up

## Schema reasoning

The schema mirrors the required containment chain directly: `organizations → org_members → workflows → workflow_steps / workflow_triggers`, and `workflows → workflow_runs → step_runs`. Keeping `org_id` on `workflows` (rather than only on steps/runs) means every downstream row can be scoped back to an org through a single join, which is what makes the Layer 1 permission rules simple and uniform across tables instead of needing a bespoke rule per table.

`step_runs` carries `status`, `input`, `output`, `error`, `attempt_count`, and `approved_by` / `approved_at` on the same row rather than in a separate approvals table, since an approval is really just one more terminal state of a step's execution — this keeps the subscription that drives the live UI to a single table.

`organizations.quota_used` / `quota_limit` live on the org row itself (rather than a derived count) so the Action handler can check-and-increment quota as part of the same flow without an extra aggregation query on every run.

## How the two permission layers are enforced differently

**Layer 1 (org + role scoping)** is pure Hasura row-level permissions, keyed off `org_members`. Every table's select/insert/update permission includes a relationship or subquery back to `org_members` filtered on `X-Hasura-User-Id`, so role alone never grants access — a role check always sits inside an org-membership check. This layer covers ordinary reads/writes (viewing workflows, listing runs, etc.) and needs no application code, which is deliberate: it's the part of the system that should never be bypassable through business logic bugs.

**Layer 2 (step-level gating)** covers two different situations that Hasura's declarative permissions can't express on their own:

- Restricting *which step types* a role can create (`db_write`, a webhook trigger, `notify` are owner-only) is enforced with a Postgres trigger on `workflow_steps` / `workflow_triggers`, since it depends on the *value being inserted* (the step's `type`), not just who's inserting.
- Clearing an `approval_gate` is enforced inside the `approveStep` Action handler, explicitly re-checking the caller's role in `org_members` before flipping the step's status and resuming the run. This has to be application code rather than a table permission because approval is a *mid-execution decision on already-existing rows*, not a row-level read or insert — the handler is what decides whether to advance the state machine at all.

## Approval-gate pause/resume

`triggerWorkflowRun` executes steps sequentially. On reaching a step of type `approval_gate`, it sets that step's `step_runs.status` to `paused` and the parent `workflow_runs.status` to `paused`, then returns immediately — it does not block or poll. The GraphQL subscription on `step_runs` (filtered by `workflow_run_id`) picks up the `paused` row instantly, which is what drives the pause/approve UI in the frontend.

Resuming is a second, independent Action call, `approveStep(step_run_id)`. It re-derives the step run's org through `step_runs → workflow_runs → workflows`, checks the caller is an owner/editor in that org, then marks the step `completed` (recording `approved_by` / `approved_at`) and the run back to `running`. In the current build this hands control back to the caller rather than auto-resuming the remaining steps server-side — the next production iteration would have `approveStep` re-invoke the step loop from the following step instead of stopping at "resumed".

## Cross-org isolation, verified

Tested directly against the Hasura API Explorer with real `x-hasura-role` / `x-hasura-user-id` headers and no admin secret:

- Org A owner triggering Org A's seeded workflow → `{"status":"paused"}`
- `approveStep` on the paused step → `{"status":"resumed"}`
- Org B's user, given Org A's real `workflow_id` directly, calling `triggerWorkflowRun` → `403 "Not a member of this org"`

That last case is the one that matters most: it confirms isolation holds even when the caller has the correct, guessable-format UUID, not just when they lack knowledge of it.