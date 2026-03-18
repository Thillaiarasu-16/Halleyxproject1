import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Settings } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { PageHeader, Spinner } from '../components/ui';
import clsx from 'clsx';

interface TemplateInfo {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  step_count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Finance: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  HR:      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  IT:      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Custom:  'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function NewWorkflowPage() {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const [step, setStep]               = useState<'pick' | 'configure'>('pick');
  const [selected, setSelected]       = useState<TemplateInfo | null>(null);
  const [wfName, setWfName]           = useState('');
  const [wfDesc, setWfDesc]           = useState('');
  const [assigneeEmails, setAssignee] = useState<Record<string, string>>({});
  const [recipientEmails, setRecipient] = useState<Record<string, string>>({});

  const { data: templates = [], isLoading } = useQuery<TemplateInfo[]>({
    queryKey: ['workflow-templates'],
    queryFn:  () => api.get('/workflows/templates').then(r => r.data),
  });

  const createFromTemplate = useMutation({
    mutationFn: (body: object) => api.post('/workflows/from-template', body).then(r => r.data),
    onSuccess: (wf) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      navigate(`/workflows/${wf.id}/edit`);
    },
  });

  const handleSelectTemplate = (t: TemplateInfo) => {
    setSelected(t);
    setWfName(t.name);
    setWfDesc(t.description);
    if (t.key === 'blank') {
      // blank — go straight to editor
      createFromTemplate.mutate({ template_key: 'blank', name: t.name });
    } else {
      setStep('configure');
    }
  };

  const handleCreate = () => {
    if (!wfName.trim()) return alert('Please enter a workflow name');
    createFromTemplate.mutate({
      template_key:    selected!.key,
      name:            wfName,
      description:     wfDesc,
      assignee_emails: assigneeEmails,
      recipient_emails: recipientEmails,
    });
  };

  // Group templates by category
  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = [];
    acc[t.category].push(t);
    return acc;
  }, {} as Record<string, TemplateInfo[]>);

  return (
    <div>
      <PageHeader
        title={step === 'pick' ? 'New Workflow' : `Configure: ${selected?.name}`}
        description={step === 'pick' ? 'Pick a template to get started instantly' : 'Set names and emails — all steps and rules are pre-configured'}
        action={
          <button className="btn-secondary" onClick={() => step === 'configure' ? setStep('pick') : navigate('/')}>
            <ArrowLeft size={14} /> {step === 'configure' ? 'Back to templates' : 'Cancel'}
          </button>
        }
      />

      {/* ── Step 1: Pick a template ──────────────────────────────────────── */}
      {step === 'pick' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner /></div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([category, tmplts]) => (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={clsx('badge text-xs', CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Custom)}>
                      {category}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tmplts.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => handleSelectTemplate(t)}
                        disabled={createFromTemplate.isPending}
                        className={clsx(
                          'card p-5 text-left hover:shadow-md transition-all duration-150 hover:border-brand-300 dark:hover:border-brand-700 group',
                          'focus:outline-none focus:ring-2 focus:ring-brand-500/50'
                        )}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-2xl">{t.icon}</span>
                          {t.step_count > 0 && (
                            <span className="text-xs text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                              {t.step_count} steps
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-gray-100 mb-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed">
                          {t.description}
                        </p>
                        {t.key !== 'blank' && (
                          <div className="mt-3 flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Use this template <ArrowRight size={12} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Step 2: Configure ───────────────────────────────────────────────── */}
      {step === 'configure' && selected && (
        <div className="max-w-2xl space-y-6">

          {/* Workflow name + description */}
          <div className="card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-4">
              Workflow Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Workflow Name *</label>
                <input className="input" value={wfName}
                  onChange={(e) => setWfName(e.target.value)}
                  placeholder="e.g. My Expense Approval" autoFocus />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={wfDesc}
                  onChange={(e) => setWfDesc(e.target.value)}
                  placeholder="Optional description..." />
              </div>
            </div>
          </div>

          {/* Email configuration per step */}
          <div className="card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={14} className="text-slate-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                Email Configuration
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
              Set the email addresses for each step. These can also be updated later in the editor.
            </p>

            <div className="space-y-4">
              {/* Approval steps — need assignee email */}
              {getApprovalSteps(selected.key).map((s) => (
                <div key={s.key}>
                  <label className="label">
                    {s.name} — Assignee Email
                    <span className="text-slate-400 dark:text-gray-600 ml-1 font-normal">(who approves this step)</span>
                  </label>
                  <input
                    className="input"
                    type="email"
                    placeholder="manager@company.com"
                    value={assigneeEmails[s.key] ?? ''}
                    onChange={(e) => setAssignee(p => ({ ...p, [s.key]: e.target.value }))}
                  />
                </div>
              ))}

              {/* Notification steps — need recipient email */}
              {getNotificationSteps(selected.key).map((s) => (
                <div key={s.key}>
                  <label className="label">
                    {s.name} — Recipient Email
                    <span className="text-slate-400 dark:text-gray-600 ml-1 font-normal">(who receives the notification)</span>
                  </label>
                  <input
                    className="input"
                    type="email"
                    placeholder="employee@company.com"
                    value={recipientEmails[s.key] ?? ''}
                    onChange={(e) => setRecipient(p => ({ ...p, [s.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* What's included */}
          <div className="card p-5 shadow-sm bg-slate-50 dark:bg-gray-900/50">
            <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-3">
              ✅ What's pre-configured for you
            </p>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-gray-500">
              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> All steps created in the right order</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> All routing rules pre-configured</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Input schema (form fields) defined</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> DEFAULT fallback rules on every step</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Start step set automatically</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={() => setStep('pick')}>
              <ArrowLeft size={14} /> Back
            </button>
            <button
              className="btn-primary flex-1 justify-center"
              onClick={handleCreate}
              disabled={createFromTemplate.isPending}
            >
              {createFromTemplate.isPending
                ? <><Spinner className="w-4 h-4" /> Creating…</>
                : <><CheckCircle2 size={14} /> Create Workflow</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper — get approval steps for a template ───────────────────────────────
function getApprovalSteps(templateKey: string): { key: string; name: string }[] {
  const map: Record<string, { key: string; name: string }[]> = {
    'expense-approval':   [{ key: 'manager-approval', name: 'Manager Approval' }, { key: 'ceo-approval', name: 'CEO Approval' }],
    'leave-management':   [{ key: 'manager-approval', name: 'Manager Approval' }],
    'purchase-order':     [{ key: 'manager-approval', name: 'Manager Approval' }, { key: 'finance-review', name: 'Finance Review' }],
    'it-access-request':  [{ key: 'manager-approval', name: 'Manager Approval' }, { key: 'it-review', name: 'IT Security Review' }],
    'employee-onboarding': [],
  };
  return map[templateKey] ?? [];
}

function getNotificationSteps(templateKey: string): { key: string; name: string }[] {
  const map: Record<string, { key: string; name: string }[]> = {
    'expense-approval':   [{ key: 'finance-notification', name: 'Finance Notification' }],
    'leave-management':   [{ key: 'hr-notification', name: 'HR Notification' }],
    'purchase-order':     [{ key: 'notify-requester', name: 'Notify Requester' }],
    'it-access-request':  [{ key: 'it-setup', name: 'IT Setup & Notify' }],
    'employee-onboarding': [{ key: 'hr-notification', name: 'HR Notification' }],
  };
  return map[templateKey] ?? [];
}
