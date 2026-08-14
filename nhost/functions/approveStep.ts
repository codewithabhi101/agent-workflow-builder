import { Request, Response } from 'express'
import { Client } from 'pg'
import { resumeWorkflowAfterApproval } from './lib/runWorkflow.js'

export default async (req: Request, res: Response) => {
  const { step_run_id } = req.body.input
  const userId = req.body.session_variables?.['x-hasura-user-id'] || (req.headers['x-hasura-user-id'] as string)
  const client = new Client({
    host: process.env.PGHOST,
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false }
  })
  let clientClosed = false
  try {
    await client.connect()

    const stepRunResult = await client.query(
      `SELECT sr.id, sr.status, sr.workflow_run_id, ws.step_order, ws.type, wr.workflow_id
       FROM step_runs sr
       JOIN workflow_steps ws ON ws.id = sr.step_id
       JOIN workflow_runs wr ON wr.id = sr.workflow_run_id
       WHERE sr.id = $1`,
      [step_run_id]
    )
    if (stepRunResult.rows.length === 0) {
      return res.status(400).json({ message: 'Step run not found' })
    }
    const { status, workflow_run_id, step_order, type, workflow_id } = stepRunResult.rows[0]

    // --- validate this is actually a paused approval_gate (was missing) ---
    if (type !== 'approval_gate') {
      return res.status(400).json({ message: 'This step is not an approval_gate' })
    }
    if (status !== 'paused') {
      return res.status(400).json({ message: `Step is not awaiting approval (current status: ${status})` })
    }

    const wfResult = await client.query(`SELECT org_id FROM workflows WHERE id = $1`, [workflow_id])
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
      return res.status(403).json({ message: 'Insufficient role to approve this step' })
    }

    await client.query(
      `UPDATE step_runs SET status = 'completed', approved_by = $1, approved_at = now() WHERE id = $2`,
      [userId, step_run_id]
    )

    await client.end()
    clientClosed = true

    // actually resume execution from the next step (was missing)
    const result = await resumeWorkflowAfterApproval(orgId, workflow_id, workflow_run_id, step_order + 1)
    return res.status(result.status).json({ step_run_id, ...result.body })
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  } finally {
    if (!clientClosed) {
      try { await client.end() } catch {}
    }
  }
}