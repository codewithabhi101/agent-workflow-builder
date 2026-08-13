import React from 'react';
import { ActiveTab } from '../types';
import {
  Layers,
  Activity,
  History,
  Settings,
  Building2,
  X,
  Zap,
  Sliders,
} from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  activeOrg: string;
  activeUserId: string;
  onChangeOrgAndUser: (org: string, userId: string) => void;
  onOpenNodeLibrary: () => void;
  onOpenNodeConfig: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  activeOrg,
  activeUserId,
  onChangeOrgAndUser,
  onOpenNodeLibrary,
  onOpenNodeConfig,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Content */}
      <div className="relative w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-bold text-white tracking-tight">AI FLOW</span>
                <span className="text-[10px] block font-mono text-indigo-400">v2.4 Builder</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Panels (Mobile Actions) */}
          <div className="py-3 border-b border-slate-800/80 space-y-1.5">
            <button
              onClick={() => {
                onClose();
                onOpenNodeLibrary();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open Node Library</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenNodeConfig();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Open Node Config</span>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-4 space-y-1">
            <button
              onClick={() => {
                onSelectTab('canvas');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'canvas'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-4 h-4" />
              Workflow Canvas
            </button>

            <button
              onClick={() => {
                onSelectTab('runs');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'runs'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <History className="w-4 h-4" />
              Execution Runs
            </button>

            <button
              onClick={() => {
                onSelectTab('usage');
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'usage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              Usage & Quota
            </button>
          </nav>
        </div>

        {/* Footer: Organization Switcher */}
        <div className="pt-4 border-t border-slate-800">
          <label className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider block mb-1.5">
            Active Tenant & Role
          </label>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <select
              value={`${activeOrg}:${activeUserId}`}
              onChange={(e) => {
                const [org, user] = e.target.value.split(':');
                onChangeOrgAndUser(org, user);
              }}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none w-full cursor-pointer"
            >
              <option value="org_acme_corp:usr_owner_acme">Acme · Owner</option>
              <option value="org_acme_corp:usr_editor_acme">Acme · Editor</option>
              <option value="org_acme_corp:usr_viewer_acme">Acme · Viewer</option>
              <option value="org_competitor_corp:usr_owner_comp">Competitor Inc</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
