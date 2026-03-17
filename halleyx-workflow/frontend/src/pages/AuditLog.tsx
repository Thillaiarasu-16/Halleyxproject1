import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, RefreshCw } from 'lucide-react';
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

  const isManager = user?.role === 'FINANCE_MANAGER' || user?.role === 'CEO';

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description={
          isManager
            ? 'All workflow execution requests across all users'
            : 'Your submitted workflow requests'
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !executions?.length ? (
        <EmptyState
          title="No requests yet"
          description={isManager ? 'No workflow executions found' : 'You have not submitted any requests yet'}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {[
                  'Request ID', 'Workflow', 'Ver.', 'Req. Ver.',
                  ...(isManager ? ['Submitted By'] : []),
                  'Status', 'Start Time', 'End Time', 'Actions'
                ].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {executions.map((exec: Execution) => (
                <tr key={exec.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {exec.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-200">{exec.workflow?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">v{exec.workflow_version}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-800 text-gray-300 border border-gray-700">
                      r{exec.request_version ?? 1}
                    </span>
                  </td>
                  {isManager && (
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-gray-200 text-xs">{exec.user?.name ?? exec.triggered_by ?? '—'}</p>
                        <p className="text-gray-500 text-xs">{ROLE_LABELS[exec.user?.role ?? ''] ?? ''}</p>
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
                        <Eye size={12} /> View
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
