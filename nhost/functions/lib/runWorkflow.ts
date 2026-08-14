import { Client } from 'pg'

function getClient() {
  return new Client({
    host: process.env.PGHOST,
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false }
  })
}

// --- step executors -------------------------------------------------

async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.LLM_API_KEY
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 800))
    return `[stubbed llm response for prompt: ${prompt.slice(0, 40)}]`
  }
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }]
    })
  })
  if (!resp.ok) throw new Error(`LLM API error: ${resp.status}`)
  const data = await resp.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callHttp(url: string, method: string, body?: any): Promise<any> {
  const resp = await fetch(url, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!resp.ok) throw new Error(`HTTP request failed: ${resp.status}`)
  const text = await resp.text()
  try { return JSON.parse(text) } catch { return { raw: text } }
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<{ result?: T; error?: string; attempts: number }> {
  let lastError = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn()
      return { result, attempts: attempt }
    } catch (err: any) {
      lastError = err.message
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
  return { error: lastError, attempts: maxAttempts }
}

// --- main engine ------------------------------------------------------

export async function runWorkflow(orgId: string, workflowId: string, userId: string | null, fromStepOrder = 0, existingRunId?: string) {
  const client = getClient()
  await client.connect()

  let runId = existingRunId

  try {
    const stepsResult = await client.query(
      `SELECT id, step_order, type, config FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
      [workflowId]
    )
    const steps = stepsResult.rows

    if (!runId) {
      const runResult = await client.query(
        `INSERT INTO workflow_runs (workflow_id, status, started_by)
         VALUES ($1, 'running', $2) RETURNING id`,
        [workflowId, userId]
      )
      runId = runResult.rows[0].id
    } else {
      await client.query(`UPDATE workflow_runs SET status = 'running' WHERE id = $1`, [runId])
    }

    let previousOutput: any = null

    let i = steps.findIndex((s: any) => s.step_order >= fromStepOrder)
    if (i === -1) {
      await client.query(`UPDATE workflow_runs SET status = 'completed', finished_at = now() WHERE id = $1`, [runId])
      await client.query(`UPDATE organizations SET quota_used = quota_used + 1 WHERE id = $1`, [orgId])
      return { status: 200, body: { workflow_run_id: runId, status: 'completed' } }
    }

    while (i < steps.length) {
      const step = steps[i]

      const stepRunResult = await client.query(
        `INSERT INTO step_runs (workflow_run_id, step_id, status, input, created_at)
         VALUES ($1, $2, 'running', $3, now()) RETURNING id`,
        [runId, step.id, JSON.stringify(previousOutput)]
      )
      const stepRunId = stepRunResult.rows[0].id

      if (step.type === 'approval_gate') {
        await client.query(`UPDATE step_runs SET status = 'paused' WHERE id = $1`, [stepRunId])
        await client.query(`UPDATE workflow_runs SET status = 'paused' WHERE id = $1`, [runId])
        return { status: 200, body: { workflow_run_id: runId, status: 'paused', paused_at_step_order: step.step_order } }
      }

      if (step.type === 'conditional_branch') {
        const field = step.config.field || 'result'
        const expected = step.config.equals
        const matched = previousOutput && String(previousOutput[field]) === String(expected)
        const nextOrder = matched ? step.config.on_true_step_order : step.config.on_false_step_order

        await client.query(
          `UPDATE step_runs SET status = 'completed', output = $1 WHERE id = $2`,
          [JSON.stringify({ matched, nextOrder }), stepRunId]
        )
        previousOutput = { matched }

        if (nextOrder !== undefined && nextOrder !== null) {
          const jump = steps.findIndex((s: any) => s.step_order === nextOrder)
          i = jump !== -1 ? jump : i + 1
          continue
        }
        i++
        continue
      }

      let execResult
      if (step.type === 'llm_call') {
        execResult = await withRetry(() => callLLM(step.config.prompt || ''))
      } else if (step.type === 'http_request') {
        execResult = await withRetry(() => callHttp(step.config.url, step.config.method, step.config.body))
      } else if (step.type === 'db_write') {
        execResult = await withRetry(async () => {
          await client.query(`INSERT INTO db_write_results (step_run_id, data) VALUES ($1, $2)`, [stepRunId, JSON.stringify(previousOutput)])
          return { written: true }
        })
      } else if (step.type === 'notify') {
        execResult = await withRetry(async () => {
          await client.query(
            `INSERT INTO notifications (step_run_id, org_id, channel, message) VALUES ($1, $2, $3, $4)`,
            [stepRunId, orgId, step.config.channel || 'slack', step.config.message || `Workflow ${workflowId} step update`]
          )
          return { queued: true }
        })
      } else {
        execResult = { error: `Unknown step type: ${step.type}`, attempts: 0 }
      }

      if (execResult.error) {
        await client.query(
          `UPDATE step_runs SET status = 'failed', error = $1, attempt_count = $2 WHERE id = $3`,
          [execResult.error, execResult.attempts, stepRunId]
        )
        await client.query(`UPDATE workflow_runs SET status = 'failed' WHERE id = $1`, [runId])
        return { status: 500, body: { workflow_run_id: runId, status: 'failed', error: execResult.error } }
      }

      await client.query(
        `UPDATE step_runs SET status = 'completed', output = $1, attempt_count = $2 WHERE id = $3`,
        [JSON.stringify(execResult.result), execResult.attempts, stepRunId]
      )
      previousOutput = typeof execResult.result === 'string' ? { result: execResult.result } : execResult.result

      i++
    }

    await client.query(`UPDATE workflow_runs SET status = 'completed', finished_at = now() WHERE id = $1`, [runId])
    await client.query(`UPDATE organizations SET quota_used = quota_used + 1 WHERE id = $1`, [orgId])

    return { status: 200, body: { workflow_run_id: runId, status: 'completed' } }
  } catch (err: any) {
    if (runId) {
      try {
        await client.query(`UPDATE workflow_runs SET status = 'failed' WHERE id = $1`, [runId])
      } catch { /* best effort */ }
    }
    return { status: 500, body: { workflow_run_id: runId, status: 'failed', error: err.message } }
  } finally {
    await client.end()
  }
}

export async function resumeWorkflowAfterApproval(orgId: string, workflowId: string, runId: string, fromStepOrder: number) {
  return runWorkflow(orgId, workflowId, null, fromStepOrder, runId)
}