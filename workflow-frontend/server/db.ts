// server/db.ts - In-memory and PostgreSQL-compatible relational store with multi-tenant isolation

export interface Organization {
  id: string;
  name: string;
  quota_used: number;
  quota_limit: number;
}

export type OrgRole = 'owner' | 'editor' | 'viewer';

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  user_email: string;
  role: OrgRole;
}

export interface WorkflowStepEntity {
  id: string;
  workflow_id: string;
  step_order: number;
  step_type: 'trigger' | 'llm' | 'http' | 'conditional' | 'approval_gate' | 'db_write' | 'notify';
  title: string;
  config: Record<string, any>;
}

export interface WorkflowEntity {
  id: string;
  title: string;
  description: string;
  org_id: string;
  is_active: boolean;
  steps: WorkflowStepEntity[];
}

export interface StepRunEntity {
  id: string;
  workflow_run_id: string;
  step_id: string;
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed' | 'skipped';
  output: any;
  error?: string;
  attempt_count: number;
  approved_by?: string;
  approved_at?: string;
  duration_ms?: number;
  updated_at: string;
}

export interface WorkflowRunEntity {
  id: string;
  workflow_id: string;
  org_id: string;
  run_number: number;
  trigger_type: 'manual' | 'webhook' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'paused' | 'failed';
  started_at: string;
  finished_at?: string;
  duration: string;
  triggered_by: string;
  error?: string;
  step_runs: Record<string, StepRunEntity>;
}

export interface AuditLogEntity {
  id: string;
  org_id: string;
  workflow_id: string;
  run_id: string;
  action: string;
  payload: any;
  created_at: string;
}

class DatabaseStore {
  organizations: Map<string, Organization> = new Map();
  orgMembers: Map<string, OrgMember> = new Map();
  workflows: Map<string, WorkflowEntity> = new Map();
  workflowRuns: Map<string, WorkflowRunEntity> = new Map();
  stepRuns: Map<string, StepRunEntity> = new Map();
  auditLogs: AuditLogEntity[] = [];

  constructor() {
    this.seed();
  }

