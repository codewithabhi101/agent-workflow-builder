// server/executor.ts - Workflow execution engine: trigger, step processing, retry, approval pause/resume

import { db, WorkflowRunEntity, StepRunEntity, WorkflowStepEntity } from './db';
import { callGroqLLM } from './groq';

interface ApiError extends Error {
  status?: number;
}
function apiError(message: string, status: number): ApiError {
  const e: ApiError = new Error(message);
  e.status = status;
  return e;
}

// --- live subscription registry (backs the SSE stream in server.ts) ---
type Subscriber = (run: WorkflowRunEntity) => void;
const subscribers: Map<string, Set<Subscriber>> = new Map();

function notify(run: WorkflowRunEntity) {
  const subs = subscribers.get(run.id);
  if (subs) subs.forEach((cb) => cb(run));
}

export function subscribeToRun(runId: string, cb: Subscriber): () => void {
  if (!subscribers.has(runId)) subscribers.set(runId, new Set());
  subscribers.get(runId)!.add(cb);
  return () => {
    subscribers.get(runId)?.delete(cb);
  };
}

// --- condition evaluation (used by 'conditional' steps) ---
export function evaluateCondition(value: number, operator: string, threshold: number): { matched: boolean } {
  switch (operator) {
    case '>': return { matched: value > threshold };
    case '>=': return { matched: value >= threshold };
    case '<': return { matched: value < threshold };
    case '<=': return { matched: value <= threshold };
    case '==':
    case '=': return { matched: value === threshold };
    case '!=': return { matched: value !== threshold };
    default: return { matched: false };
  }
}

function nextRunNumber(): number {
  const runs = db.getAllRuns();
  return runs.length > 0 ? Math.max(...runs.map((r) => r.run_number)) + 1 : 101;
}

// --- retry wrapper: at least one retry on failure, as required ---
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<{ result?: T; error?: string; attempts: number }> {
  let lastError = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      return { result, attempts: attempt };
    } catch (err: any) {
      lastError = err.message;
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return { error: lastError, attempts: maxAttempts };
}

