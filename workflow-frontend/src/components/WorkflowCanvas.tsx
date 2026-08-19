import React from 'react';
import { WorkflowStep, StepRun } from '../types';
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldAlert, 
  ArrowDown, 
  Sparkles, 
  Globe, 
  GitFork, 
  UserCheck, 
  Database, 
  Layers,
  ShieldCheck,
} from 'lucide-react';

interface WorkflowCanvasProps {
  steps: WorkflowStep[];
  stepRuns: Record<string, StepRun>;
  selectedStepId: string | null;
  onSelectStep: (step: WorkflowStep) => void;
  onApproveStep: (stepId: string) => void;
}

export function WorkflowCanvas({
  steps,
  stepRuns,
  selectedStepId,
  onSelectStep,
  onApproveStep,
}: WorkflowCanvasProps) {
  const getStepIcon = (type: string) => {
    switch (type) {
      case 'trigger':
        return <Play className="w-5 h-5 text-indigo-400" />;
      case 'llm':
        return <Sparkles className="w-5 h-5 text-purple-400" />;
      case 'http':
        return <Globe className="w-5 h-5 text-blue-400" />;
      case 'conditional':
        return <GitFork className="w-5 h-5 text-amber-400" />;
      case 'approval_gate':
        return <UserCheck className="w-5 h-5 text-emerald-400" />;
      case 'db_write':
        return <Database className="w-5 h-5 text-cyan-400" />;
      default:
        return <Layers className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            Running
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-950/90 text-purple-200 border border-purple-500/50 shadow-sm shadow-purple-500/20">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-300" />
            Paused (Review Required)
          </span>
        );
      case 'awaiting_second_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/90 text-amber-200 border border-amber-500/50 shadow-sm shadow-amber-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
            Awaiting 2nd Approval
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-500/40">
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Skipped
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">
            Ready
          </span>
        );
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start relative custom-scrollbar">
      <div className="w-full max-w-2xl flex flex-col items-center space-y-4 my-auto py-8">
        {steps.map((step, idx) => {
          const isSelected = selectedStepId === step.id;
          const stepRun = stepRuns[step.id];
          const status = stepRun?.status;
          const isApprovalGate = step.step_type === 'approval_gate';
          const isPaused = status === 'paused';
          const isAwaitingSecondApproval = status === 'awaiting_second_approval';
          const needsAction = isPaused || isAwaitingSecondApproval;

          return (
            <React.Fragment key={step.id}>
              <div
                onClick={() => onSelectStep(step)}
                className={`w-full bg-slate-900/90 hover:bg-slate-900 border transition-all duration-200 rounded-2xl p-5 shadow-xl cursor-pointer relative backdrop-blur-md group ${
                  isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-indigo-500/10'
                    : needsAction
                    ? isAwaitingSecondApproval
                      ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                      : 'border-purple-500/80 ring-2 ring-purple-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700/70 shadow-inner group-hover:scale-105 transition-transform">
                      {getStepIcon(step.step_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                          Step 0{step.step_order}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono uppercase">
                          {step.step_type}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-0.5">{step.title}</h3>
                    </div>
                  </div>
                  <div>{getStatusBadge(status)}</div>
                </div>

                {step.config?.description && (
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    {step.config.description}
                  </p>
                )}

                {/* Human-in-the-loop Approval Action Card */}
                {isApprovalGate && needsAction && (
                  <div
                    className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200 ${
                      isAwaitingSecondApproval
                        ? 'bg-amber-950/40 border-amber-600/40'
                        : 'bg-purple-950/40 border-purple-600/40'
                    }`}
                  >
                    <div>
                      <p
                        className={`text-xs font-semibold flex items-center gap-1.5 ${
                          isAwaitingSecondApproval ? 'text-amber-200' : 'text-purple-200'
                        }`}
                      >
                        {isAwaitingSecondApproval ? (
                          <ShieldCheck className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-purple-400" />
                        )}
                        {isAwaitingSecondApproval
                          ? 'First Approval Recorded — Second Sign-off Required'
                          : 'Human Review Gate Triggered'}
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          isAwaitingSecondApproval ? 'text-amber-300/80' : 'text-purple-300/80'
                        }`}
                      >
                        {isAwaitingSecondApproval
                          ? 'A different owner/editor must confirm before this run resumes.'
                          : 'Owner or Admin credentials required to authorize downstream write.'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onApproveStep(step.id);
                      }}
                      className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white text-xs font-bold shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer whitespace-nowrap ${
                        isAwaitingSecondApproval
                          ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60'
                          : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/60'
                      }`}
                    >
                      {isAwaitingSecondApproval ? 'Confirm 2nd Approval' : 'Approve & Resume'}
                    </button>
                  </div>
                )}
              </div>

              {/* Connecting Connector Arrow */}
              {idx < steps.length - 1 && (
                <div className="flex flex-col items-center my-0 text-slate-600">
                  <div className="w-0.5 h-4 bg-slate-800" />
                  <div className="p-1 rounded-full bg-slate-900 border border-slate-800">
                    <ArrowDown className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="w-0.5 h-4 bg-slate-800" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}