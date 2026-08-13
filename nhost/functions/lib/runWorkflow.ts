import { Client } from 'pg'

export async function runWorkflow(orgId: string, workflowId: string, startedBy: string | null) {
  const client = new Client({
    host: process.env.PGHOST,
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const orgResult = await client.query(
      `SELECT quota_used, quota_limit FROM organizations WHERE id = $1`,
      [orgId]
    )
    const { quota_used, quota_limit } = orgResult.rows[0]
    if (quota_used >= quota_limit) {
      return { status: 400, body: { message: 'Quota exceeded' } }
    }

    const runResult = await client.query(
      `INSERT INTO workflow_runs (workflow_id, status, started_by) VALUES ($1, 'running', $2) RETURNING id`,
      [workflowId, startedBy]
    )
    const runId = runResult.rows[0].id

    const stepsResult = await client.query(
      `SELECT id, type, config FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
      [workflowId]
    )

    for (const step of stepsResult.rows) {
      await client.query(
        `INSERT INTO step_runs (workflow_run_id, step_id, status) VALUES ($1, $2, 'running')`,
        [runId, step.id]
      )

      if (step.type === 'approval_gate') {
        await client.query(`UPDATE workflow_runs SET status = 'paused' WHERE id = $1`, [runId])
        await client.query(
          `UPDATE step_runs SET status = 'paused' WHERE workflow_run_id = $1 AND step_id = $2`,
          [runId, step.id]
        )
        return { status: 200, body: { run_id: runId, status: 'paused' } }
      }

      let output: any = null
      let attempt = 0
      let success = false
      let lastError = ''

      while (attempt < 2 && !success) {
        attempt++
        try {
          if (step.type === 'llm_call') {
            output = await callLLM(step.config)
          } else if (step.type === 'http_request') {
            output = await callHttp(step.config)
          } else if (step.type === 'db_write') {
            output = { saved: true }
          } else if (step.type === 'notify') {
            output = { notified: true }
          } else if (step.type === 'conditional_branch') {
            const prevOutput = output
            const condition = step.config?.condition || 'success'
            const lastText = (prevOutput && prevOutput.text) ? prevOutput.text.toLowerCase() : ''
            if (lastText.includes(condition.toLowerCase())) {
              output = { branch: 'true_path', matched: condition }
            } else {
              output = { branch: 'false_path', matched: condition }
            }
          }
          success = true
        } catch (err: any) {
          lastError = err.message
        }
      }

      if (!success) {
        await client.query(
          `UPDATE step_runs SET status = 'failed', error = $1, attempt_count = $2 WHERE workflow_run_id = $3 AND step_id = $4`,
          [lastError, attempt, runId, step.id]
        )
        await client.query(`UPDATE workflow_runs SET status = 'failed', finished_at = now() WHERE id = $1`, [runId])
        return { status: 200, body: { run_id: runId, status: 'failed' } }
      }

      await client.query(
        `UPDATE step_runs SET status = 'completed', output = $1, attempt_count = $2 WHERE workflow_run_id = $3 AND step_id = $4`,
        [JSON.stringify(output), attempt, runId, step.id]
      )
    }

    await client.query(`UPDATE workflow_runs SET status = 'completed', finished_at = now() WHERE id = $1`, [runId])
    await client.query(`UPDATE organizations SET quota_used = quota_used + 1 WHERE id = $1`, [orgId])

    return { status: 200, body: { run_id: runId, status: 'completed' } }
  } catch (err: any) {
    console.error('FULL ERROR:', err)
    return { status: 500, body: { message: err.message } }
  } finally {
    await client.end()
  }
}
async function callLLM(config: any) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: config.system_prompt || 'You are a helpful assistant.' },
        { role: 'user', content: config.prompt || config.user_prompt || 'Analyze this.' }
      ],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 500
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error('LLM API failed: ' + errText)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''
  return { text }
}

async function callHttp(config: any) {
  const response = await fetch(config.url, { method: config.method || 'GET' })
  return { status: response.status }
}