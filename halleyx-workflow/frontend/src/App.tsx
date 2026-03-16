import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { GitBranch, List, ClipboardList, Zap } from 'lucide-react';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import ExecutionView from './pages/ExecutionView';
import AuditLog from './pages/AuditLog';
import clsx from 'clsx';

const navItems = [
  { to: '/',          label: 'Workflows',  icon: GitBranch },
  { to: '/audit',     label: 'Audit Log',  icon: ClipboardList },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">Halleyx</span>
            <span className="text-gray-600 text-xs ml-1">Workflow Engine</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  )
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Routes>
          <Route path="/"                        element={<WorkflowList />} />
          <Route path="/workflows/new"           element={<WorkflowEditor />} />
          <Route path="/workflows/:id/edit"      element={<WorkflowEditor />} />
          <Route path="/executions/:id"          element={<ExecutionView />} />
          <Route path="/audit"                   element={<AuditLog />} />
        </Routes>
      </main>
    </div>
  );
}
