import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Play, Pencil, Trash2, GitBranch } from 'lucide-react';
import { useWorkflows, useDeleteWorkflow, useStartExecution } from '../api/hooks';
import { PageHeader, EmptyState, Spinner } from '../components/ui';
import type { Workflow } from '../types';

export default function WorkflowList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [execInputs, setExecInputs] = useState<Record<string, string>>({});

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
        description="Create and manage your automation workflows"
        action={
          <button className="btn-primary" onClick={() => navigate('/workflows/new')}>
            <Plus size={15} /> New Workflow
          </button>
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

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !data?.data.length ? (
        <EmptyState
          title="No workflows yet"
          description="Create your first workflow to get started"
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Name', 'Steps', 'Version', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {data.data.map((wf: Workflow) => (
                  <WorkflowRow
                    key={wf.id}
                    workflow={wf}
                    onEdit={() => navigate(`/workflows/${wf.id}/edit`)}
                    onDelete={() => handleDelete(wf.id, wf.name)}
                    onExecute={() => {
                      setExecutingId(wf.id);
                      setExecInputs({});
                    }}
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

      {/* Execute Modal */}
      {executingId && data?.data && (
        <ExecuteModal
          workflow={data.data.find(w => w.id === executingId)!}
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

function WorkflowRow({
  workflow, onEdit, onDelete, onExecute
}: {
  workflow: Workflow;
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
        <span className={`badge ${workflow.is_active ? 'bg-green-900/40 text-green-300 border border-green-800/50' : 'bg-gray-800 text-gray-400'}`}>
          {workflow.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button onClick={onExecute} className="btn-primary py-1 px-2.5 text-xs">
            <Play size={12} /> Execute
          </button>
          <button onClick={onEdit} className="btn-secondary py-1 px-2.5 text-xs">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={onDelete} className="btn-danger py-1 px-2.5 text-xs">
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ExecuteModal({
  workflow, onClose, onStarted
}: {
  workflow: Workflow;
  onClose: () => void;
  onStarted: (execId: string) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const startExecution = useStartExecution(workflow.id);
  const schema = workflow.input_schema ?? {};

  const handleSubmit = async () => {
    const data: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(schema)) {
      const raw = inputs[key] ?? '';
      data[key] = field.type === 'number' ? Number(raw) : raw;
    }
    const exec = await startExecution.mutateAsync({ data, triggered_by: 'user' });
    onStarted(exec.id);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-white mb-1">Execute Workflow</h2>
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
            {startExecution.isPending ? <Spinner className="w-4 h-4" /> : <Play size={14} />}
            Start Execution
          </button>
        </div>
      </div>
    </div>
  );
}
