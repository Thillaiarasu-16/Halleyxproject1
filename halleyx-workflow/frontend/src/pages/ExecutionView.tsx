import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useExecution, useApproveExecution, useRejectExecution, useResubmitExecution } from '../api/hooks';
import { StatusBadge, Spinner, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import type { StepLog } from '../types';

// Safely parse logs — PostgreSQL sometimes returns JSON fields as strings
function parseLogs(logs: unknown): StepLog[] {
  if (!logs) return [];
  if (typeof logs === 'string') {
    try { return JSON.parse(logs); } catch { return []; }
  }
  if (Array.isArray(logs)) return logs as StepLog[];
  return [];
}

export default function ExecutionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { data: execution, isLoading } = useExecution(id);
  const [showResubmit, setShowResubmit] = useState(searchParams.get('resubmit') === '1');

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;
  if (!execution) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-gray-400 text-sm">Execution not found or you don't have access.</p>
      <button className="btn-secondary text-xs" onClick={() => navigate('/audit')}>
        <ArrowLeft size={13} /> Back to Audit Log
      </button>
    </div>
  );

  const isLive            = execution.status === 'IN_PROGRESS' || execution.status === 'PENDING';
  const isPendingApproval = execution.status === 'PENDING';
  const isRejected        = execution.status === 'FAILED';
  const isOwner           = execution.triggered_by_id === user?.id;
  const isManager         = user?.role === 'FINANCE_MANAGER' || user?.role === 'CEO';

  const logs       = parseLogs(execution.logs);
  const pendingLog = isPendingApproval
    ? logs.find((l) => l.status === 'awaiting_approval')
    : null;

  return (
    <div>
      <PageHeader
        title="Request Details"
        description={`ID: ${execution.id.slice(0, 8)}… · Request v${execution.request_version ?? 1}`}
        action={
          <button className="btn-secondary" onClick={() => navigate('/audit')}>
            <ArrowLeft size={14} /> Audit Log
          </button>
        }
      />

      {/* ── Rejection banner with resubmit for employees ─────────────────── */}
      {isRejected && isOwner && !isManager && (
        <div className="mb-6 rounded-xl border border-red-800/50 bg-red-950/20 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-300 mb-1">Request Rejected</p>
              {execution.rejection_note && (
                <p className="text-sm text-red-400/80">{execution.rejection_note}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                You can correct and resubmit this request. Version will increment to r{(execution.request_version ?? 1) + 1}.
              </p>
            </div>
            <button
              className="btn py-1.5 px-4 bg-brand-900/40 hover:bg-brand-800/60 text-brand-300 border border-brand-800/50 text-xs flex-shrink-0"
              onClick={() => setShowResubmit(true)}
            >
              <RefreshCw size={13} /> Resubmit
            </button>
          </div>
        </div>
      )}

      {/* ── Resubmit form ───────────────────────────────────────────────────── */}
      {showResubmit && execution && (
        <ResubmitForm
          execution={execution}
          onDone={(newId) => { setShowResubmit(false); navigate(`/executions/${newId}`); }}
          onCancel={() => setShowResubmit(false)}
        />
      )}

      {/* ── Pending Approval Banner ─────────────────────────────────────── */}
      {isPendingApproval && pendingLog && isManager && (
        <ApprovalBanner
          executionId={execution.id}
          stepName={pendingLog.step_name}
          assigneeEmail={pendingLog.assignee_email}
          instructions={pendingLog.instructions}
        />
      )}

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="card p-5 mb-6 grid grid-cols-2 md:grid-cols-4 gap-5">
        <Stat label="Status">
          <div className="flex items-center gap-2">
            <StatusBadge status={execution.status} />
            {isLive && <Spinner className="w-3.5 h-3.5 text-blue-400" />}
          </div>
        </Stat>
        <Stat label="Workflow">
          <span className="text-sm text-gray-200">{execution.workflow?.name ?? '—'}</span>
        </Stat>
        <Stat label="Submitted by">
          <div>
            <p className="text-sm text-gray-200">{execution.user?.name ?? execution.triggered_by ?? '—'}</p>
            {execution.user?.role && (
              <p className="text-xs text-gray-500">{execution.user.role.replace('_', ' ')}</p>
            )}
          </div>
        </Stat>
        <Stat label="Request version">
          <span className="badge bg-gray-800 text-gray-300 border border-gray-700 text-sm">
            r{execution.request_version ?? 1}
          </span>
        </Stat>
        <Stat label="Started">
          <span className="text-sm text-gray-200">{new Date(execution.started_at).toLocaleString()}</span>
        </Stat>
        <Stat label="Ended">
          <span className="text-sm text-gray-200">
            {execution.ended_at ? new Date(execution.ended_at).toLocaleString() : '—'}
          </span>
        </Stat>
        <Stat label="Workflow version">
          <span className="text-sm text-gray-200">v{execution.workflow_version}</span>
        </Stat>
        <Stat label="Steps">
          <span className="text-sm text-gray-200">{logs.length}</span>
        </Stat>
      </div>

      {/* ── Input data ──────────────────────────────────────────────────── */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Request Data</h2>
        <pre className="text-xs font-mono text-gray-300 bg-gray-800/60 rounded-lg p-4 overflow-auto">
          {JSON.stringify(execution.data, null, 2)}
        </pre>
      </div>

      {/* ── Step logs ────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Execution Logs</h2>
        {logs.length === 0 ? (
          <div className="card p-8 text-center text-gray-500 text-sm">
            {isLive ? 'Processing...' : 'No logs yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log, i) => (
              <StepLogCard key={i} log={log} index={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Resubmit Form ────────────────────────────────────────────────────────────
function ResubmitForm({
  execution, onDone, onCancel,
}: {
  execution: NonNullable<ReturnType<typeof useExecution>['data']>;
  onDone: (newId: string) => void;
  onCancel: () => void;
}) {
  const resubmit = useResubmitExecution();
  const data = execution.data as Record<string, unknown>;
  const [inputs, setInputs] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
  );

  const handleSubmit = async () => {
    const newData: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputs)) {
      newData[k] = isNaN(Number(v)) || v === '' ? v : Number(v);
    }
    const result = await resubmit.mutateAsync({ id: execution.id, data: newData });
    onDone(result.id);
  };

  return (
    <div className="card p-5 mb-6 border border-brand-800/50">
      <h2 className="text-sm font-semibold text-white mb-1">
        Resubmit Request
        <span className="ml-2 badge bg-brand-900/40 text-brand-300 border border-brand-800/50">
          → r{(execution.request_version ?? 1) + 1}
        </span>
      </h2>
      <p className="text-xs text-gray-500 mb-4">Correct the values below and resubmit.</p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {Object.entries(inputs).map(([key, val]) => (
          <div key={key}>
            <label className="label">{key}</label>
            <input
              className="input"
              value={val}
              onChange={(e) => setInputs(p => ({ ...p, [key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button className="btn-secondary text-xs py-1.5" onClick={onCancel}>Cancel</button>
        <button
          className="btn-primary text-xs py-1.5"
          onClick={handleSubmit}
          disabled={resubmit.isPending}
        >
          {resubmit.isPending ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw size={13} />}
          Resubmit
        </button>
      </div>
    </div>
  );
}

// ─── Approval Banner ──────────────────────────────────────────────────────────
function ApprovalBanner({
  executionId, stepName, assigneeEmail, instructions,
}: {
  executionId: string;
  stepName: string;
  assigneeEmail?: string | null;
  instructions?: string | null;
}) {
  const [approver, setApprover] = useState('');
  const [comment,  setComment]  = useState('');
  const [showForm, setShowForm] = useState(false);
  const [action,   setAction]   = useState<'approve' | 'reject' | null>(null);
  const { user } = useAuth();

  const approve = useApproveExecution();
  const reject  = useRejectExecution();

  const handleSubmit = async () => {
    const name = approver.trim() || user?.name || 'unknown';
    if (action === 'approve') {
      await approve.mutateAsync({ id: executionId, approver: name, comment });
    } else {
      await reject.mutateAsync({ id: executionId, approver: name, comment });
    }
    setShowForm(false);
  };

  const isPending = approve.isPending || reject.isPending;

  return (
    <div className="mb-6 rounded-xl border border-orange-800/50 bg-orange-950/30 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-orange-900/50 border border-orange-800/50 flex items-center justify-center flex-shrink-0">
          <UserCheck size={15} className="text-orange-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-200">Awaiting Your Approval</p>
          <p className="text-xs text-orange-400 mt-0.5">
            Step <span className="font-medium text-orange-300">"{stepName}"</span> is waiting
            {assigneeEmail && <span className="ml-1">— assigned to <span className="font-medium">{assigneeEmail}</span></span>}
          </p>
        </div>
        {!showForm && (
          <div className="flex gap-2">
            <button
              className="btn py-1.5 px-4 bg-green-900/40 hover:bg-green-800/60 text-green-300 border border-green-800/50 text-xs"
              onClick={() => { setAction('approve'); setShowForm(true); }}
            >
              <CheckCircle size={13} /> Approve
            </button>
            <button
              className="btn py-1.5 px-4 bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/50 text-xs"
              onClick={() => { setAction('reject'); setShowForm(true); }}
            >
              <XCircle size={13} /> Reject
            </button>
          </div>
        )}
      </div>

      {instructions && !showForm && (
        <div className="px-5 pb-4">
          <p className="text-xs text-orange-300/70 bg-orange-900/20 rounded-lg px-3 py-2">
            📋 {instructions}
          </p>
        </div>
      )}

      {showForm && (
        <div className="border-t border-orange-800/30 px-5 py-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            {action === 'approve'
              ? <CheckCircle size={14} className="text-green-400" />
              : <XCircle    size={14} className="text-red-400" />}
            <span className="text-sm font-medium text-gray-200">
              {action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </span>
          </div>
          <div>
            <label className="label">Your name</label>
            <input
              className="input"
              placeholder={user?.name ?? 'Enter your name...'}
              value={approver}
              onChange={(e) => setApprover(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">
              {action === 'reject' ? 'Reason for rejection *' : 'Comment (optional)'}
            </label>
            <input
              className="input"
              placeholder={action === 'reject' ? 'Explain why this is rejected...' : 'Add a note...'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-secondary text-xs py-1.5" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              className={`btn text-xs py-1.5 px-4 ${
                action === 'approve'
                  ? 'bg-green-900/40 hover:bg-green-800/60 text-green-300 border border-green-800/50'
                  : 'bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-800/50'
              }`}
              onClick={handleSubmit}
              disabled={isPending || (action === 'reject' && !comment.trim())}
            >
              {isPending
                ? <Spinner className="w-3.5 h-3.5" />
                : action === 'approve' ? <CheckCircle size={13} /> : <XCircle size={13} />}
              {action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat ─────────────────────────────────────────────────────────────────────
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

// ─── Step Log Card ────────────────────────────────────────────────────────────
function StepLogCard({ log, index }: { log: StepLog; index: number }) {
  const [open, setOpen] = useState(index === 1);
  const isApproved  = log.approval_action === 'approved';
  const isRejected  = log.status === 'rejected' || log.approval_action === 'rejected';
  const isAwaiting  = log.status === 'awaiting_approval' && !isApproved && !isRejected;
  const durationSec = log.duration_ms != null ? (log.duration_ms / 1000).toFixed(2) : null;

  return (
    <div className={`card overflow-hidden ${isAwaiting ? 'border-orange-800/50' : ''}`}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {isAwaiting ? (
            <AlertTriangle size={15} className="text-orange-400 flex-shrink-0" />
          ) : isRejected ? (
            <XCircle size={15} className="text-red-400 flex-shrink-0" />
          ) : (
            <CheckCircle size={15} className="text-green-400 flex-shrink-0" />
          )}
          <span className="text-xs text-gray-500">#{index}</span>
          <span className="text-sm font-medium text-gray-100">{log.step_name}</span>
          <span className="text-xs text-gray-500 capitalize">{log.step_type.toLowerCase()}</span>
          {isAwaiting && <span className="badge bg-orange-900/40 text-orange-300 border border-orange-800/50">awaiting approval</span>}
          {isApproved  && <span className="badge bg-green-900/40  text-green-300  border border-green-800/50">approved</span>}
          {isRejected  && <span className="badge bg-red-900/40    text-red-300    border border-red-800/50">rejected</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {durationSec && <span className="flex items-center gap-1"><Clock size={11} />{durationSec}s</span>}
          {log.selected_next_step && <span>→ <span className="text-brand-400">{log.selected_next_step}</span></span>}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {/* Approval details */}
          {log.step_type === 'APPROVAL' && (
            <div className="bg-gray-800/40 rounded-lg p-3 space-y-2 text-xs">
              {log.assignee_email  && <Row label="Assigned to"  val={log.assignee_email} />}
              {log.instructions    && <Row label="Instructions" val={log.instructions} />}
              {log.approver        && <Row label="Actioned by"  val={log.approver} />}
              {log.approval_comment && <Row label="Comment"     val={log.approval_comment} />}
              {(log.approved_at || log.rejected_at) && (
                <Row
                  label={log.approved_at ? 'Approved at' : 'Rejected at'}
                  val={new Date(log.approved_at ?? log.rejected_at!).toLocaleString()}
                  mono
                />
              )}
            </div>
          )}

          {/* Notification details */}
          {log.step_type === 'NOTIFICATION' && (
            <div className="bg-gray-800/40 rounded-lg p-3 space-y-2 text-xs">
              {log.notification_recipient && <Row label="Sent to"  val={log.notification_recipient} />}
              {log.notification_channel   && <Row label="Channel"  val={log.notification_channel} />}
              {log.preview_url && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-28">Preview</span>
                  <a href={log.preview_url} target="_blank" rel="noreferrer"
                    className="text-brand-400 underline truncate">
                    View email →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Rule evaluations */}
          {log.evaluated_rules.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Rule evaluations</p>
              <div className="space-y-1.5">
                {log.evaluated_rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-gray-800/40 rounded px-3 py-2">
                    {r.result
                      ? <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                      : <XCircle    size={12} className="text-gray-600 flex-shrink-0" />}
                    <code className="flex-1 font-mono text-gray-300 truncate">{r.rule}</code>
                    <span className={r.result ? 'text-green-400' : 'text-gray-600'}>
                      {r.result ? 'true' : 'false'}
                    </span>
                    {r.error && <span className="text-red-400 ml-2">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timing */}
          {log.started_at && (
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-gray-500 mb-1">Started</p>
                <p className="text-gray-300 font-mono">{new Date(log.started_at).toLocaleTimeString()}</p>
              </div>
              {log.ended_at && (
                <div>
                  <p className="text-gray-500 mb-1">Ended</p>
                  <p className="text-gray-300 font-mono">{new Date(log.ended_at).toLocaleTimeString()}</p>
                </div>
              )}
              {log.matched_rule && (
                <div>
                  <p className="text-gray-500 mb-1">Matched rule</p>
                  <code className="text-brand-400 font-mono truncate block">{log.matched_rule}</code>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, val, mono }: { label: string; val: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 w-28 flex-shrink-0">{label}</span>
      <span className={mono ? 'text-gray-300 font-mono' : 'text-gray-300'}>{val}</span>
    </div>
  );
}
