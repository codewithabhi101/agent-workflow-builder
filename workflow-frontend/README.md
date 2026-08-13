# AI Agent Workflow Builder (Full-Stack SDE Assignment)

A production-grade, multi-tenant AI workflow orchestration engine and visual builder. Users within organizations can construct, trigger, and observe complex DAG pipelines with real LLM reasoning, HTTP dispatch, dynamic conditional branching, human-in-the-loop approval gates, and durable database persistence.

---

## 🌟 Executive Summary & Architecture

### 1. Data Model & Schema Design
The backend schema is modeled around strict relational integrity:
- **`organizations`**: Multi-tenant boundary with quota limits (`quota_limit`, `quota_used`) and billing period timestamps.
- **`org_members`**: Organization memberships mapping `user_id` to roles (`owner`, `editor`, `viewer`).
- **`workflows`**: Workflow definitions tied directly to an `org_id`.
- **`workflow_steps`**: Ordered nodes (`position`, `step_type`, `config` JSONB).
- **`workflow_triggers`**: Trigger configurations (`manual`, `webhook`, `scheduled`, `event`).
- **`workflow_runs`**: Execution instances supporting `pending`, `running`, `paused`, `completed`, and `failed` states.
- **`step_runs`**: Node-level execution telemetry (`input`, `output`, `error`, `attempt_count`, `approved_by`, `approved_at`, `duration_ms`).
- **`audit_logs`**: PostgreSQL persistence sink recording immutable audit trails with cryptographic run signatures.

---

## 🛡️ Two-Layer Permission Architecture

### Layer 1: Organization & Role Scoping
- Every request resolves the authenticated caller's identity against `org_members`.
- Tenant isolation is absolute: users from Organization A cannot view, execute, or guess workflow IDs belonging to Organization B.
- **Role Hierarchy**:
  - `owner`: Full administrative control, workflow CRUD, member management, execution, and approval authorization.
  - `editor`: Workflow & standard step authoring, workflow execution, and approval authorization.
  - `viewer`: Read-only telemetry access. Triggering workflows and approving gates are blocked with `403 Forbidden`.

### Layer 2: Step-Level Gating & Mid-Execution Verification
- Privileged step types (`db_write`, `notify`, `webhook` creation) reach outside the sandbox and are restricted strictly to **Owner** roles on the server.
- The `approveWorkflowStep` handler verifies caller permissions dynamically during execution—preventing unauthorized users from bypassing gate controls.

---

## ⚡ Core Engine & Execution Lifecycle

1. **Trigger Phase**: Workflow is initiated via Manual UI button or external Webhook payload (`POST /api/workflow/webhook/:workflowId`).
2. **Quota Check**: Verifies `quota_used < quota_limit` atomically before dispatch.
3. **Groq LLM Reasoning**: Calls Groq API (`llama-3.3-70b-versatile`) with structured JSON schema output, exponential backoff retries, and token telemetry.
4. **HTTP Dispatch**: Executes external REST calls with retry policies and response context propagation.
5. **Conditional Branching**: Evaluates comparative operators (`>`, `<`, `>=`, `<=`, `==`, `!=`) over previous step output.
6. **Approval Gate (Human-in-the-Loop)**:
   - Run transitions to `paused` state.
   - Live stream notifies the frontend with zero page refreshes.
   - Execution halts until an authorized Owner or Editor submits approval.
7. **Database Write**: Persists the final approved output into the PostgreSQL audit sink table.
8. **Completion**: Updates workflow run status to `completed` and increments organization quota.

---

## 🚀 Quickstart & Local Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file from `.env.example`:
```env
PORT=3000
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Run Automated Acceptance Tests (15/15 Pass)
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to access the visual builder.

---

## 🧪 Verification Matrix

| Test Case | Scenario | Result |
|---|---|:---:|
| **Test 1** | Owner workflow creation & permissions | **PASS** |
| **Test 2** | Editor normal step creation | **PASS** |
| **Test 3** | Editor denied creating privileged `db_write` step | **PASS** |
| **Test 4** | Viewer denied triggering workflow execution | **PASS** |
| **Test 5** | Cross-organization tenant execution blocked | **PASS** |
| **Test 6** | Direct workflow ID guessing across tenants rejected | **PASS** |
| **Test 7** | Quota exhaustion blocks new executions | **PASS** |
| **Test 8** | Groq LLM risk analysis with retry policy | **PASS** |
| **Test 9** | Real HTTP request execution with retry policy | **PASS** |
| **Test 10** | Conditional branching operator evaluation (`score > 70`) | **PASS** |
| **Test 11** | Workflow execution halts & pauses at Approval Gate | **PASS** |
| **Test 12** | Unauthorized approval request from viewer rejected | **PASS** |
| **Test 13** | Authorized approval resumes workflow and persists DB write | **PASS** |
| **Test 14** | External Webhook Trigger starts workflow automatically | **PASS** |
| **Test 15** | Live step-by-step real-time streaming updates | **PASS** |
