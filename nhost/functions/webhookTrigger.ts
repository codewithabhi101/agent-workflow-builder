import { Request, Response } from 'express'
import { Client } from 'pg'

export default async (req: Request, res: Response) => {
  const { workflow_id } = req.params
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
    const wfResult = await client.query(`SELECT org_id FROM workflows WHERE id = $1`, [workflow_id])
    if (wfResult.rows.length === 0) {
      return res.status(404).json({ message: 'Workflow not found' })
    }
    const orgId = wfResult.rows[0].org_id
    const orgResult = await client.query(`SELECT quota_used, quota_limit FROM organizations WHERE id = $1`, [orgId])
    const { quota_used, quota_limit } = orgResult.rows[0]
    if (quota_used >= quota_limit) {
      return res.status(400).json({ message: 'Quota exceeded' })
    }
    await client.end()
    // delegate to your existing step-execution logic, started_by = null (system trigger)
    const result = await runWorkflow(orgId, workflow_id, null, 'webhook')
    return res.json(result)
  } catch (err: any) {
    return res.status(500).json({ message: 'Webhook trigger failed' })
  }
}