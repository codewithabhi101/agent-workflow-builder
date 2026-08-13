export type StepType = 'trigger' | 'llm' | 'http' | 'conditional' | 'approval_gate' | 'db_write' | 'notify';

export type StepStatus = 'pending' | 'running' | 'completed' | 'paused' | 'failed' | 'idle';

export interface WorkflowStep {
  id: string;
  step_order: number;
  step_type: StepType;
  title: string;
  config: {
    model?: string;
    prompt?: string;
    system_prompt?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    field?: string;
    operator?: '==' | '!=' | '>' | '<' | '>=' | '<=';
    value?: any;
    target_table?: string;
    channel?: string;
    message?: string;
    description?: string;
  };
}

export interface StepRun {
  step_id: string;
  status: StepStatus;
  output: any;
  error?: string;
  updated_at?: string;
  duration_ms?: number;
}

export interface ExecutionRunRecord {
  id: string;
  run_number: number;
  trigger_type: 'manual' | 'webhook' | 'scheduled';
  status: StepStatus;
  started_at: string;
  finished_at?: string;
  duration: string;
  step_runs: Record<string, StepRun>;
}

export interface Workflow {
  id: string;
  title: string;
  description: string;
  org_id: string;
  is_active: boolean;
  steps: WorkflowStep[];
  monthly_usage: {
    used: number;
    quota: number;
  };
}

export interface OrgUser {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  org_id: string;
}

export type ActiveTab = 'canvas' | 'runs' | 'usage' | 'settings';
