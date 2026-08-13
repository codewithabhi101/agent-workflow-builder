import React from 'react';
import { WorkflowStep, StepRun } from '../types';
import { CheckCircle2, Clock, PauseCircle, AlertCircle, Bot, Globe, GitFork, ShieldCheck, Database, Zap } from 'lucide-react';

interface BottomExecutionStripProps {
  steps: WorkflowStep[];
  stepRuns: Record<string, StepRun>;
  onSelectStep: (step: WorkflowStep) => void;
}

export const BottomExecutionStrip: React.FC<BottomExecutionStripProps> = ({
  steps,
  stepRuns,
  onSelectStep,
}) => {
  return (
    <footer className="h-12 bg-slate-900/90 border-t border-slate-800 px-4 sm:px-6 flex items-center justify-between overflow-x-auto shrink-0 z-20 custom-scrollbar text-xs">
      <div className="flex items-center gap-2 text-slate-400 shrink-0 mr-4 font-semibold uppercase tracking-wider text-[10px]">
        <span>Execution:</span>
      </div>

      <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto py-1">
        {steps.map((step) => {
          const run = stepRuns[step.id];
          const status = run?.status || 'pending';

          return (
            <div
              key={step.id}
              onClick={() => onSelectStep(step)}
              className="flex items-center gap-1.5 shrink-0 cursor-pointer hover:opacity-80 transition select-none"
            >
              {status === 'completed' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
              {status === 'paused' && (
                <PauseCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              )}
              {status === 'running' && (
                <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
              )}
              {status === 'failed' && (
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              )}
              {(status === 'pending' || status === 'idle') && (
                <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />
              )}

              <span
                className={`text-[11px] font-mono font-medium ${
                  status === 'completed'
                    ? 'text-emerald-400'
                    : status === 'paused'
                    ? 'text-amber-400 font-bold'
                    : status === 'running'
                    ? 'text-indigo-400'
                    : 'text-slate-400'
                }`}
              >
                {step.step_type.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </footer>
  );
};
