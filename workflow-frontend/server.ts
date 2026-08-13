// server.ts - Full-stack Express server with SSE subscriptions, API endpoints, and Vite middleware

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { triggerWorkflowRun, approveWorkflowStep, subscribeToRun } from './server/executor';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Organizations & Members
  app.get('/api/organizations', (req, res) => {
    const orgs = Array.from(db.organizations.values());
    res.json(orgs);
  });

  app.get('/api/organization/:orgId/members', (req, res) => {
    const { orgId } = req.params;
    const members = Array.from(db.orgMembers.values()).filter((m) => m.org_id === orgId);
    res.json(members);
  });

  // 3. Workflow Details (with strict multi-tenant authorization)
  app.get('/api/workflow/:id', (req, res) => {
    const workflowId = req.params.id;
    const workflow = db.getWorkflow(workflowId);
    if (!workflow) {
      return res.status(404).json({ error: `Workflow [${workflowId}] not found.` });
    }

    const reqOrg = (req.headers['x-org-id'] as string) || (req.query.org_id as string);
    if (reqOrg && reqOrg !== workflow.org_id) {
      return res.status(403).json({
        error: `403 Forbidden: Cross-organization access denied. Tenant [${reqOrg}] cannot access workflow belonging to [${workflow.org_id}].`,
      });
    }

    const org = db.getOrganization(workflow.org_id);
    res.json({
      ...workflow,
      monthly_usage: {
        used: org ? org.quota_used : 80,
        quota: org ? org.quota_limit : 100,
      },
    });
  });

  // 3b. Create Workflow (Owner Only)
  app.post('/api/workflow', (req, res) => {
    const { id, title, description, orgId, userId } = req.body;
    const member = db.getMember(orgId, userId);
    if (!member) {
      return res.status(403).json({ error: `403 Forbidden: User [${userId}] is not a member of [${orgId}].` });
    }
    if (member.role !== 'owner') {
      return res.status(403).json({ error: `403 Forbidden: Only owners can create new workflows.` });
    }

    const newWf = db.createWorkflow({
      id: id || `wf_${Date.now()}`,
      title: title || 'Custom AI Workflow',
      description: description || 'User-defined pipeline',
      org_id: orgId,
      is_active: true,
      steps: [],
    });
    res.status(201).json(newWf);
  });

  // 3c. Add / Configure Step with Step-Level RBAC
  app.post('/api/workflow/:id/step', (req, res) => {
    const workflowId = req.params.id;
    const workflow = db.getWorkflow(workflowId);
    if (!workflow) {
      return res.status(404).json({ error: `Workflow [${workflowId}] not found.` });
    }

    const { orgId, userId, step_type, title, config } = req.body;
    const member = db.getMember(orgId || workflow.org_id, userId);
    if (!member) {
      return res.status(403).json({ error: `403 Forbidden: User [${userId}] is not in organization.` });
    }

    // Step-Level Security: db_write, notify, and webhook trigger are OWNER ONLY
    if ((step_type === 'db_write' || step_type === 'notify') && member.role !== 'owner') {
      return res.status(403).json({
        error: `403 Forbidden: Privileged step type [${step_type}] can only be created or modified by Organization Owners.`,
      });
    }

    if (member.role === 'viewer') {
      return res.status(403).json({ error: `403 Forbidden: Viewers cannot create steps.` });
    }

    const newStep = db.addStep(workflowId, {
      id: `step_${Date.now()}`,
      workflow_id: workflowId,
      step_order: workflow.steps.length + 1,
      step_type,
      title: title || `New ${step_type} step`,
      config: config || {},
    });
    res.status(201).json(newStep);
  });

  // 4. Trigger Workflow Run
  app.post('/api/workflow/run', async (req, res) => {
    try {
      const { workflowId, orgId, userId, payload } = req.body;
      const run = await triggerWorkflowRun({
        workflowId: workflowId || 'wf_prod_customer_analyzer_v1',
        orgId: orgId || 'org_acme_corp',
        userId: userId || 'usr_owner_acme',
        triggerType: 'manual',
        initialPayload: payload,
      });
      res.json(run);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message });
    }
  });

  // 5. Approve Step
  app.post('/api/workflow/approve', async (req, res) => {
    try {
      const { stepId, runId, userId, orgId } = req.body;
      const updatedRun = await approveWorkflowStep({
        stepId,
        runId,
        userId: userId || 'usr_owner_acme',
        orgId: orgId || 'org_acme_corp',
      });
      res.json(updatedRun);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message });
    }
  });

  // 6. Webhook Trigger Endpoints
  const webhookHandler = async (req: express.Request, res: express.Response) => {
    try {
      const targetWorkflowId = req.params.workflowId || req.body.workflow_id || 'wf_prod_customer_analyzer_v1';
      const targetWorkflow = db.getWorkflow(targetWorkflowId);
      if (!targetWorkflow) {
        return res.status(404).json({ error: `Workflow [${targetWorkflowId}] not found.` });
      }

      const { score, ...restPayload } = req.body;
      const run = await triggerWorkflowRun({
        workflowId: targetWorkflowId,
        orgId: targetWorkflow.org_id,
        userId: 'webhook_agent_system',
        triggerType: 'webhook',
        initialPayload: { score: score || 88, ...restPayload, webhook_source: req.headers['user-agent'] || 'external_system' },
      });

      res.status(202).json({
        message: 'Workflow started successfully via Webhook Trigger.',
        run_id: run.id,
        status: run.status,
        workflow_id: run.workflow_id,
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({ error: err.message });
    }
  };

  app.post('/api/webhookTrigger', webhookHandler);
  app.post('/v1/webhookTrigger', webhookHandler);
  app.post('/api/workflow/webhook/:workflowId', webhookHandler);

  // 7. Execution Runs List & History
  app.get('/api/runs', (req, res) => {
    const orgId = req.query.org_id as string | undefined;
    const runs = db.getAllRuns(orgId);
    res.json(runs);
  });

  app.get('/api/runs/:id', (req, res) => {
    const run = db.getAllRuns().find((r) => r.id === req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  });

  // 8. Server-Sent Events (SSE) Live Step Subscriptions
  app.get('/api/workflow/stream/:runId', (req, res) => {
    const { runId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const currentRun = db.getAllRuns().find((r) => r.id === runId);
    if (currentRun) {
      res.write(`data: ${JSON.stringify(currentRun)}\n\n`);
    }

    const unsubscribe = subscribeToRun(runId, (updatedRun) => {
      res.write(`data: ${JSON.stringify(updatedRun)}\n\n`);
      if (updatedRun.status === 'completed' || updatedRun.status === 'failed') {
        setTimeout(() => {
          res.end();
        }, 1000);
      }
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  // 9. Reset Quota & State for testing
  app.post('/api/workflow/reset-quota', (req, res) => {
    const { orgId, quotaUsed } = req.body;
    const org = db.getOrganization(orgId || 'org_acme_corp');
    if (org) {
      org.quota_used = typeof quotaUsed === 'number' ? quotaUsed : 80;
    }
    res.json({ success: true, org });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/\n`);
  });
}

startServer();
