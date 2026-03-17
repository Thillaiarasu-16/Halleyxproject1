import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Play, Pencil, Trash2, GitBranch, Send } from 'lucide-react';
import { useWorkflows, useDeleteWorkflow, useStartExecution } from '../api/hooks';
import { PageHeader, EmptyState, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { Workflow } from '../types';

export default function WorkflowList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const { data, isLoading } = useWorkflows(search || undefined, page);
  const deleteWorkflow = useDeleteWorkflow();

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"? This cannot be undone.`)) return;
    await deleteWorkflow.mutateAsync(id);
  };

  return (
    <div>
      <PageHeader
        title="Workflows"
        description={isEmployee ? 'Submit requests through available workflows' : 'Create and manage automation workflows'}
        action={
          !isEmployee ? (
            <button className="btn-primary" onClick={() => navigate('/workflows/new')}>
              <Plus size={15} /> New Workflow
            </button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input pl-9"
          placeholder="Search workflows..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !data?.data.length ? (
        <EmptyState title="No workflows yet" description="No workflows available" />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Name', 'Steps', 'Version', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.data.map((wf: Workflow) => (
                  <WorkflowRow
                    key={wf.id}
                    workflow={wf}
                    isEmployee={isEmployee}
                    onEdit={() => navigate(`/workflows/${wf.id}/edit`)}
                    onDelete={() => handleDelete(wf.id, wf.name)}
                    onExecute={() => setExecutingId(wf.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.total > data.limit && (
            <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
              <span>Showing {(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
              <div className="flex gap-2">
                <button className="btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                <button className="btn-secondary" disabled={page * data.limit >= data.total} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Execute / Send Request Modal */}
      {executingId && data?.data && (
        <ExecuteModal
          workflow={data.data.find(w => w.id === executingId)!}
          isEmployee={isEmployee}
          onClose={() => setExecutingId(null)}
          onStarted={(execId) => {
            setExecutingId(null);
            navigate(`/executions/${execId}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Workflow Row ─────────────────────────────────────────────────────────────
function WorkflowRow({
  workflow, isEmployee, onEdit, onDelete, onExecute
}: {
  workflow: Workflow;
  isEmployee: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExecute: () => void;
}) {
  return (
    <tr className="hover:bg-gray-800/30 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-900/50 border border-brand-800/50 flex items-center justify-center flex-shrink-0">
            <GitBranch size={13} className="text-brand-400" />
          </div>
          <div>
            <p className="font-medium text-gray-100">{workflow.name}</p>
            {workflow.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{workflow.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 text-gray-400">{workflow._count?.steps ?? 0}</td>
      <td className="px-5 py-3.5 text-gray-400">v{workflow.version}</td>
      <td className="px-5 py-3.5">
        <span className={`badge ${workflow.is_active
          ? 'bg-green-900/40 text-green-300 border border-green-800/50'
          : 'bg-gray-800 text-gray-400'}`}>
          {workflow.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button onClick={onExecute} className="btn-primary py-1 px-2.5 text-xs">
            {isEmployee
              ? <><Send size={12} /> Send Request</>
              : <><Play size={12} /> Execute</>}
          </button>
          {!isEmployee && (
            <>
              <button onClick={onEdit} className="btn-secondary py-1 px-2.5 text-xs">
                <Pencil size={12} /> Edit
              </button>
              <button onClick={onDelete} className="btn-danger py-1 px-2.5 text-xs">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Execute / Send Request Modal ─────────────────────────────────────────────
function ExecuteModal({
  workflow, isEmployee, onClose, onStarted
}: {
  workflow: Workflow;
  isEmployee: boolean;
  onClose: () => void;
  onStarted: (execId: string) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const startExecution = useStartExecution(workflow.id);
  const schema = workflow.input_schema ?? {};

  const handleSubmit = async () => {
    const data: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema)) {
      const raw = inputs[key] ?? '';
      data[key] = field.type === 'number' ? Number(raw) : raw;
    }
    const exec = await startExecution.mutateAsync({ data });
    if (isEmployee) {
      setSubmitted(true);
      setTimeout(() => onStarted(exec.id), 1800);
    } else {
      onStarted(exec.id);
    }
  };

  // ── Success screen shown to employees after submission ────────────────────
  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-800/50 flex items-center justify-center mx-auto mb-4">
            <Send size={22} className="text-green-400" />
          </div>
          <h2 className="text-base font-semibold text-white mb-2">Request Sent!</h2>
          <p className="text-sm text-gray-400">
            Your request has been submitted and is awaiting approval from the Finance Manager.
          </p>
          <p className="text-xs text-gray-600 mt-3">Redirecting to request details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-white mb-1">
          {isEmployee ? 'Send Request' : 'Execute Workflow'}
        </h2>
        <p className="text-sm text-gray-400 mb-5">{workflow.name}</p>

        {Object.entries(schema).map(([key, field]) => (
          <div key={key} className="mb-4">
            <label className="label">
              {key}
              {field.required && <span className="text-red-400 ml-1">*</span>}
              <span className="text-gray-600 ml-1">({field.type})</span>
            </label>
            {field.allowed_values?.length ? (
              <select
                className="input"
                value={inputs[key] ?? ''}
                onChange={(e) => setInputs(p => ({ ...p, [key]: e.target.value }))}
              >
                <option value="">Select...</option>
                {field.allowed_values.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                type={field.type === 'number' ? 'number' : 'text'}
                placeholder={`Enter ${key}...`}
                value={inputs[key] ?? ''}
                onChange={(e) => setInputs(p => ({ ...p, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}

        <div className="flex gap-3 mt-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={handleSubmit}
            disabled={startExecution.isPending}
          >
            {startExecution.isPending
              ? <Spinner className="w-4 h-4" />
              : isEmployee ? <><Send size={14} /> Send Request</> : <><Play size={14} /> Start Execution</>}
          </button>
        </div>
      </div>
    </div>
  );
}
