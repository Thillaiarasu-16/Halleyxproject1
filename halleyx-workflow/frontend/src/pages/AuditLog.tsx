import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RefreshCw, Clock } from 'lucide-react';
import { useExecutions } from '../api/hooks';
import { StatusBadge, EmptyState, Spinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { Execution } from '../types';

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: 'Employee', FINANCE_MANAGER: 'Finance Manager', CEO: 'CEO',
};

export default function AuditLog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: executions, isLoading } = useExecutions();

  const isEmployee = user?.role === 'EMPLOYEE';
  const isManager  = user?.role === 'FINANCE_MANAGER';
  const isCEO      = user?.role === 'CEO';

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  // CEO only sees requests that are pending (awaiting their approval)
  // They don't need to see completed/failed ones from other users
  const filtered = (executions ?? []).filter((e: Execution) => {
    if (isCEO) {
      // CEO sees PENDING requests (which include ones at CEO Approval step)
      if (filter === 'all') return e.status === 'PENDING' || e.status === 'COMPLETED' || e.status === 'FAILED';
      return e.status.toUpperCase() === filter.toUpperCase();
    }
    if (filter === 'all') return true;
    return e.status.toUpperCase() === filter.toUpperCase();
  });

  const pendingCount = (executions ?? []).filter((e: Execution) => e.status === 'PENDING').length;

  const pageTitle = isCEO
    ? 'Pending Approvals'
    : isManager
      ? 'All Requests'
      : 'My Requests';

  const pageDesc = isCEO
    ? 'Requests escalated and awaiting your final decision'
    : isManager
      ? 'All workflow requests submitted by employees'
      : 'Your submitted workflow requests and their status';

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDesc}
        action={
          pendingCount > 0 ? (
            <span className="badge bg-orange-900/40 text-orange-300 border border-orange-800/50 text-xs px-3 py-1.5">
              <Clock size={12} className="inline mr-1" />
              {pendingCount} pending
            </span>
          ) : undefined
        }
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'pending', 'completed', 'failed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !filtered.length ? (
        <EmptyState
          title={filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
          description={
            isCEO
              ? 'No requests have been escalated to you yet'
              : isEmployee
                ? 'You have not submitted any requests yet'
                : 'No workflow requests found'
          }
        />
      ) : (
        <div className="card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {[
                  'Request ID',
                  'Workflow',
                  'Req. Ver.',
                  ...(isManager || isCEO ? ['Submitted By'] : []),
                  'Status',
                  'Start Time',
                  'End Time',
                  'Actions'
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800/50">
              {filtered.map((exec: Execution) => (
                <tr key={exec.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {exec.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-200">{exec.workflow?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-800 text-gray-300 border border-gray-700">
                      r{exec.request_version ?? 1}
                    </span>
                  </td>
                  {(isManager || isCEO) && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-slate-800 dark:text-gray-200 text-xs font-medium">{exec.user?.name ?? '—'}</p>
                        <p className="text-slate-500 dark:text-gray-500 text-xs">{ROLE_LABELS[exec.user?.role ?? ''] ?? ''}</p>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3"><StatusBadge status={exec.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(exec.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {exec.ended_at ? new Date(exec.ended_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        className="btn-secondary py-1 px-2.5 text-xs"
                        onClick={() => navigate(`/executions/${exec.id}`)}
                      >
                        <Eye size={12} />
                        {exec.status === 'PENDING' && (isManager || isCEO) ? ' Review' : ' View'}
                      </button>
                      {/* Employee can resubmit their own rejected requests */}
                      {exec.status === 'FAILED' && exec.triggered_by_id === user?.id && (
                        <button
                          className="btn py-1 px-2.5 text-xs bg-brand-900/40 hover:bg-brand-800/60 text-brand-300 border border-brand-800/50"
                          onClick={() => navigate(`/executions/${exec.id}?resubmit=1`)}
                        >
                          <RefreshCw size={12} /> Resubmit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
