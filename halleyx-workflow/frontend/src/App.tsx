import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { GitBranch, ClipboardList, Zap, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { Spinner } from './components/ui';
import WorkflowList from './pages/WorkflowList';
import WorkflowEditor from './pages/WorkflowEditor';
import NewWorkflowPage from './pages/NewWorkflowPage';
import ExecutionView from './pages/ExecutionView';
import AuditLog from './pages/AuditLog';
import LoginPage from './pages/LoginPage';
import clsx from 'clsx';

const ROLE_STYLES: Record<string, string> = {
  EMPLOYEE:        'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50',
  FINANCE_MANAGER: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800/50',
  CEO:             'bg-blue-100   text-blue-700   border border-blue-200   dark:bg-blue-900/40   dark:text-blue-300   dark:border-blue-800/50',
};
const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee', FINANCE_MANAGER: 'Finance Manager', CEO: 'CEO',
};

// ─── Theme Toggle Button ──────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
        'bg-slate-100 hover:bg-slate-200 text-slate-600',
        'dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300'
      )}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function ProtectedLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const isCEO      = user.role === 'CEO';
  const isManager  = user.role === 'FINANCE_MANAGER';

  const navItems = [
    ...(!isCEO ? [{ to: '/', label: 'Workflows', icon: GitBranch }] : []),
    {
      to: '/audit',
      label: isCEO ? 'Pending Approvals' : isManager ? 'All Requests' : 'My Requests',
      icon: ClipboardList,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-gray-950 transition-colors duration-200">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className={clsx(
        'border-b sticky top-0 z-30 backdrop-blur',
        'bg-white/80 border-slate-200',
        'dark:bg-gray-950/80 dark:border-gray-800'
      )}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white tracking-tight">Halleyx</span>
          </div>

          {/* Nav */}
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
                      ? 'bg-slate-100 text-slate-900 dark:bg-gray-800 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/50'
                  )
                }
              >
                <Icon size={14} /> {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side — theme toggle + user menu */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="relative">
              <button
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors',
                  'hover:bg-slate-100 dark:hover:bg-gray-800'
                )}
                onClick={() => setShowMenu(!showMenu)}
              >
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-xs text-white font-medium">
                  {user.name[0].toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-medium text-slate-800 dark:text-gray-200 leading-tight">{user.name}</p>
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', ROLE_STYLES[user.role])}>
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
                <ChevronDown size={13} className="text-slate-400 dark:text-gray-500" />
              </button>

              {showMenu && (
                <div className={clsx(
                  'absolute right-0 top-12 w-52 rounded-xl border shadow-xl py-1 z-50',
                  'bg-white border-slate-200',
                  'dark:bg-gray-900 dark:border-gray-800'
                )}>
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-gray-800">
                    <p className="text-sm font-medium text-slate-800 dark:text-gray-200">{user.name}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500 mt-0.5">{user.email}</p>
                  </div>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => { logout(); navigate('/login'); setShowMenu(false); }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Routes>
          <Route path="/"                   element={isCEO ? <Navigate to="/audit" replace /> : <WorkflowList />} />
          <Route path="/workflows/new"      element={<NewWorkflowPage />} />
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950">
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
