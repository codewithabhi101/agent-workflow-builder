import { Workflow, ExecutionRunRecord } from './types';

export const INITIAL_WORKFLOW: Workflow = {
  id: 'wf_prod_customer_analyzer_v1',
  title: 'Customer Intent & Risk Analyzer',
  description: 'Production AI workflow parsing incoming user requests with Groq LLM, triggering Webhooks, assessing risk conditions, pausing for human review, and updating PostgreSQL audit storage.',
  org_id: 'org_acme_corp',
  is_active: true,
  monthly_usage: {
    used: 80,
    quota: 100,
  },
  steps: [
    {
      id: 'step_1_trigger',
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
      step_order: 2,
      step_type: 'llm',
      title: 'Groq LLM Risk Scoring',
      config: {
        model: 'llama-3.3-70b-versatile',
        prompt: 'Analyze this customer portfolio: enterprise cloud migration request with custom compliance and high SLA demands. Output strict JSON with fields: score (integer 0-100), risk_level (LOW/MEDIUM/HIGH), reasoning (summary string), and recommendation (APPROVE/REJECT).',
        system_prompt: 'You are an expert enterprise risk and technical operations analyst. Always output valid JSON scoring structure.',
      },
    },
    {
      id: 'step_3_http',
      step_order: 3,
      step_type: 'http',
      title: 'HTTP Webhook Sync',
      config: {
        method: 'POST',
        url: 'https://api.external-crm.com/v1/sync',
        headers: { 'Content-Type': 'application/json', 'X-Trace-Id': 'req_crm_94819' },
        body: { sync_target: 'enterprise_crm_pipeline', priority: 'HIGH' },
      },
    },
    {
      id: 'step_4_conditional',
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
      step_order: 5,
      step_type: 'approval_gate',
      title: 'Executive Approval Gate',
      config: {
        description: 'Suspends execution and holds state until an authorized Organization Reviewer clicks Approve to Resume.',
      },
    },
    {
      id: 'step_6_db_write',
      step_order: 6,
      step_type: 'db_write',
      title: 'PostgreSQL Audit Sink',
      config: {
        target_table: 'audit_logs',
        description: 'Persists finalized customer decision and signed approval token into PostgreSQL audit database.',
      },
    },
  ],
};

export const INITIAL_RUN_HISTORY: ExecutionRunRecord[] = [
  {
    id: 'run_102',
    run_number: 102,
    trigger_type: 'manual',
    status: 'completed',
    started_at: '2 mins ago',
    finished_at: '1 min ago',
    duration: '3.2s',
    step_runs: {
      step_1_trigger: { step_id: 'step_1_trigger', status: 'completed', output: { triggered_by: 'user' }, duration_ms: 120 },
      step_2_llm: { step_id: 'step_2_llm', status: 'completed', output: { model: 'llama-3.3-70b-versatile', score: 85, recommendation: 'APPROVE' }, duration_ms: 1400 },
      step_3_http: { step_id: 'step_3_http', status: 'completed', output: { statusCode: 200, status: 'synced' }, duration_ms: 650 },
      step_4_conditional: { step_id: 'step_4_conditional', status: 'completed', output: { evaluation: 'TRUE', passed: true }, duration_ms: 40 },
      step_5_approval: { step_id: 'step_5_approval', status: 'completed', output: { approved: true, reviewer: 'admin' }, duration_ms: 900 },
      step_6_db_write: { step_id: 'step_6_db_write', status: 'completed', output: { table: 'audit_logs', record_id: 'rec_9821' }, duration_ms: 110 },
    },
  },
];

export const SAMPLE_RUNS = INITIAL_RUN_HISTORY;
