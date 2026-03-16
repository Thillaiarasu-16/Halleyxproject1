import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useExecution } from '../api/hooks';
import { StatusBadge, Spinner, PageHeader } from '../components/ui';
import type { StepLog } from '../types';

export default function ExecutionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: execution, isLoading } = useExecution(id);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!execution) return <div className="text-gray-400 text-sm">Execution not found.</div>;

  const isLive = execution.status === 'IN_PROGRESS' || execution.status === 'PENDING';

  return (
    <div>
      <PageHeader
        title="Execution Details"
        description={`Execution ID: ${execution.id}`}
        action={
          <button className="btn-secondary" onClick={() => navigate('/audit')}>
            <ArrowLeft size={14} /> Audit Log
          </button>
        }
      />

      {/* Summary card */}
      <div className="card p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-5">
        <Stat label="Status">
          <div className="flex items-center gap-2">
            <StatusBadge status={execution.status} />
            {isLive && <Spinner className="w-3.5 h-3.5 text-blue-400" />}
          </div>
        </Stat>
        <Stat label="Workflow">
          <span className="text-sm text-gray-200">{execution.workflow?.name ?? execution.workflow_id}</span>
        </Stat>
        <Stat label="Version">
          <span className="text-sm text-gray-200">v{execution.workflow_version}</span>
        </Stat>
        <Stat label="Triggered by">
          <span className="text-sm text-gray-200">{execution.triggered_by ?? '—'}</span>
        </Stat>
        <Stat label="Started">
          <span className="text-sm text-gray-200">{new Date(execution.started_at).toLocaleString()}</span>
        </Stat>
        <Stat label="Ended">
          <span className="text-sm text-gray-200">
            {execution.ended_at ? new Date(execution.ended_at).toLocaleString() : '—'}
          </span>
        </Stat>
        <Stat label="Steps executed">
          <span className="text-sm text-gray-200">{execution.logs.length}</span>
        </Stat>
        <Stat label="Retries">
          <span className="text-sm text-gray-200">{execution.retries}</span>
        </Stat>
      </div>

      {/* Input data */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Input Data</h2>
        <pre className="text-xs font-mono text-gray-300 bg-gray-800/60 rounded-lg p-4 overflow-auto">
          {JSON.stringify(execution.data, null, 2)}
        </pre>
      </div>

      {/* Step logs */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Execution Logs</h2>
        {execution.logs.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            {isLive ? 'Execution in progress...' : 'No step logs available'}
          </div>
        ) : (
          <div className="space-y-3">
            {execution.logs.map((log, i) => (
              <StepLogCard key={i} log={log} index={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function StepLogCard({ log, index }: { log: StepLog; index: number }) {
  const [open, setOpen] = useState(index === 1);
  const durationSec = (log.duration_ms / 1000).toFixed(2);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {log.status === 'completed' ? (
            <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
          ) : (
            <XCircle size={15} className="text-red-400 flex-shrink-0" />
          )}
          <span className="text-xs text-gray-500">#{index}</span>
          <span className="text-sm font-medium text-gray-100">{log.step_name}</span>
          <span className="text-xs text-gray-500 capitalize">{log.step_type.toLowerCase()}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock size={11} /> {durationSec}s</span>
          {log.selected_next_step && (
            <span>→ <span className="text-brand-400">{log.selected_next_step}</span></span>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {/* Rule evaluations */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Rule Evaluations</p>
            <div className="space-y-1.5">
              {log.evaluated_rules.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-xs bg-gray-800/40 rounded px-3 py-2">
                  {r.result ? (
                    <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle size={12} className="text-gray-600 flex-shrink-0" />
                  )}
                  <code className="flex-1 font-mono text-gray-300 truncate">{r.rule}</code>
                  <span className={r.result ? 'text-green-400' : 'text-gray-600'}>
                    {r.result ? 'true' : 'false'}
                  </span>
                  {r.error && <span className="text-red-400 ml-2">{r.error}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-gray-500 mb-1">Started</p>
              <p className="text-gray-300 font-mono">{new Date(log.started_at).toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Ended</p>
              <p className="text-gray-300 font-mono">{new Date(log.ended_at).toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Matched rule</p>
              <code className="text-brand-400 font-mono truncate block">
                {log.matched_rule ?? '—'}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
