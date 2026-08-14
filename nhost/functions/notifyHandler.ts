import { Request, Response } from 'express'
import { Client } from 'pg'

// Wire this up in Hasura as an Event Trigger on the `notifications` table, INSERT operation.
// Hasura event trigger payload shape: { event: { data: { new: {...} } } }
export default async (req: Request, res: Response) => {
  const row = req.body?.event?.data?.new
  if (!row) return res.status(400).json({ message: 'No row payload' })

  const client = new Client({
    host: process.env.PGHOST,
    port: 5432,
    user: 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false }
  })

  try {
    if (row.channel === 'slack' && process.env.SLACK_WEBHOOK_URL) {
      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: row.message })
      })
    } else {
      // stubbed — log instead of sending, since no webhook/email provider is configured
      console.log(`[notify stub] (${row.channel}) ${row.message}`)
    }

    await client.connect()
    await client.query(`UPDATE notifications SET sent = true WHERE id = $1`, [row.id])
    return res.status(200).json({ ok: true })
  } catch (err: any) {
    return res.status(500).json({ message: err.message })
  } finally {
    await client.end()
  }
}