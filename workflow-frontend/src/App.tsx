import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_WORKFLOW, INITIAL_RUN_HISTORY } from './data';
import { Workflow, WorkflowStep, StepRun, StepStatus, ActiveTab, ExecutionRunRecord } from './types';
import { NodeLibrary } from './components/NodeLibrary';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { ConfigPanel } from './components/ConfigPanel';
import { WorkflowHeader } from './components/WorkflowHeader';
import { RunsUsageView } from './components/RunsUsageView';
import { MobileDrawer } from './components/MobileDrawer';
import { BottomExecutionStrip } from './components/BottomExecutionStrip';
import { X, Lock, Terminal } from 'lucide-react';

export default function App() {
  const [workflow, setWorkflow] = useState<Workflow>(INITIAL_WORKFLOW);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(workflow.steps[1]);
  const [activeOrg, setActiveOrg] = useState<string>('org_acme_corp');
  const [activeUserId, setActiveUserId] = useState<string>('usr_owner_acme');
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [activeRunStatus, setActiveRunStatus] = useState<StepStatus | 'idle'>('idle');
  const [stepRuns, setStepRuns] = useState<Record<string, StepRun>>({});
  const [runsHistory, setRunsHistory] = useState<ExecutionRunRecord[]>(INITIAL_RUN_HISTORY);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Drawer visibility states for responsive mobile & tablet viewports
  const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modal payload inspection
  const [inspectModalData, setInspectModalData] = useState<any | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch workflow details and runs on mount or org switch
  const fetchWorkflowAndRuns = async () => {
    try {
      const resWf = await fetch('/api/workflow/wf_prod_customer_analyzer_v1');
      const ctWf = resWf.headers.get('content-type');
      if (resWf.ok && ctWf && ctWf.includes('application/json')) {
        const wfData = await resWf.json();
        if (wfData && wfData.steps) {
          setWorkflow(wfData);
        }
      }

      const resRuns = await fetch(`/api/runs?org_id=${activeOrg}`);
      const ctRuns = resRuns.headers.get('content-type');
      if (resRuns.ok && ctRuns && ctRuns.includes('application/json')) {
        const runsData = await resRuns.json();
        if (Array.isArray(runsData) && runsData.length > 0) {
          setRunsHistory(runsData);
        }
      }
    } catch {
      // Retain fallback initial data if network is loading
    }
  };

  useEffect(() => {
    fetchWorkflowAndRuns();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeOrg]);

  // Subscribe to live SSE updates for an active workflow run
  const subscribeToRunStream = (runId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`/api/workflow/stream/${runId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const runData = JSON.parse(event.data);
        setActiveRunStatus(runData.status);
        if (runData.step_runs) {
          setStepRuns(runData.step_runs);
        }

        if (runData.status === 'completed' || runData.status === 'failed') {
          setIsRunning(false);
          fetchWorkflowAndRuns();
        } else if (runData.status === 'paused') {
          setIsRunning(false);
        }
      } catch (err) {
        console.error('SSE JSON parse error:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  // Fallback simulation when backend API is offline
  const runClientSimulation = () => {
    const steps = workflow.steps || [];
    if (steps.length === 0) {
      setIsRunning(false);
      setActiveRunStatus('idle');
      return;
    }

    const initialMap: Record<string, StepRun> = {};
    steps.forEach((s) => {
      initialMap[s.id] = {
        step_id: s.id,
        status: 'pending',
        output: null,
      };
    });
    setStepRuns(initialMap);

    let currentIndex = 0;

    const executeNextStep = () => {
      if (currentIndex >= steps.length) {
        setIsRunning(false);
        setActiveRunStatus('completed');
        const newRun: ExecutionRunRecord = {
          id: `run_${Date.now()}`,
          run_number: (runsHistory.length > 0 ? runsHistory[0].run_number + 1 : 103),
          trigger_type: 'manual',
          status: 'completed',
          started_at: 'Just now',
          finished_at: 'Just now',
          duration: `${(steps.length * 0.7).toFixed(1)}s`,
          step_runs: { ...initialMap },
        };
        setRunsHistory((prev) => [newRun, ...prev]);
        return;
      }

      const currentStepObj = steps[currentIndex];

      setStepRuns((prev) => ({
        ...prev,
        [currentStepObj.id]: {
          step_id: currentStepObj.id,
          status: 'running',
          output: null,
          duration_ms: 150,
        },
      }));

      setTimeout(() => {
        if (currentStepObj.step_type === 'approval_gate') {
          setStepRuns((prev) => ({
            ...prev,
            [currentStepObj.id]: {
              step_id: currentStepObj.id,
              status: 'paused',
              output: {
                message: 'Execution paused at human review gate. Requires approval.',
                timestamp: new Date().toISOString(),
              },
              duration_ms: 300,
            },
          }));
          setIsRunning(false);
          setActiveRunStatus('paused');
          return;
        }

        let out: any = { message: `Completed ${currentStepObj.title}` };
        if (currentStepObj.step_type === 'trigger') {
          out = { triggered_by: activeUserId, org_id: activeOrg, payload: { customer_id: 'cust_ent_9981', score: 85 } };
        } else if (currentStepObj.step_type === 'llm') {
          out = { model: 'llama-3.3-70b-versatile', score: 85, risk_level: 'LOW', recommendation: 'APPROVE', reasoning: 'Enterprise compliance SLA verified.' };
        } else if (currentStepObj.step_type === 'http') {
          out = { statusCode: 200, status: 'synced_crm' };
        } else if (currentStepObj.step_type === 'conditional') {
          out = { evaluation: 'score > 70 => TRUE', passed: true };
        } else if (currentStepObj.step_type === 'db_write') {
          out = { table: 'audit_logs', record_id: 'rec_audit_9811', status: 'PERSISTED_OK' };
        }

        setStepRuns((prev) => ({
          ...prev,
          [currentStepObj.id]: {
            step_id: currentStepObj.id,
            status: 'completed',
            output: out,
            duration_ms: 450,
          },
        }));

        currentIndex++;
        executeNextStep();
      }, 700);
    };

    executeNextStep();
  };

  const resumeSimulationFromGate = (stepId: string) => {
    const steps = workflow.steps || [];
    const gateIndex = steps.findIndex((s) => s.id === stepId);

    setStepRuns((prev) => ({
      ...prev,
      [stepId]: {
        step_id: stepId,
        status: 'completed',
        output: { approved_by: activeUserId, approved_at: new Date().toISOString(), decision: 'APPROVED' },
        duration_ms: 120,
      },
    }));

    let currentIndex = gateIndex + 1;

    const executeRemaining = () => {
      if (currentIndex >= steps.length) {
        setIsRunning(false);
        setActiveRunStatus('completed');
        return;
      }

      const currentStepObj = steps[currentIndex];
      setStepRuns((prev) => ({
        ...prev,
        [currentStepObj.id]: {
          step_id: currentStepObj.id,
          status: 'running',
          output: null,
          duration_ms: 150,
        },
      }));

      setTimeout(() => {
        setStepRuns((prev) => ({
          ...prev,
          [currentStepObj.id]: {
            step_id: currentStepObj.id,
            status: 'completed',
            output: { table: 'audit_logs', status: 'PERSISTED_OK' },
            duration_ms: 300,
          },
        }));
        currentIndex++;
        executeRemaining();
      }, 600);
    };

    executeRemaining();
  };

  // Trigger Live Workflow Run (Groq LLM -> HTTP -> Conditional -> Approval Gate Pause -> DB Write)
  const handleRunWorkflow = async () => {
    if (activeUserId.includes('viewer')) {
      setAccessDeniedMessage('Access Denied: Viewers do not have permission to execute workflows.');
      return;
    }
    if (activeOrg !== workflow.org_id) {
      setAccessDeniedMessage(`Tenant Access Denied: User in ${activeOrg} cannot execute workflows owned by ${workflow.org_id}.`);
      return;
    }

    setAccessDeniedMessage(null);
    setIsRunning(true);
    setActiveRunStatus('running');

    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId: workflow.id,
          orgId: activeOrg,
          userId: activeUserId,
          payload: {
            customer_id: 'cust_ent_9981',
            request_type: 'cloud_migration',
            sla_tier: 'ENTERPRISE_HIGH',
            score: 85,
          },
        }),
      });

      const ct = res.headers.get('content-type');
      if (res.ok && ct && ct.includes('application/json')) {
        const data = await res.json();
        setActiveRunId(data.id);
        if (data.step_runs) {
          setStepRuns(data.step_runs);
        }
        subscribeToRunStream(data.id);
      } else {
        runClientSimulation();
      }
    } catch {
      runClientSimulation();
    }
  };

  // Webhook Trigger Endpoint
  const handleWebhookTrigger = async () => {
    setAccessDeniedMessage(null);
    setIsRunning(true);
    setActiveRunStatus('running');

    try {
      const res = await fetch('/api/webhookTrigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          score: 88,
          external_source: 'automated_crm_webhook',
        }),
      });

      const ct = res.headers.get('content-type');
      if (res.ok && ct && ct.includes('application/json')) {
        const data = await res.json();
        if (data.run_id) {
          setActiveRunId(data.run_id);
          subscribeToRunStream(data.run_id);
        }
      } else {
        runClientSimulation();
      }
    } catch {
      runClientSimulation();
    }
  };

  // Resume from Approval Gate
  const handleApproveStep = async (stepId: string) => {
    if (activeUserId.includes('viewer')) {
      setAccessDeniedMessage('Access Denied: Viewers cannot approve workflow human gates.');
      return;
    }

    setAccessDeniedMessage(null);
    setIsRunning(true);
    setActiveRunStatus('running');

    try {
      const res = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          runId: activeRunId || (runsHistory[0]?.id ?? 'run_102'),
          userId: activeUserId,
          orgId: activeOrg,
        }),
      });

      const ct = res.headers.get('content-type');
      if (res.ok && ct && ct.includes('application/json')) {
        const data = await res.json();
        if (data.id) {
          subscribeToRunStream(data.id);
        }
      } else {
        resumeSimulationFromGate(stepId);
      }
    } catch {
      resumeSimulationFromGate(stepId);
    }
  };

  const handleReset = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setActiveRunStatus('idle');
    setStepRuns({});
    setAccessDeniedMessage(null);
    setIsRunning(false);
  };

  const handleResetQuota = async (newQuotaUsed: number) => {
    try {
      const res = await fetch('/api/workflow/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrg, quotaUsed: newQuotaUsed }),
      });
      if (res.ok) {
        fetchWorkflowAndRuns();
      }
    } catch (err) {
      console.error('Failed to reset quota:', err);
    }
  };

  const handleChangeOrgAndUser = (org: string, user: string) => {
    setActiveOrg(org);
    setActiveUserId(user);
    setAccessDeniedMessage(null);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* 1. TOP RESPONSIVE HEADER */}
      <WorkflowHeader
        workflowTitle={workflow.title}
        workflowOrg={workflow.org_id}
        activeOrg={activeOrg}
        activeUserId={activeUserId}
        onChangeOrgAndUser={handleChangeOrgAndUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        runStatus={activeRunStatus}
        isRunning={isRunning}
        onRun={handleRunWorkflow}
        onReset={handleReset}
        onWebhookTrigger={handleWebhookTrigger}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onToggleNodeLibrary={() => setIsNodeLibraryOpen(!isNodeLibraryOpen)}
        onToggleConfigPanel={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
        isNodeLibraryOpen={isNodeLibraryOpen}
        isConfigPanelOpen={isConfigPanelOpen}
      />

      {/* 2. SECURITY TENANT / ROLE / QUOTA ALERT */}
      {accessDeniedMessage && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs text-rose-200 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-medium">{accessDeniedMessage}</span>
          </div>
          <button
            onClick={() => setAccessDeniedMessage(null)}
            className="text-rose-400 hover:text-rose-200 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. MAIN WORKFLOW BODY (Tab Routed) */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeTab === 'canvas' ? (
          <>
            {/* Left Column / Mobile Drawer: Node Library */}
            <NodeLibrary
              isOpen={isNodeLibraryOpen}
              onClose={() => setIsNodeLibraryOpen(false)}
            />

            {/* Center Canvas */}
            <WorkflowCanvas
              steps={workflow.steps}
              stepRuns={stepRuns}
              selectedStepId={selectedStep?.id || null}
              onSelectStep={(step) => {
                setSelectedStep(step);
                if (window.innerWidth < 1280) {
                  setIsConfigPanelOpen(true);
                }
              }}
              onApproveStep={handleApproveStep}
            />

            {/* Right Column / Mobile Drawer: Config Panel */}
            <ConfigPanel
              selectedStep={selectedStep}
              stepRun={selectedStep ? stepRuns[selectedStep.id] : undefined}
              isOpen={isConfigPanelOpen}
              onClose={() => setIsConfigPanelOpen(false)}
              onInspectJson={(data) => setInspectModalData(data)}
            />
          </>
        ) : (
          <RunsUsageView
            workflow={workflow}
            runs={runsHistory}
            activeTab={activeTab}
            onResetQuota={handleResetQuota}
          />
        )}
      </div>

      {/* 4. BOTTOM EXECUTION STATUS STRIP */}
      {activeTab === 'canvas' && (
        <BottomExecutionStrip
          steps={workflow.steps}
          stepRuns={stepRuns}
          onSelectStep={(step) => {
            setSelectedStep(step);
            if (window.innerWidth < 1280) {
              setIsConfigPanelOpen(true);
            }
          }}
        />
      )}

      {/* 5. MOBILE NAVIGATION DRAWER */}
      <MobileDrawer
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeOrg={activeOrg}
        activeUserId={activeUserId}
        onChangeOrgAndUser={handleChangeOrgAndUser}
        onOpenNodeLibrary={() => setIsNodeLibraryOpen(true)}
        onOpenNodeConfig={() => setIsConfigPanelOpen(true)}
      />

      {/* 6. INSPECT PAYLOAD MODAL */}
      {inspectModalData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Full JSON Output Payload</h3>
              </div>
              <button
                onClick={() => setInspectModalData(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-emerald-300 max-h-96 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all custom-scrollbar">
              {JSON.stringify(inspectModalData, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