  seed() {
    // 1. Organizations
    this.organizations.set('org_acme_corp', {
      id: 'org_acme_corp',
      name: 'Acme Corp (Primary Tenant)',
      quota_used: 80,
      quota_limit: 100,
    });

    this.organizations.set('org_competitor_corp', {
      id: 'org_competitor_corp',
      name: 'Competitor Inc (Isolated Tenant)',
      quota_used: 10,
      quota_limit: 50,
    });

    // 2. Members with Roles
    const members: OrgMember[] = [
      { id: 'mem_1', org_id: 'org_acme_corp', user_id: 'usr_owner_acme', user_email: 'owner@acme.com', role: 'owner' },
      { id: 'mem_2', org_id: 'org_acme_corp', user_id: 'usr_editor_acme', user_email: 'editor@acme.com', role: 'editor' },
      { id: 'mem_3', org_id: 'org_acme_corp', user_id: 'usr_viewer_acme', user_email: 'viewer@acme.com', role: 'viewer' },
      { id: 'mem_4', org_id: 'org_competitor_corp', user_id: 'usr_owner_comp', user_email: 'owner@competitor.com', role: 'owner' },
    ];
    members.forEach((m) => this.orgMembers.set(`${m.org_id}_${m.user_id}`, m));

    // 3. Workflow
    const defaultSteps: WorkflowStepEntity[] = [
      {
        id: 'step_1_trigger',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 1,
        step_type: 'trigger',
        title: 'Workflow Trigger',
        config: {
          method: 'POST',
          description: 'Initiates workflow run on incoming customer payload via manual UI or external webhook URL.',
        },
      },
      {
        id: 'step_2_llm',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 2,
        step_type: 'llm',
        title: 'Groq LLM Risk Scoring',
        config: {
          provider: 'Groq Cloud',
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          max_tokens: 1024,
          system_prompt: 'You are an expert enterprise risk and technical operations analyst. Always output valid JSON with score (0-100), risk_level (LOW/MEDIUM/HIGH), reasoning, and recommendation (APPROVE/REJECT).',
          prompt: 'Analyze this customer portfolio: enterprise cloud migration request with custom compliance and high SLA demands. Output strict JSON with fields: score (integer 0-100), risk_level (LOW/MEDIUM/HIGH), reasoning (summary string), and recommendation (APPROVE/REJECT).',
        },
      },
      {
        id: 'step_3_http',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 3,
        step_type: 'http',
        title: 'HTTP Webhook Sync',
        config: {
          method: 'POST',
          url: 'https://postman-echo.com/post',
          headers: { 'Content-Type': 'application/json', 'X-Workflow-Source': 'agent-builder-v1' },
          body: { sync_target: 'enterprise_crm_pipeline', priority: 'HIGH' },
          timeout_ms: 5000,
        },
      },
      {
        id: 'step_4_conditional',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 4,
        step_type: 'conditional',
        title: 'Condition: score > 70',
        config: {
          field: 'score',
          operator: '>',
          value: 70,
          description: 'Verify if evaluated customer score exceeds 70/100 threshold before seeking executive approval.',
        },
      },
      {
        id: 'step_5_approval',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 5,
        step_type: 'approval_gate',
        title: 'Executive Approval Gate',
        config: {
          required_role: 'editor',
          description: 'Suspends execution and holds state until an authorized Organization Reviewer clicks Approve to Resume.',
        },
      },
      {
        id: 'step_6_db_write',
        workflow_id: 'wf_prod_customer_analyzer_v1',
        step_order: 6,
        step_type: 'db_write',
        title: 'PostgreSQL Audit Sink',
        config: {
          target_table: 'audit_logs',
          fields: ['run_id', 'workflow_id', 'org_id', 'score', 'risk_level', 'approved_by', 'timestamp'],
          description: 'Persists finalized customer decision and signed approval token into PostgreSQL audit database.',
        },
      },
    ];

    this.workflows.set('wf_prod_customer_analyzer_v1', {
      id: 'wf_prod_customer_analyzer_v1',
      title: 'Customer Intent & Risk Analyzer',
      description: 'Production AI workflow parsing incoming user requests with Groq LLM, triggering Webhooks, assessing risk conditions, pausing for human review, and updating PostgreSQL audit storage.',
      org_id: 'org_acme_corp',
      is_active: true,
      steps: defaultSteps,
    });

    // Seed prior runs
    const priorRun: WorkflowRunEntity = {
      id: 'run_102',
      workflow_id: 'wf_prod_customer_analyzer_v1',
      org_id: 'org_acme_corp',
      run_number: 102,
      trigger_type: 'manual',
      status: 'completed',
      started_at: new Date(Date.now() - 120000).toISOString(),
      finished_at: new Date(Date.now() - 60000).toISOString(),
      duration: '3.2s',
      triggered_by: 'usr_owner_acme',
      step_runs: {},
    };
    this.workflowRuns.set(priorRun.id, priorRun);
  }

  getOrganization(orgId: string): Organization | undefined {
    return this.organizations.get(orgId);
  }

  getMember(orgId: string, userId: string): OrgMember | undefined {
    return this.orgMembers.get(`${orgId}_${userId}`);
  }

  getWorkflow(workflowId: string): WorkflowEntity | undefined {
    return this.workflows.get(workflowId);
  }

  getAllRuns(orgId?: string): WorkflowRunEntity[] {
    const list = Array.from(this.workflowRuns.values());
    if (orgId) {
      return list.filter((r) => r.org_id === orgId).sort((a, b) => b.run_number - a.run_number);
    }
    return list.sort((a, b) => b.run_number - a.run_number);
  }

  createWorkflow(workflow: WorkflowEntity) {
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  addStep(workflowId: string, step: WorkflowStepEntity) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow [${workflowId}] not found.`);
    wf.steps.push(step);
    return step;
  }

  saveRun(run: WorkflowRunEntity) {
    this.workflowRuns.set(run.id, run);
  }
// remmmmmm
  recordAudit(orgId: string, workflowId: string, runId: string, action: string, payload: any) {
    this.auditLogs.push({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      org_id: orgId,
      workflow_id: workflowId,
      run_id: runId,
      action,
      payload,
      created_at: new Date().toISOString(),
    });
  }
}

export const db = new DatabaseStore();
