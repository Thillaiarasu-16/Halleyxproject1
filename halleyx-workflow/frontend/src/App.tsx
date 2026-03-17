import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { GitBranch, ClipboardList, Zap, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Spinner } from './components/ui';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import ExecutionView from './pages/ExecutionView';
import AuditLog from './pages/AuditLog';
import LoginPage from './pages/LoginPage';
import clsx from 'clsx';

const ROLE_STYLES: Record<string, string> = {
  EMPLOYEE:        'bg-purple-900/40 text-purple-300 border border-purple-800/50',
  FINANCE_MANAGER: 'bg-orange-900/40 text-orange-300 border border-orange-800/50',
  CEO:             'bg-blue-900/40   text-blue-300   border border-blue-800/50',
};
const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee', FINANCE_MANAGER: 'Finance Manager', CEO: 'CEO',
};

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const navItems = [
    { to: '/',      label: 'Workflows', icon: GitBranch },
    { to: '/audit', label: 'Audit Log', icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">Halleyx</span>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                    isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50')
                }
              >
                <Icon size={14} /> {label}
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <div className="relative">
            <button
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={() => setShowMenu(!showMenu)}
            >
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs text-white font-medium">
                {user.name[0].toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-gray-200 leading-tight">{user.name}</p>
                <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', ROLE_STYLES[user.role])}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
              <ChevronDown size={13} className="text-gray-500" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-12 w-52 card shadow-xl py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm font-medium text-gray-200">{user.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                  onClick={() => { logout(); navigate('/login'); setShowMenu(false); }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Routes>
          <Route path="/"                   element={<WorkflowList />} />
          <Route path="/workflows/new"      element={<WorkflowEditor />} />
          <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
          <Route path="/executions/:id"     element={<ExecutionView />} />
          <Route path="/audit"              element={<AuditLog />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Spinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*"     element={<ProtectedLayout />} />
    </Routes>
  );
}