// ===========================================================
// triggerWorkflowRun — the core entry point (Layer 1 + quota)
// ===========================================================
export async function triggerWorkflowRun(opts: {
  workflowId: string;
  orgId: string;
  userId: string;
  triggerType: 'manual' | 'webhook' | 'scheduled';
  initialPayload?: any;
}): Promise<WorkflowRunEntity> {
  const { workflowId, orgId, userId, triggerType, initialPayload } = opts;

  const workflow = db.getWorkflow(workflowId);
  if (!workflow) throw apiError(`Workflow [${workflowId}] not found.`, 404);

  // --- Layer 1: org scoping — role alone is never enough ---
  if (workflow.org_id !== orgId) {
    throw apiError(
      `Cross-organization access denied: workflow belongs to [${workflow.org_id}], not [${orgId}].`,
      403
    );
  }

  // manual triggers need a real member with owner/editor role;
  // webhook/scheduled triggers are system-initiated and skip the human role check
  if (triggerType === 'manual') {
    const member = db.getMember(orgId, userId);
    if (!member) throw apiError(`User [${userId}] is not a member of [${orgId}].`, 403);
    if (member.role === 'viewer') {
      throw apiError(`Access denied: viewer role cannot trigger workflow runs.`, 403);
    }
  }

  // --- quota check ---
  const org = db.getOrganization(orgId);
  if (!org) throw apiError(`Organization [${orgId}] not found.`, 404);
  if (org.quota_used >= org.quota_limit) {
    throw apiError(`Organization quota exhausted (${org.quota_used}/${org.quota_limit}).`, 403);
  }

  const run: WorkflowRunEntity = {
    id: `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    workflow_id: workflowId,
    org_id: orgId,
    run_number: nextRunNumber(),
    trigger_type: triggerType,
    status: 'running',
    started_at: new Date().toISOString(),
    duration: '0s',
    triggered_by: userId,
    step_runs: {},
  };
  db.saveRun(run);
  notify(run);

  // execute asynchronously — caller gets the run object immediately,
  // subscribers/polling pick up progress as it happens
  processSteps(run, workflow.steps, 0, initialPayload).catch((err) => {
    run.status = 'failed';
    run.error = err.message;
    run.finished_at = new Date().toISOString();
    db.saveRun(run);
    notify(run);
  });

  return run;
}

// ===========================================================
// processSteps — the actual ordered execution loop
// ===========================================================
async function processSteps(
  run: WorkflowRunEntity,
  steps: WorkflowStepEntity[],
  fromIndex: number,
  seedPayload?: any
) {
  let previousOutput: any = seedPayload ? { ...seedPayload } : null;

  // if resuming after an approval gate, carry forward the last completed step's output
  if (fromIndex > 0) {
    const priorStep = steps[fromIndex - 1];
    const priorStepRun = priorStep ? run.step_runs[priorStep.id] : undefined;
    if (priorStepRun?.output) previousOutput = priorStepRun.output;
  }

  for (let i = fromIndex; i < steps.length; i++) {
    const step = steps[i];

    const stepRun: StepRunEntity = {
      id: `sr_${run.id}_${step.id}`,
      workflow_run_id: run.id,
      step_id: step.id,
      status: 'running',
      output: null,
      attempt_count: 0,
      updated_at: new Date().toISOString(),
    };
    run.step_runs[step.id] = stepRun;
    db.saveRun(run);
    notify(run);

    // --- approval_gate: pause and stop, wait for approveWorkflowStep ---
    if (step.step_type === 'approval_gate') {
      stepRun.status = 'paused';
      stepRun.updated_at = new Date().toISOString();
      run.status = 'paused';
      db.saveRun(run);
      notify(run);
      return;
    }

    // --- conditional: branch on previous step's output, no external call ---
    if (step.step_type === 'conditional') {
      const field = step.config.field || 'score';
      const operator = step.config.operator || '>';
      const threshold = step.config.value ?? 0;
      const fieldValue = previousOutput ? previousOutput[field] : undefined;
      const { matched } = evaluateCondition(Number(fieldValue), operator, Number(threshold));

      stepRun.status = 'completed';
      stepRun.output = { field, operator, threshold, value: fieldValue, matched };
      stepRun.attempt_count = 1;
      stepRun.updated_at = new Date().toISOString();
      db.saveRun(run);
      notify(run);

      previousOutput = stepRun.output;
      continue;
    }

    let execResult: { result?: any; error?: string; attempts: number };

    if (step.step_type === 'trigger') {
      execResult = { result: previousOutput || { triggered_by: run.triggered_by, org_id: run.org_id }, attempts: 1 };
    } else if (step.step_type === 'llm') {
      execResult = await withRetry(async () => {
        const llm = await callGroqLLM(
          step.config.prompt,
          step.config.system_prompt,
          step.config.model,
          step.config.max_tokens,
          step.config.temperature
        );
        return llm.parsed;
      });
    } else if (step.step_type === 'http') {
      execResult = await withRetry(async () => {
        const res = await fetch(step.config.url, {
          method: step.config.method || 'POST',
          headers: step.config.headers || { 'Content-Type': 'application/json' },
          body: step.config.body ? JSON.stringify(step.config.body) : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        try { return JSON.parse(text); } catch { return { raw: text, statusCode: res.status }; }
      });
    } else if (step.step_type === 'db_write') {
      execResult = await withRetry(async () => {
        db.recordAudit(run.org_id, run.workflow_id, run.id, 'db_write', previousOutput);
        return { table: step.config.target_table || 'audit_logs', status: 'PERSISTED_OK' };
      });
    } else if (step.step_type === 'notify') {
      execResult = await withRetry(async () => {
        db.recordAudit(run.org_id, run.workflow_id, run.id, 'notify', {
          message: `Workflow ${run.workflow_id} notification`,
          channel: step.config.channel || 'slack',
        });
        return { queued: true };
      });
    } else {
      execResult = { error: `Unknown step type: ${step.step_type}`, attempts: 0 };
    }

      if (execResult.error) {
      console.error(`STEP FAILED [${step.id}]:`, execResult.error);
      stepRun.status = 'failed';
      stepRun.error = execResult.error;
      stepRun.attempt_count = execResult.attempts;
      stepRun.updated_at = new Date().toISOString();
      run.status = 'failed';
      run.error = execResult.error;
      run.finished_at = new Date().toISOString();
      db.saveRun(run);
      notify(run);
      return;
    }

    stepRun.status = 'completed';
    stepRun.output = execResult.result;
    stepRun.attempt_count = execResult.attempts;
    stepRun.updated_at = new Date().toISOString();
    db.saveRun(run);
    notify(run);

    previousOutput = execResult.result;
  }

  // --- all steps finished ---
  run.status = 'completed';
  run.finished_at = new Date().toISOString();
  const startMs = new Date(run.started_at).getTime();
  run.duration = `${((Date.now() - startMs) / 1000).toFixed(1)}s`;

  const org = db.getOrganization(run.org_id);
  if (org) org.quota_used += 1; // quota increment on completion

  db.saveRun(run);
  notify(run);
}

// ===========================================================
// approveWorkflowStep — Layer 2 gate: role check lives HERE,
// not as a DB permission, since it's a mid-execution decision
// ===========================================================
export async function approveWorkflowStep(opts: {
  stepId: string;
  runId: string;
  userId: string;
  orgId: string;
}): Promise<WorkflowRunEntity> {
  const { stepId, runId, userId, orgId } = opts;

  const run = db.getAllRuns().find((r) => r.id === runId);
  if (!run) throw apiError(`Run [${runId}] not found.`, 404);

  if (run.org_id !== orgId) {
    throw apiError(`Cross-organization access denied for run [${runId}].`, 403);
  }

  const stepRun = run.step_runs[stepId];
  if (!stepRun) throw apiError(`Step run [${stepId}] not found on this run.`, 404);
  if (stepRun.status !== 'paused') {
    throw apiError(`Step [${stepId}] is not awaiting approval (current status: ${stepRun.status}).`, 400);
  }

  const member = db.getMember(orgId, userId);
  if (!member) throw apiError(`User [${userId}] is not a member of [${orgId}].`, 403);
  if (member.role === 'viewer') {
    throw apiError(`Viewer role cannot approve workflow steps.`, 403);
  }

  stepRun.status = 'completed';
  stepRun.approved_by = userId;
  stepRun.approved_at = new Date().toISOString();
  stepRun.updated_at = new Date().toISOString();
  run.status = 'running';
  db.saveRun(run);
  notify(run);

  const workflow = db.getWorkflow(run.workflow_id);
  if (!workflow) throw apiError(`Workflow [${run.workflow_id}] not found.`, 404);

  const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
  const fromIndex = stepIndex === -1 ? workflow.steps.length : stepIndex + 1;

  // resume execution asynchronously from the step after the gate
  processSteps(run, workflow.steps, fromIndex).catch((err) => {
    run.status = 'failed';
    run.error = err.message;
    run.finished_at = new Date().toISOString();
    db.saveRun(run);
    notify(run);
  });

  return run;
}