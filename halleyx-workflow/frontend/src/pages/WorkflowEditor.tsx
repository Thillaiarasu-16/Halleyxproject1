import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useWorkflow, useCreateWorkflow, useUpdateWorkflow,
  useCreateStep, useUpdateStep, useDeleteStep,
  useCreateRule, useUpdateRule, useDeleteRule,
} from '../api/hooks';
import { StepTypeBadge, Spinner, PageHeader } from '../components/ui';
import type { Step, Rule, StepType } from '../types';

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;

  const { data: workflow, isLoading } = useWorkflow(id);
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow(id ?? '');

  const [name, setName] = useState('');
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

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  const steps = workflow?.steps ?? [];

  return (
    <div>
      <PageHeader
        title={isNew ? 'New Workflow' : `Edit: ${workflow?.name}`}
        description={isNew ? 'Define your workflow name, description and steps' : `Version ${workflow?.version}`}
        action={
          <button className="btn-secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back
          </button>
        }
      />

      {/* Workflow metadata */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Workflow Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Expense Approval" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            className="btn-primary"
            onClick={handleSaveWorkflow}
            disabled={createWorkflow.isPending || updateWorkflow.isPending}
          >
            {(createWorkflow.isPending || updateWorkflow.isPending) ? <Spinner className="w-4 h-4" /> : <Save size={14} />}
            {isNew ? 'Create Workflow' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Steps section — only shown after workflow is created */}
      {!isNew && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Steps</h2>
            <AddStepButton workflowId={id!} nextOrder={steps.length + 1} />
          </div>

          {steps.length === 0 ? (
            <div className="card p-8 text-center text-gray-500 text-sm">
              No steps yet. Add your first step above.
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step) => (
                <StepCard
                  key={step.id}
                  step={step}
                  workflowId={id!}
                  allSteps={steps}
                  expanded={expandedStep === step.id}
                  onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                />
              ))}
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
    <div className="card p-4 flex items-end gap-3">
      <div className="flex-1">
        <label className="label">Step Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Manager Approval" autoFocus />
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
  step, workflowId, allSteps, expanded, onToggle,
}: {
  step: Step; workflowId: string; allSteps: Step[]; expanded: boolean; onToggle: () => void;
}) {
  const deleteStep = useDeleteStep(workflowId);
  const [addingRule, setAddingRule] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <GripVertical size={14} className="text-gray-600" />
          <span className="text-xs text-gray-500 font-mono w-5">{step.order}.</span>
          <span className="text-sm font-medium text-gray-100">{step.name}</span>
          <StepTypeBadge type={step.step_type} />
          <span className="text-xs text-gray-600">{step.rules?.length ?? 0} rules</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-danger py-1 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); deleteStep.mutate(step.id); }}
          >
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-gray-400">Rules (evaluated in priority order)</span>
            <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => setAddingRule(true)}>
              <Plus size={12} /> Add Rule
            </button>
          </div>

          <div className="space-y-2">
            {(step.rules ?? []).map((rule) => (
              <RuleRow key={rule.id} rule={rule} stepId={step.id} allSteps={allSteps} />
            ))}
            {(step.rules ?? []).length === 0 && (
              <p className="text-xs text-gray-600 py-2">No rules yet. Add a rule to control workflow routing.</p>
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
      )}
    </div>
  );
}

// ─── Rule Row ─────────────────────────────────────────────────────────────────
function RuleRow({ rule, stepId, allSteps }: { rule: Rule; stepId: string; allSteps: Step[] }) {
  const deleteRule = useDeleteRule(stepId);
  const nextStep = allSteps.find(s => s.id === rule.next_step_id);

  return (
    <div className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
      <span className="text-gray-500 font-mono w-4 text-center">{rule.priority}</span>
      <code className="flex-1 text-gray-300 font-mono bg-gray-900/50 px-2 py-1 rounded truncate">
        {rule.condition}
      </code>
      <span className="text-gray-500">→</span>
      <span className="text-brand-400 min-w-0 truncate max-w-[120px]">
        {nextStep?.name ?? (rule.next_step_id ? '?' : 'End')}
      </span>
      <button
        className="text-gray-600 hover:text-red-400 transition-colors ml-auto flex-shrink-0"
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
  const [condition, setCondition] = useState('');
  const [nextStepId, setNextStepId] = useState('');
  const [priority, setPriority] = useState(nextPriority);
  const createRule = useCreateRule(stepId, workflowId);

  const handleAdd = async () => {
    if (!condition.trim()) return;
    await createRule.mutateAsync({
      condition,
      next_step_id: nextStepId || null,
      priority,
    });
    onDone();
  };

  return (
    <div className="mt-3 card bg-gray-800/50 p-3 space-y-3">
      <p className="text-xs font-medium text-gray-400">New Rule</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Priority</label>
          <input
            className="input text-xs"
            type="number"
            min={1}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <label className="label">Condition</label>
          <input
            className="input text-xs font-mono"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g. amount > 100 && country == 'US'"
            autoFocus
          />
        </div>
      </div>
      <div>
        <label className="label">Next Step</label>
        <select
          className="input text-xs"
          value={nextStepId}
          onChange={(e) => setNextStepId(e.target.value)}
        >
          <option value="">End workflow</option>
          {allSteps.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
