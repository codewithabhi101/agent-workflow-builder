import React from 'react';
import { Bot, Globe, GitFork, ShieldCheck, Database, Layers, Zap, Bell, X } from 'lucide-react';
import { StepType } from '../types';

interface NodeLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType?: (type: StepType) => void;
}

export const AVAILABLE_NODES: Array<{
  type: StepType;
  title: string;
  badge: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    type: 'trigger',
    title: 'Trigger',
    badge: 'Manual / Webhook',
    desc: 'Starts the workflow via user action or external webhook event',
    icon: Zap,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  },
  {
    type: 'llm',
    title: 'LLM Call',
    badge: 'llama-3.3-70b-versatile',
    desc: 'Real AI generation with prompt variable templating & JSON outputs',
    icon: Bot,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
  },
  {
    type: 'http',
    title: 'HTTP Request',
    badge: 'GET / POST REST',
    desc: 'External webhook and REST API service payload invocation',
    icon: Globe,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    type: 'conditional',
    title: 'Condition (IF)',
    badge: '==, !=, >, <, >=, <=',
    desc: 'Branch logic evaluating numeric or string values from previous outputs',
    icon: GitFork,
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  },
  {
    type: 'approval_gate',
    title: 'Approval Gate',
    badge: 'Human in Loop',
    desc: 'Suspends run until an authorized org reviewer approves',
    icon: ShieldCheck,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  },
  {
    type: 'db_write',
    title: 'DB Write',
    badge: 'PostgreSQL Sink',
    desc: 'Persists structured results into audit log database tables',
    icon: Database,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    type: 'notify',
    title: 'Notification',
    badge: 'Alerts',
    desc: 'Dispatches status notifications or logs to designated channels',
    icon: Bell,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  },
];

export const NodeLibrary: React.FC<NodeLibraryProps> = ({ isOpen, onClose, onSelectType }) => {
  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Responsive Container (Desktop Static Column / Mobile Drawer) */}
      <aside
        id="node-library-drawer"
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-72 max-w-[85vw] bg-slate-900/95 lg:bg-slate-900/60 backdrop-blur-md lg:backdrop-blur-none border-r border-slate-800 flex flex-col shrink-0 transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Node Library
            </span>
          </div>
          <button
            id="close-node-library-btn"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition lg:hidden"
            aria-label="Close Node Library"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2 overflow-y-auto flex-1 custom-scrollbar">
          <p className="text-[11px] text-slate-400 px-1 mb-1">
            Drag or tap building blocks:
          </p>

          {AVAILABLE_NODES.map((node) => {
            const Icon = node.icon;
            return (
              <div
                key={node.type}
                id={`node-lib-item-${node.type}`}
                onClick={() => {
                  if (onSelectType) onSelectType(node.type);
                }}
                className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-indigo-500/40 hover:bg-slate-950 transition cursor-pointer select-none group"
              >
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg border ${node.color} shrink-0 mt-0.5`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 transition truncate">
                        {node.title}
                      </h4>
                    </div>
                    <span className="inline-block mt-0.5 text-[9px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded truncate max-w-full">
                      {node.badge}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {node.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Isolation</span>
            <span className="font-mono text-indigo-400 font-medium text-[10px]">Org-Scoped RLS</span>
          </div>
        </div>
      </aside>
    </>
  );
};
