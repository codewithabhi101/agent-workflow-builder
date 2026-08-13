# Write-up: AI Agent Workflow Builder

## Schema reasoning

The schema follows organizations -> org_members -> workflows -> workflow_steps / workflow_triggers, and separately workflows -> workflow_runs -> step_runs.

organizations carries quota_used/quota_limit directly so the Action handler can check-and-increment quota in the same path as the run. org_members is the join table that makes org membership -- not just role -- the unit of authorization: role alone would let anyone claim to be an owner, pairing it with org_id+user_id proves this specific user belongs to this specific org. workflow_steps stores type and config as JSONB so new step types don't need a migration. step_runs carries approved_by/approved_at directly so the approval audit trail stays with the execution record. workflow_runs.status supports a paused state distinct from running/completed/failed, which is what lets a run stop mid-execution at an approval_gate and be resumed later by a different request entirely.

## How the two permission layers are enforced differently

Layer 1 (org + role scoping) is enforced in Hasura's row-level permissions, declaratively, per table. Every table's permissions for owner/editor/viewer include a custom check that traverses the relevant relationship back to org_members and compares user_id against the X-Hasura-User-Id session variable. Tables without a direct org_id (workflow_steps, workflow_triggers, step_runs) nest the check through workflow or workflow_run -> workflow. Because this lives in Hasura's permission engine, it is enforced on every GraphQL request automatically -- an editor in Org A cannot construct a query that returns Org B's rows, regardless of guessed IDs. This was verified live: an Org B user given Org A's real workflow_id was rejected.

Layer 2 (step-level gating) is enforced in application code, not database permissions, because the decision -- is this step type allowed for this role right now -- is not a static row-ownership check. approveStep re-derives the caller's role at request time (via the step_run -> workflow_run -> workflow -> org chain) and rejects with 403 before touching the database if the role is not owner/editor. The same reasoning applies to restricting db_write/notify/webhook step creation to owner, implemented here as a Postgres trigger function.

## Approval-gate pause/resume implementation

triggerWorkflowRun executes workflow_steps in step_order sequence in a single invocation. On reaching an approval_gate step it writes status=paused to both workflow_run and the step_run, then returns immediately -- execution genuinely stops, nothing blocks or polls. Resumption happens via a second, independent Action, approveStep, invoked later by an unrelated request. It looks up the paused step_run, walks the relationship chain back to the org, verifies the caller's role, and if authorized marks the step completed and flips workflow_run back to running.

## What was tested live

- Org A owner triggers their workflow -> executes llm_call (stubbed) -> http_request -> pauses at approval_gate.
- Org A owner approves the paused step -> step_run and workflow_run correctly transition.
- Org B user, given Org A's real workflow_id, is rejected with 403 Not a member of this org at the Action-handler level.
