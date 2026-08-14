import { Request, Response } from 'express'
import { Client } from 'pg'
import { runWorkflow } from './lib/runWorkflow.js'

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
    await client.end()

    const result = await runWorkflow(orgId, workflow_id, null)
    return res.status(result.status).json(result.body)
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  }
}
// lorem