import React from 'react';
import { WorkflowStep, StepRun } from '../types';
import {
  Bot,
  Globe,
  GitFork,
  ShieldCheck,
  Database,
  CheckCircle2,
  Sliders,
  Terminal,
  Zap,
  Bell,
  X,
  Copy,
} from 'lucide-react';

interface ConfigPanelProps {
  selectedStep: WorkflowStep | null;
  stepRun: StepRun | undefined;
  isOpen: boolean;
  onClose: () => void;
  onInspectJson: (data: any) => void;
  
}

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  llm: Bot,
  http: Globe,
  conditional: GitFork,
  approval_gate: ShieldCheck,
  db_write: Database,
  notify: Bell,
};

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  selectedStep,
  stepRun,
  isOpen,
  onClose,
  onInspectJson,
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        id="node-config-drawer"
        className={`fixed xl:static top-0 bottom-0 right-0 z-40 w-80 sm:w-96 max-w-[90vw] bg-slate-900/95 xl:bg-slate-900/60 backdrop-blur-md xl:backdrop-blur-none border-l border-slate-800 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedStep ? (
              (() => {
                const Icon = STEP_ICONS[selectedStep.step_type] || Bot;
                return (
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })()
            ) : (
              <Sliders className="w-4 h-4 text-slate-400" />
            )}
            <div>
              <h3 className="text-xs font-semibold text-slate-200">
                {selectedStep ? 'Node Properties' : 'Configuration'}
              </h3>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                {selectedStep ? selectedStep.step_type : 'Inspector'}
              </span>
            </div>
          </div>

          <button
            id="close-config-drawer-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition xl:hidden"
            aria-label="Close Properties"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selectedStep ? (
          <div className="p-6 flex-1 flex flex-col items-center justify-center text-center">
            <Sliders className="w-8 h-8 text-slate-600 mb-3" />
            <h4 className="text-sm font-medium text-slate-300">No Node Selected</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Tap or click any node on the workflow canvas to inspect its configuration parameters, live output, or schema.
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                Step Title
              </label>
              <div className="mt-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 font-medium">
                {selectedStep.title}
              </div>
            </div>

            {/* LLM Properties */}
            {selectedStep.step_type === 'llm' && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                      Provider & Model
                    </label>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      Groq Cloud
                    </span>
                  </div>
                  <div className="mt-1 p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300">
                    {selectedStep.config.model || 'llama-3.3-70b-versatile'}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Prompt Template
                  </label>
                  <div className="mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                    {selectedStep.config.prompt}
                  </div>
                </div>
              </div>
            )}

            {/* HTTP Properties */}
            {selectedStep.step_type === 'http' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Method & Endpoint
                  </label>
                  <div className="mt-1 p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 flex items-center gap-2 truncate">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] shrink-0 font-bold">
                      {selectedStep.config.method || 'POST'}
                    </span>
                    <span className="truncate">{selectedStep.config.url}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                    Payload Structure
                  </label>
                  <pre className="mt-1 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(selectedStep.config.body || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Conditional Properties */}
            {selectedStep.step_type === 'conditional' && (
              <div className="space-y-3">
                <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                  Evaluated Condition Rule
                </label>
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-500/30 font-mono text-xs text-sky-300 flex items-center justify-center gap-2">
                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-200">
                    {selectedStep.config.field || 'score'}
                  </span>
                  <span className="font-bold text-sky-400">
                    {selectedStep.config.operator || '>'}
                  </span>
                  <span className="bg-slate-900 px-2 py-1 rounded border border-slate-800 text-slate-200">
                    {selectedStep.config.value || '70'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Evaluates structured JSON output from LLM step.
                </p>
              </div>
            )}

            {/* Approval Properties */}
            {selectedStep.step_type === 'approval_gate' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
                <p className="font-semibold mb-1">Human-in-the-Loop Barrier</p>
                Workflow will transition to <span className="font-mono text-amber-300">paused</span> status here. Authorized reviewer authentication is verified server-side.
              </div>
            )}

            {/* DB Write Properties */}
            {selectedStep.step_type === 'db_write' && (
              <div className="space-y-2">
                <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider">
                  PostgreSQL Target Table
                </label>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300">
                  {selectedStep.config.target_table || 'audit_logs'}
                </div>
              </div>
            )}

            {/* Step Run Output */}
            {stepRun && stepRun.output && (
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Output Payload
                  </span>
                  <button
                    id={`config-inspect-btn-${selectedStep.id}`}
                    onClick={() => onInspectJson(stepRun.output)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono hover:underline cursor-pointer"
                  >
                    <Terminal className="w-3 h-3" /> Inspect JSON
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-950 p-2.5 border border-slate-800/90 custom-scrollbar">
                  <pre className="text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap break-all">
                    {typeof stepRun.output === 'string'
                      ? stepRun.output
                      : JSON.stringify(stepRun.output, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
