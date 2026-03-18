import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

const DEMO_ACCOUNTS = [
  { label: 'Employee',        email: 'employee@halleyx.com', role: 'EMPLOYEE',         color: 'text-purple-400' },
  { label: 'Finance Manager', email: 'manager@halleyx.com',  role: 'FINANCE_MANAGER',  color: 'text-orange-400' },
  { label: 'CEO',             email: 'ceo@halleyx.com',      role: 'CEO',              color: 'text-blue-400'   },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-950 transition-colors duration-200 px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-white text-lg leading-tight">Halleyx</p>
            <p className="text-xs text-gray-500">Workflow Engine</p>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleTheme}
            className={clsx(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
              'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50',
              'dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">Enter your credentials to continue</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-800/50 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? <Spinner className="w-4 h-4" /> : 'Sign in'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-3">Demo accounts (password: password123)</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 transition-colors text-sm"
                  onClick={() => fillDemo(acc.email)}
                >
                  <span className="text-gray-300">{acc.email}</span>
                  <span className={`text-xs font-medium ${acc.color}`}>{acc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
