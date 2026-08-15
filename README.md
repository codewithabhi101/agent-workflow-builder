# What's in this drop

```
migrations/001_init.sql          full schema + org_usage_this_month view
functions/runWorkflow.ts         execution engine: retry, conditional_branch,
                                  approval pause, notify, quota increment
functions/triggerWorkflowRun.ts  revised — adds the missing quota check
functions/approveStep.ts         revised — validates step is a paused
                                  approval_gate before approving, and now
                                  actually resumes execution
functions/notifyHandler.ts       Hasura Event Trigger handler for the
                                  `notify` step type (fires on notifications INSERT)
functions/scheduledTrigger.ts    the trigger type you had zero coverage for
hasura/permissions.md            Layer 1 + Layer 2 permission YAML, ready to
                                  paste into console or metadata files
frontend/useStepRunsSubscription.ts   live subscription hook
frontend/WorkflowRunPanel.tsx    run button + live step list + approve UI +
                                  quota indicator, all in one component
```

## Steps to wire this in (in order)

1. **Run the migration** against your nhost Postgres instance (or fold it into
   your existing migrations if you already have tables — check for column
   name mismatches first).
2. **Replace** your existing `runWorkflow.ts`, `triggerWorkflowRun.ts`,
   `approveStep.ts` with these versions. Confirm your imports match your
   actual folder layout (I assumed `functions/lib/runWorkflow.ts`).
3. **Add `notifyHandler.ts`** and register it in Hasura Console →
   Events → Create Trigger → table `notifications`, operation `INSERT`,
   webhook pointing at your deployed function URL.
4. **Add `scheduledTrigger.ts`** and register a cron entry (see comment at
   bottom of that file) in `nhost/cron-jobs.yaml`.
5. **Apply the permissions** in `hasura/permissions.md` — either paste the
   YAML into Console → Data → [table] → Permissions, or hand-edit your
   `metadata/databases/.../tables/*.yaml` files and re-apply metadata.
6. **Wire the Actions** — make sure `triggerWorkflowRun` and `approveStep`
   are registered as Hasura Actions with `workflow_id: uuid!` and
   `step_run_id: uuid!` args respectively, both returning at least
   `{ workflow_run_id, status }` / `{ step_run_id, status }` types.
7. **Drop in the frontend files** and hook `WorkflowRunPanel` up to wherever
   you render a single workflow — it needs `workflowId`, the caller's
   `userRole`, and the org's `quotaUsed`/`quotaLimit` (pull those from your
   existing org-context query).

## What this does NOT cover — still yours to do

- **The workflow builder UI itself** (add/reorder steps, attach a trigger,
  step config forms) — I only built the *run/monitor* side, not the *authoring* side.
- **GraphQL query** for "org's workflows with steps, triggers, and latest run
  status" — straightforward Hasura query once relationships + permissions
  above are in place, but I haven't written the exact query/fragment.
- **Mutation to create/edit a workflow + its steps + triggers** — same, once
  Layer 2 insert checks are applied this is a nested GraphQL mutation.
- **Webhook trigger endpoint** — you already have `webhookTrigger.ts`; wasn't
  shown to me, so I didn't touch it. Worth confirming it calls
  `runWorkflow(orgId, workflowId, null, 0)` the same way the others do now.
- **Real LLM API key wiring** — `runWorkflow.ts` defaults to a stub if
  `LLM_API_KEY` isn't set; set it (Groq/OpenRouter/Gemini) if you want the
  real-call requirement satisfied rather than the disclosed-stub fallback.
- **Two-org test data + the actual live walkthrough** — nothing here creates
  your two test orgs/users or proves cross-org isolation; that's a manual
  step you still need to do and ideally record.
- **The ~1 page write-up** — not written.

## Where this leaves you

The core gaps that were graded most heavily — quota enforcement, approval-gate
state validation + actual resume, retry logic, conditional_branch, both
permission layers, the notify event trigger, and the missing scheduled
trigger — are now addressed in code. What's left is mostly wiring (applying
migrations/permissions to your actual instance), the authoring UI, and the
live proof-of-scenario walkthrough. That's a meaningfully smaller gap than
before — realistically you're closer to **70-80%** once this is integrated
and tested, with the biggest remaining risk being whether the live scenario
actually holds together end-to-end (which only a real test run will tell you).