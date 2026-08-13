import { Request, Response } from 'express'
import { Client } from 'pg'

export default async (req: Request, res: Response) => {
  const { workflow_id } = req.body.input
  const userId = req.headers['x-hasura-user-id'] as string
  const client = new Client({
    host: 'bhlvcppwdduecuciuxjj.db.eu-central-1.nhost.run',
    port: 5432,
    user: 'postgres',
    password: '5zsJSCyEQ5eptVRy',
    database: 'bhlvcppwdduecuciuxjj',
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const wfResult = await client.query(
      `SELECT org_id FROM workflows WHERE id = $1`,
      [workflow_id]
    )
    if (wfResult.rows.length === 0) {
      return res.status(400).json({ message: 'Workflow not found' })
    }
    const orgId = wfResult.rows[0].org_id

    const memberResult = await client.query(
      `SELECT role FROM org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    )
    if (memberResult.rows.length === 0) {
      return res.status(403).json({ message: 'Not a member of this org' })
    }
    const role = memberResult.rows[0].role
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'Insufficient role to trigger runs' })
    }

    const orgResult = await client.query(
      `SELECT quota_used, quota_limit FROM organizations WHERE id = $1`,
      [orgId]
    )
    const { quota_used, quota_limit } = orgResult.rows[0]
    if (quota_used >= quota_limit) {
      return res.status(400).json({ message: 'Quota exceeded' })
    }

    const runResult = await client.query(
      `INSERT INTO workflow_runs (workflow_id, status, started_by) VALUES ($1, 'running', $2) RETURNING id`,
      [workflow_id, userId]
    )
    const runId = runResult.rows[0].id

    const stepsResult = await client.query(
      `SELECT id, type, config FROM workflow_steps WHERE workflow_id = $1 ORDER BY step_order ASC`,
      [workflow_id]
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
        return res.json({ run_id: runId, status: 'paused' })
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
            output = { branch: 'default' }
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
        return res.json({ run_id: runId, status: 'failed' })
      }

      await client.query(
        `UPDATE step_runs SET status = 'completed', output = $1, attempt_count = $2 WHERE workflow_run_id = $3 AND step_id = $4`,
        [JSON.stringify(output), attempt, runId, step.id]
      )
    }

    await client.query(`UPDATE workflow_runs SET status = 'completed', finished_at = now() WHERE id = $1`, [runId])
    await client.query(`UPDATE organizations SET quota_used = quota_used + 1 WHERE id = $1`, [orgId])

    return res.json({ run_id: runId, status: 'completed' })
 } catch (err: any) {
    console.error('FULL ERROR:', err)
    return res.status(500).json({ message: err.message, code: err.code, detail: err.detail })
  } finally {
    await client.end()
  }
}

async function callLLM(config: any) {
  await new Promise((r) => setTimeout(r, 800))
  return { text: 'stubbed LLM response for prompt: ' + (config.prompt || '') }
}

async function callHttp(config: any) {
  const response = await fetch(config.url, { method: config.method || 'GET' })
  return { status: response.status }
}
