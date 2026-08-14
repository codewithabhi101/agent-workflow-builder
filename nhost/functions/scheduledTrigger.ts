import { Request, Response } from 'express'
import { Client } from 'pg'
import { runWorkflow } from './lib/runWorkflow.js'

// Register this as an nhost Scheduled Function (cron), one entry per
// workflow_trigger row of type 'scheduled', OR run it as a single cron job
// that queries all due scheduled triggers each tick. Simpler version below:
// one nhost scheduled function per trigger, cron config read from workflow_triggers.config.cron.

export default async (req: Request, res: Response) => {
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

    // pick up all workflow_triggers of type 'scheduled' — nhost's cron scheduler
    // calls this on the fixed cadence configured in nhost/cron-jobs.yaml
    const triggers = await client.query(
      `SELECT wt.workflow_id, w.org_id
       FROM workflow_triggers wt
       JOIN workflows w ON w.id = wt.workflow_id
       WHERE wt.type = 'scheduled'`
    )

    await client.end()

    const results = []
    for (const t of triggers.rows) {
      const result = await runWorkflow(t.org_id, t.workflow_id, null)
      results.push({ workflow_id: t.workflow_id, ...result.body })
    }

    return res.status(200).json({ ran: results.length, results })
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  }
}

/* nhost/cron-jobs.yaml entry needed:
- name: run-scheduled-workflows
  webhook: '{{NHOST_FUNCTIONS_URL}}/scheduledTrigger'
  schedule: '*\/5 * * * *'   # every 5 minutes — adjust as needed
*/