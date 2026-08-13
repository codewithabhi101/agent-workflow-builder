import { Request, Response } from 'express'
import { Client } from 'pg'
import { runWorkflow } from './lib/runWorkflow.js'

export default async (req: Request, res: Response) => {
  const { workflow_id } = req.body.input
  const userId = req.body.session_variables?.['x-hasura-user-id'] || (req.headers['x-hasura-user-id'] as string)

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

    await client.end()

    const result = await runWorkflow(orgId, workflow_id, userId)
    return res.status(result.status).json(result.body)
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  }
}