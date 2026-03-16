import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useExecutions } from '../api/hooks';
import { StatusBadge, EmptyState, Spinner, PageHeader } from '../components/ui';

export default function AuditLog() {
  const navigate = useNavigate();
  const { data: executions, isLoading } = useExecutions();

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="History of all workflow executions"
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !executions?.length ? (
        <EmptyState title="No executions yet" description="Run a workflow to see execution history here" />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Execution ID', 'Workflow', 'Version', 'Status', 'Triggered By', 'Start Time', 'End Time', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {executions.map((exec) => (
                <tr key={exec.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {exec.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-gray-200">{exec.workflow?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">v{exec.workflow_version}</td>
                  <td className="px-4 py-3"><StatusBadge status={exec.status} /></td>
                  <td className="px-4 py-3 text-gray-400">{exec.triggered_by ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(exec.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {exec.ended_at ? new Date(exec.ended_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="btn-secondary py-1 px-2.5 text-xs"
                      onClick={() => navigate(`/executions/${exec.id}`)}
                    >
                      <Eye size={12} /> View Logs
                    </button>
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
