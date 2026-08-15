# Hasura Permissions — Layer 1 (org+role scoping) and Layer 2 (step-level gating)

Assumes each table has a relationship path back to `org_members` so permissions can
join on `org_id` + `user_id` = `X-Hasura-User-Id`, rather than trusting a JWT role claim
alone (that's the whole point of "role alone isn't enough").

Required relationships (object/array) before writing permissions:
- `workflows.org` -> `organizations`
- `workflows.members` (array, via org) -> `org_members` where `org_members.org_id = workflows.org_id`
- `workflow_steps.workflow` -> `workflows`
- `workflow_triggers.workflow` -> `workflows`
- `workflow_runs.workflow` -> `workflows`
- `step_runs.workflow_run` -> `workflow_runs`

---

## Layer 1 — org + role scoping

### `org_members` table
**select** (role: `user`):
```yaml
filter:
  user_id: { _eq: X-Hasura-User-Id }
```
This lets a user see only their own membership rows (org_id + role), which the
frontend then uses to build org context. Do NOT allow `_or` here — a user should
never be able to list other members' rows this way (member listing is a separate,
owner-only permission on the same table with a different filter).

**select** (separate permission for owners, role: `user`, but scoped via check):
```yaml
filter:
  org_id:
    _in:
      _ceq: []  # not supported directly — instead use a relationship-based filter:
  organization:
    org_members:
      user_id: { _eq: X-Hasura-User-Id }
      role: { _eq: owner }
```
(This says: return org_member rows belonging to orgs where the *caller* is an owner.)

### `workflows` table
**select**:
```yaml
filter:
  organization:
    org_members:
      user_id: { _eq: X-Hasura-User-Id }
```
Any role (owner/editor/viewer) can see workflows in their own org — nothing else.

**insert** (owner + editor only):
```yaml
check:
  organization:
    org_members:
      user_id: { _eq: X-Hasura-User-Id }
      role: { _in: [owner, editor] }
```

**update/delete** — same check as insert.

### `workflow_steps` / `workflow_triggers` (general case)
**select**: same org-membership filter pattern via `workflow.organization.org_members`.

**insert/update** (owner + editor):
```yaml
check:
  workflow:
    organization:
      org_members:
        user_id: { _eq: X-Hasura-User-Id }
        role: { _in: [owner, editor] }
```

### `workflow_runs` / `step_runs`
**select**: filter via `workflow.organization.org_members.user_id = X-Hasura-User-Id`
so cross-org guessing an ID returns empty, not an error — this is what makes
"can't even guess an ID" hold up.

Viewers get **select only** — no insert permission on `workflow_runs` at all
(triggering happens through the `triggerWorkflowRun` Action, which is where the
role check actually lives, not a table permission).

---

## Layer 2 — step-level gating (owner-only for db_write / webhook / notify)

This can't be a plain role check because it depends on the **value of a column**
(`type`), so it needs a conditional check clause:

### `workflow_steps` insert — tighter check
```yaml
check:
  _or:
    - type: { _nin: [db_write] }
    - _and:
        - type: { _eq: db_write }
        - workflow:
            organization:
              org_members:
                user_id: { _eq: X-Hasura-User-Id }
                role: { _eq: owner }
```
Read as: "either this isn't a `db_write` step, or if it is, the caller must be
an owner in that workflow's org." Editors can still insert `llm_call`,
`http_request`, `conditional_branch`, `approval_gate` steps freely.

### `workflow_triggers` insert — tighter check
```yaml
check:
  _or:
    - type: { _nin: [webhook] }
    - _and:
        - type: { _eq: webhook }
        - workflow:
            organization:
              org_members:
                user_id: { _eq: X-Hasura-User-Id }
                role: { _eq: owner }
```

### `notify` steps
Same pattern as `db_write` above, since `notify` also requires owner per the spec —
add it to the `_nin` / `_eq` list alongside `db_write` (either as one combined
check or a second `_or` branch).

### The part Hasura permissions CANNOT do: approval_gate resume
Per the spec this is intentionally **not** a database permission — it's a
mid-execution decision, so it's enforced in `approveStep.ts` (already done in
the revised handler): it re-reads the step's org, looks up the caller's role in
`org_members`, and only resumes if `owner`/`editor`. Don't try to replicate this
as a Hasura update permission on `step_runs.approved_by` — it won't be able to
express "and also actually continue running the workflow."

---

## Quick sanity check against the eval criteria
- "editor in Org A can never touch Org B's data even with the same role" →
  every filter/check above joins through `org_members.user_id` scoped to the
  *specific* org on the row, not a global role — so role is necessary but never
  sufficient.
- "not even by guessing an ID directly" → select filters return an empty set for
  rows outside the caller's org, rather than a 403 — GraphQL id-based lookups on
  someone else's `workflow_run_id` will just come back null.