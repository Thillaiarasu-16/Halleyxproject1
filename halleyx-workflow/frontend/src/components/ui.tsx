import clsx from 'clsx';
import type { ExecutionStatus, StepType } from '../types';

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusStyles: Record<ExecutionStatus, string> = {
  PENDING:     'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800/50',
  IN_PROGRESS: 'bg-blue-100   text-blue-700   border border-blue-200   dark:bg-blue-900/40   dark:text-blue-300   dark:border-blue-800/50',
  COMPLETED:   'bg-green-100  text-green-700  border border-green-200  dark:bg-green-900/40  dark:text-green-300  dark:border-green-800/50',
  FAILED:      'bg-red-100    text-red-700    border border-red-200    dark:bg-red-900/40    dark:text-red-300    dark:border-red-800/50',
  CANCELED:    'bg-slate-100  text-slate-600  border border-slate-200  dark:bg-gray-800      dark:text-gray-400   dark:border-gray-700',
};

export function StatusBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span className={clsx('badge', statusStyles[status])}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ─── Step Type Badge ──────────────────────────────────────────────────────────
const stepTypeStyles: Record<StepType, string> = {
  TASK:         'bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800/50',
  APPROVAL:     'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800/50',
  NOTIFICATION: 'bg-cyan-100   text-cyan-700   border border-cyan-200   dark:bg-cyan-900/40   dark:text-cyan-300   dark:border-cyan-800/50',
};

export function StepTypeBadge({ type }: { type: StepType }) {
  return (
    <span className={clsx('badge', stepTypeStyles[type])}>
      {type}
    </span>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-slate-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-gray-300">{title}</p>
      {description && <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">{description}</p>}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('animate-spin', className ?? 'w-5 h-5 text-brand-500')}
      fill="none" viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Page Header ─────────────────────────────────────────────────────────────
export function PageHeader({
  title, description, action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h1>
        {description && <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
