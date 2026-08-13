import React from 'react';
import { ActiveTab, StepStatus } from '../types';
import {
  Layers,
  Play,
  RotateCcw,
  Building2,
  Menu,
  Sliders,
  Webhook,
  Activity,
  History,
  MoreVertical,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface WorkflowHeaderProps {
  workflowTitle: string;
  workflowOrg: string;
  activeOrg: string;
  activeUserId: string;
  onChangeOrgAndUser: (org: string, userId: string) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  runStatus: StepStatus | 'idle';
  isRunning: boolean;
  onRun: () => void;
  onReset: () => void;
  onWebhookTrigger: () => void;
  onOpenMobileMenu: () => void;
  onToggleNodeLibrary: () => void;
  onToggleConfigPanel: () => void;
  isNodeLibraryOpen: boolean;
  isConfigPanelOpen: boolean;
}

export const WorkflowHeader: React.FC<WorkflowHeaderProps> = ({
  workflowTitle,
  workflowOrg,
  activeOrg,
  activeUserId,
  onChangeOrgAndUser,
  activeTab,
  onSelectTab,
  runStatus,
  isRunning,
  onRun,
  onReset,
  onWebhookTrigger,
  onOpenMobileMenu,
  onToggleNodeLibrary,
  onToggleConfigPanel,
  isNodeLibraryOpen,
  isConfigPanelOpen,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <header className="h-16 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between bg-slate-900/90 backdrop-blur-md shrink-0 z-30">
      {/* Left section: Logo / Mobile Hamburger & Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu button */}
        <button
          id="mobile-nav-toggle-btn"
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 md:hidden shrink-0 transition"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="hidden sm:flex p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20 shrink-0">
          <Layers className="w-4 h-4" />
        </div>

        {/* Workflow Title & Status */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {workflowTitle}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
            </span>
          </div>
          <p className="hidden md:block text-[11px] text-slate-400 truncate">
            Org: <span className="font-mono text-indigo-400">{workflowOrg}</span>
          </p>
        </div>
      </div>

      {/* Center section: Desktop Navigation Tabs */}
      <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => onSelectTab('canvas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activeTab === 'canvas'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Canvas
        </button>
        <button
          onClick={() => onSelectTab('runs')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === 'runs'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Runs
        </button>
        <button
          onClick={() => onSelectTab('usage')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
            activeTab === 'usage'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Usage
        </button>
      </div>

      {/* Right section: Action Buttons & Drawers Toggles */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Toggle Library Button (for Tablet/Mobile) */}
        <button
          id="toggle-node-library-btn"
          onClick={onToggleNodeLibrary}
          className={`p-2 rounded-xl border text-xs font-medium transition lg:hidden ${
            isNodeLibraryOpen
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Toggle Node Library"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Toggle Config Button (for Laptop/Tablet/Mobile) */}
        <button
          id="toggle-config-panel-btn"
          onClick={onToggleConfigPanel}
          className={`p-2 rounded-xl border text-xs font-medium transition xl:hidden ${
            isConfigPanelOpen
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Toggle Node Configuration"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Organization & Role Identity Selector (Desktop) */}
        <div className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <Building2 className="w-3.5 h-3.5 text-indigo-400 ml-1.5" />
          <select
            id="desktop-org-selector"
            value={`${activeOrg}:${activeUserId}`}
            onChange={(e) => {
              const [org, user] = e.target.value.split(':');
              onChangeOrgAndUser(org, user);
            }}
            className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none pr-2 cursor-pointer"
          >
            <option value="org_acme_corp:usr_owner_acme">Acme Corp · Owner (Full Access)</option>
            <option value="org_acme_corp:usr_editor_acme">Acme Corp · Editor (Run & Approve)</option>
            <option value="org_acme_corp:usr_viewer_acme">Acme Corp · Viewer (Read Only)</option>
            <option value="org_competitor_corp:usr_owner_comp">Competitor Inc · Unauth Tenant</option>
          </select>
        </div>

        {/* Webhook Button */}
        <button
          id="webhook-trigger-header-btn"
          onClick={onWebhookTrigger}
          disabled={isRunning}
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-medium text-slate-300 border border-slate-700 transition cursor-pointer"
          title="Trigger via external POST webhook without clicking Run"
        >
          <Webhook className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden md:inline">Webhook</span>
        </button>

        {/* Reset Button */}
        {runStatus !== 'idle' && (
          <button
            id="reset-run-btn"
            onClick={onReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="Reset Workflow State"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}

        {/* Primary Run Button */}
        <button
          id="run-workflow-btn"
          onClick={onRun}
          disabled={isRunning || runStatus === 'running'}
          className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 cursor-pointer shrink-0"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>
      </div>
    </header>
  );
};
