import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Save, GripVertical,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  Play, Flag
} from 'lucide-react';
import {
  useWorkflow, useCreateWorkflow, useUpdateWorkflow,
  useCreateStep, useUpdateStep, useDeleteStep,
  useCreateRule, useDeleteRule,
} from '../api/hooks';
import { StepTypeBadge, Spinner, PageHeader } from '../components/ui';
import type { Step, Rule, StepType } from '../types';
import clsx from 'clsx';

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const { data: workflow, isLoading } = useWorkflow(id);
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow(id ?? '');

  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description ?? '');
    }
  }, [workflow]);

  const handleSaveWorkflow = async () => {
    if (!name.trim()) return alert('Workflow name is required');
    if (isNew) {
      const created = await createWorkflow.mutateAsync({ name, description });
      navigate(`/workflows/${created.id}/edit`);
    } else {
      await updateWorkflow.mutateAsync({ name, description });
    }
  };

  if (!isNew && isLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  const steps = workflow?.steps ?? [];
  const startStepId = workflow?.start_step_id;

  // ── Validation warnings ───────────────────────────────────────────────────
  const warnings: string[] = [];
  if (!isNew) {
    if (steps.length === 0) warnings.push('No steps added yet — add at least one step');
    if (!startStepId)        warnings.push('No start step set — add a step to set it automatically');
    steps.forEach(s => {
      if ((s.rules?.length ?? 0) === 0) {
        warnings.push(`Step "${s.name}" has no rules — add a DEFAULT rule to route to the next step`);
      }
      if (s.step_type === 'APPROVAL' && !(s.metadata as Record<string,unknown>)?.assignee_email) {
        warnings.push(`Step "${s.name}" has no assignee email — add it in step settings`);
      }
      if (s.step_type === 'NOTIFICATION' && !(s.metadata as Record<string,unknown>)?.recipient) {
        warnings.push(`Step "${s.name}" has no recipient email — add it in step settings`);
      }
    });
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Workflow' : `Edit: ${workflow?.name}`}
        description={isNew ? 'Define your workflow name, description, steps and rules' : `Version ${workflow?.version}`}
        action={
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* ── Validation warnings ─────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="mb-6 card border-yellow-200 dark:border-yellow-800/50 bg-yellow-50 dark:bg-yellow-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-yellow-600 dark:text-yellow-400" />
            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
              Fix these before executing:
            </p>
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                <span className="mt-0.5">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Workflow details ────────────────────────────────────────────────── */}
      <div className="card p-5 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-4">Workflow Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leave Request" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="btn-primary" onClick={handleSaveWorkflow}
            disabled={createWorkflow.isPending || updateWorkflow.isPending}>
            {(createWorkflow.isPending || updateWorkflow.isPending) ? <Spinner className="w-4 h-4" /> : <Save size={14} />}
            {isNew ? 'Create Workflow' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Steps section ───────────────────────────────────────────────────── */}
      {!isNew && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-gray-300">Steps</h2>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                First step added becomes the start step automatically
              </p>
            </div>
            <AddStepButton workflowId={id!} nextOrder={steps.length + 1} />
          </div>

          {steps.length === 0 ? (
            <div className="card p-10 text-center shadow-sm">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <Play size={16} className="text-slate-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-400">No steps yet</p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                Click "Add Step" to build your workflow
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  workflowId={id!}
                  allSteps={steps}
                  isStartStep={step.id === startStepId}
                  expanded={expandedStep === step.id}
                  onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                />
              ))}
            </div>
          )}

          {/* ── How to guide ────────────────────────────────────────────────── */}
          {steps.length > 0 && (
            <div className="mt-6 card p-4 shadow-sm bg-slate-50 dark:bg-gray-900/50">
              <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-2">
                💡 How to make your workflow work
              </p>
              <ol className="space-y-1 text-xs text-slate-500 dark:text-gray-500 list-decimal list-inside">
                <li>Add all your steps (Task, Approval, or Notification)</li>
                <li>For each step, click to expand and add rules</li>
                <li>Each rule needs a <strong>condition</strong> and a <strong>next step</strong></li>
                <li>Always add a <strong>DEFAULT</strong> rule as the last rule (fallback)</li>
                <li>For Approval steps, set the <strong>assignee email</strong> in step settings</li>
                <li>For Notification steps, set the <strong>recipient email</strong> in step settings</li>
                <li>The last step should have a DEFAULT rule with <strong>no next step</strong> (ends workflow)</li>
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Step Button ──────────────────────────────────────────────────────────
function AddStepButton({ workflowId, nextOrder }: { workflowId: string; nextOrder: number }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<StepType>('TASK');
  const createStep = useCreateStep(workflowId);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await createStep.mutateAsync({ name, step_type: type, order: nextOrder });
    setName(''); setType('TASK'); setShow(false);
  };

  if (!show) return (
    <button className="btn-secondary text-xs" onClick={() => setShow(true)}>
      <Plus size={13} /> Add Step
    </button>
  );

  return (
    <div className="card p-4 flex items-end gap-3 shadow-sm mb-3">
      <div className="flex-1">
        <label className="label">Step Name</label>
        <input className="input" value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Manager Approval" autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
      </div>
      <div>
        <label className="label">Type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value as StepType)}>
          <option value="TASK">Task</option>
          <option value="APPROVAL">Approval</option>
          <option value="NOTIFICATION">Notification</option>
        </select>
      </div>
      <button className="btn-primary" onClick={handleAdd} disabled={createStep.isPending}>
        {createStep.isPending ? <Spinner className="w-4 h-4" /> : 'Add'}
      </button>
      <button className="btn-secondary" onClick={() => setShow(false)}>Cancel</button>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────
function StepCard({
  step, workflowId, allSteps, isStartStep, expanded, onToggle,
}: {
  step: Step;
  workflowId: string;
  allSteps: Step[];
  isStartStep: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const deleteStep = useDeleteStep(workflowId);
  const [addingRule, setAddingRule] = useState(false);

  return (
    <div className={clsx(
      'card overflow-hidden shadow-sm',
      isStartStep && 'ring-2 ring-brand-500/40'
    )}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <GripVertical size={14} className="text-slate-400 dark:text-gray-600" />
          <span className="text-xs text-slate-400 dark:text-gray-500 font-mono w-5">{step.order}.</span>
          <span className="text-sm font-medium text-slate-800 dark:text-gray-100">{step.name}</span>
          <StepTypeBadge type={step.step_type} />
          {isStartStep && (
            <span className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 font-medium">
              <Flag size={10} /> start
            </span>
          )}
          <span className={clsx(
            'text-xs',
            (step.rules?.length ?? 0) === 0
              ? 'text-red-500 dark:text-red-400'
              : 'text-slate-400 dark:text-gray-600'
          )}>
            {step.rules?.length ?? 0} rules
            {(step.rules?.length ?? 0) === 0 && ' ⚠'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-danger py-1 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); deleteStep.mutate(step.id); }}
          >
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-gray-800 px-4 py-4 space-y-4">

          {/* ── Step Settings (metadata) ─────────────────────────────────── */}
          <StepMetaEditor step={step} workflowId={workflowId} />

          {/* ── Rules ────────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-400">
                Rules <span className="text-slate-400 dark:text-gray-500 font-normal">(evaluated top to bottom)</span>
              </span>
              <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setAddingRule(true)}>
                <Plus size={12} /> Add Rule
              </button>
            </div>

            <div className="space-y-2">
              {(step.rules ?? []).map((rule) => (
                <RuleRow key={rule.id} rule={rule} stepId={step.id} allSteps={allSteps} />
              ))}
              {(step.rules ?? []).length === 0 && (
                <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2">
                  ⚠ No rules — this step will not know where to go next. Add a DEFAULT rule.
                </div>
              )}
            </div>

            {addingRule && (
              <AddRuleForm
                stepId={step.id}
                workflowId={workflowId}
                allSteps={allSteps}
                nextPriority={(step.rules?.length ?? 0) + 1}
                onDone={() => setAddingRule(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step Metadata Editor ─────────────────────────────────────────────────────
function StepMetaEditor({ step, workflowId }: { step: Step; workflowId: string }) {
  const updateStep  = useUpdateStep(workflowId);
  const meta        = (step.metadata ?? {}) as Record<string, string>;
  const [assignee,  setAssignee]    = useState(meta.assignee_email ?? '');
  const [recipient, setRecipient]   = useState(meta.recipient ?? '');
  const [template,  setTemplate]    = useState(meta.template ?? 'default');
  const [instructions, setInstructions] = useState(meta.instructions ?? '');
  const [saving, setSaving]         = useState(false);
  const [saved,  setSaved]          = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newMeta: Record<string, string> = {};
    if (step.step_type === 'APPROVAL') {
      if (assignee)      newMeta.assignee_email = assignee;
      if (instructions)  newMeta.instructions   = instructions;
    }
    if (step.step_type === 'NOTIFICATION') {
      if (recipient) newMeta.recipient             = recipient;
      if (template)  newMeta.notification_channel  = 'email';
      if (template)  newMeta.template              = template;
    }
    await updateStep.mutateAsync({ id: step.id, metadata: newMeta });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (step.step_type === 'TASK') return null;

  return (
    <div className="bg-slate-50 dark:bg-gray-800/40 rounded-lg p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">Step Settings</p>

      {step.step_type === 'APPROVAL' && (
        <>
          <div>
            <label className="label">Assignee Email *</label>
            <input className="input text-xs" type="email"
              placeholder="manager@company.com"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              This person will receive an email and must approve/reject
            </p>
          </div>
          <div>
            <label className="label">Instructions</label>
            <input className="input text-xs"
              placeholder="e.g. Review and approve if within budget"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </>
      )}

      {step.step_type === 'NOTIFICATION' && (
        <>
          <div>
            <label className="label">Recipient Email *</label>
            <input className="input text-xs" type="email"
              placeholder="finance@company.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              This person will receive the notification email
            </p>
          </div>
          <div>
            <label className="label">Email Template</label>
            <select className="input text-xs" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="default">Default notification</option>
              <option value="finance-alert">Finance alert</option>
              <option value="new-hire-alert">New hire alert</option>
            </select>
          </div>
        </>
      )}

      <button className="btn-secondary text-xs py-1.5" onClick={handleSave} disabled={saving}>
        {saving ? <Spinner className="w-3.5 h-3.5" /> : saved ? <CheckCircle2 size={13} className="text-green-500" /> : <Save size={13} />}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────
function RuleRow({ rule, stepId, allSteps }: { rule: Rule; stepId: string; allSteps: Step[] }) {
  const deleteRule = useDeleteRule(stepId);
  const nextStep   = allSteps.find(s => s.id === rule.next_step_id);

  return (
    <div className="flex items-center gap-3 bg-slate-50 dark:bg-gray-800/40 rounded-lg px-3 py-2 text-xs border border-slate-100 dark:border-gray-700/50">
      <span className="text-slate-400 dark:text-gray-500 font-mono w-4 text-center flex-shrink-0">{rule.priority}</span>
      <code className="flex-1 text-slate-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900/50 px-2 py-1 rounded truncate border border-slate-100 dark:border-gray-700">
        {rule.condition}
      </code>
      <span className="text-slate-400 dark:text-gray-500 flex-shrink-0">→</span>
      <span className={clsx('min-w-0 truncate max-w-[120px] flex-shrink-0',
        rule.next_step_id ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400 dark:text-gray-500 italic'
      )}>
        {nextStep?.name ?? (rule.next_step_id ? '?' : 'End workflow')}
      </span>
      <button
        className="text-slate-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-auto flex-shrink-0"
        onClick={() => deleteRule.mutate(rule.id)}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Add Rule Form ────────────────────────────────────────────────────────────
function AddRuleForm({
  stepId, workflowId, allSteps, nextPriority, onDone,
}: {
  stepId: string; workflowId: string; allSteps: Step[]; nextPriority: number; onDone: () => void;
}) {
  const [condition,  setCondition]  = useState('');
  const [nextStepId, setNextStepId] = useState('');
  const [priority,   setPriority]   = useState(nextPriority);
  const createRule = useCreateRule(stepId, workflowId);

  const handleAdd = async () => {
    if (!condition.trim()) return;
    await createRule.mutateAsync({ condition, next_step_id: nextStepId || null, priority });
    onDone();
  };

  return (
    <div className="mt-3 card bg-slate-50 dark:bg-gray-800/50 p-3 space-y-3">
      <p className="text-xs font-semibold text-slate-600 dark:text-gray-400">New Rule</p>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="label">Priority</label>
          <input className="input text-xs" type="number" min={1}
            value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
        </div>
        <div className="col-span-3">
          <label className="label">Condition</label>
          <input className="input text-xs font-mono" value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="amount > 100 && priority == 'High'  or  DEFAULT"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="label">Next Step</label>
        <select className="input text-xs" value={nextStepId} onChange={(e) => setNextStepId(e.target.value)}>
          <option value="">End workflow (no next step)</option>
          {allSteps.map(s => (
            <option key={s.id} value={s.id}>{s.order}. {s.name}</option>
          ))}
        </select>
      </div>

      {/* Rule examples */}
      <div className="text-xs text-slate-400 dark:text-gray-500 bg-white dark:bg-gray-900/40 rounded p-2 border border-slate-100 dark:border-gray-700">
        <p className="font-medium mb-1">Examples:</p>
        <p className="font-mono">amount &gt; 100 &amp;&amp; priority == &apos;High&apos;</p>
        <p className="font-mono">country == &apos;US&apos; || department == &apos;HR&apos;</p>
        <p className="font-mono">DEFAULT  ← always use as last rule</p>
      </div>

      <div className="flex gap-2 justify-end">
        <button className="btn-secondary text-xs py-1" onClick={onDone}>Cancel</button>
        <button className="btn-primary text-xs py-1" onClick={handleAdd} disabled={createRule.isPending}>
          {createRule.isPending ? <Spinner className="w-3 h-3" /> : 'Add Rule'}
        </button>
      </div>
    </div>
  );
}
