import React from 'react';
import { ExecutionRunRecord, Workflow } from '../types';
import {
  History,
  CheckCircle2,
  PauseCircle,
  AlertCircle,
  Zap,
  Webhook,
  Activity,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface RunsUsageViewProps {
  workflow: Workflow;
  runs: ExecutionRunRecord[];
  activeTab: 'runs' | 'usage';
  onSelectRun?: (run: ExecutionRunRecord) => void;
  onResetQuota?: (quotaUsed: number) => void;
}

export const RunsUsageView: React.FC<RunsUsageViewProps> = ({
  workflow,
  runs,
  activeTab,
  onResetQuota,
}) => {
  const quota = workflow.monthly_usage.quota;
  const used = workflow.monthly_usage.used;
  const percentage = Math.min(100, Math.round((used / quota) * 100));
  const remaining = Math.max(0, quota - used);

  if (activeTab === 'usage') {
    return (
      <div className="flex-1 bg-slate-950 p-6 sm:p-10 overflow-y-auto max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" /> Organization Quota & Usage
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time execution usage metrics calculated across all active serverless functions for {workflow.org_id}.
          </p>
        </div>

        {/* Usage Metric Card */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Monthly Executions
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {used} <span className="text-sm font-normal text-slate-400">/ {quota} executions</span>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold font-mono">
                {percentage}% Consumed
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentage > 90
                  ? 'bg-rose-500'
                  : percentage > 75
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 mt-3">
            <span>{remaining} executions remaining in billing cycle</span>
            <span className="font-mono text-slate-500">Resets in 17 days</span>
          </div>

          {onResetQuota && (
            <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3">
              <span className="text-[11px] text-slate-400 font-medium">Quota Testing Controls:</span>
              <button
                onClick={() => onResetQuota(100)}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition cursor-pointer"
              >
                Set Quota Full (100/100)
              </button>
              <button
                onClick={() => onResetQuota(80)}
                className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-medium transition cursor-pointer"
              >
                Reset Normal (80/100)
              </button>
            </div>
          )}
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-[11px] text-slate-400 font-medium">Groq LLM Tokens</span>
            <div className="text-lg font-bold text-slate-100 mt-1">42,850</div>
            <span className="text-[10px] text-emerald-400">llama-3.3-70b-versatile</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-[11px] text-slate-400 font-medium">HTTP Webhooks Sent</span>
            <div className="text-lg font-bold text-slate-100 mt-1">102</div>
            <span className="text-[10px] text-indigo-400">100% Delivery rate</span>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-[11px] text-slate-400 font-medium">Approval Gates Passed</span>
            <div className="text-lg font-bold text-slate-100 mt-1">79</div>
            <span className="text-[10px] text-amber-400">Avg 4.2m pause time</span>
          </div>
        </div>
      </div>
    );
  }

  // RUNS HISTORY
  return (
    <div className="flex-1 bg-slate-950 p-4 sm:p-8 overflow-y-auto max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" /> Execution Run History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit logs for workflow executions under {workflow.org_id}.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          {runs.length} total runs
        </span>
      </div>

      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            id={`run-history-item-${run.run_number}`}
            className="p-4 rounded-2xl border border-slate-800/90 bg-slate-900/60 hover:bg-slate-900/90 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  run.status === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : run.status === 'paused'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
              >
                {run.status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                {run.status === 'paused' && <PauseCircle className="w-4 h-4" />}
                {run.status === 'failed' && <AlertCircle className="w-4 h-4" />}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white font-mono">
                    #{run.run_number}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {run.trigger_type === 'webhook' ? (
                      <>
                        <Webhook className="w-2.5 h-2.5 text-emerald-400" /> Webhook
                      </>
                    ) : (
                      <>
                        <Zap className="w-2.5 h-2.5 text-amber-400" /> Manual
                      </>
                    )}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                  <span>Started {run.started_at}</span>
                  <span>•</span>
                  <span>Duration {run.duration}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
              <span
                className={`text-xs font-semibold capitalize px-2.5 py-1 rounded-full border ${
                  run.status === 'completed'
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                    : run.status === 'paused'
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
                    : 'text-rose-400 bg-rose-950/60 border-rose-800/50'
                }`}
              >
                {run.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
