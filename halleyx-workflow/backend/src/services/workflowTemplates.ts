// ─── Workflow Templates ───────────────────────────────────────────────────────
// Each template defines a complete workflow with steps, rules and metadata.
// Used by POST /api/workflows/from-template to create a full workflow in one shot.

export interface TemplateRule {
  condition:    string;
  next_step_key: string | null; // references step by key, resolved to ID after creation
  priority:     number;
}

export interface TemplateStep {
  key:       string;           // internal reference key
  name:      string;
  step_type: 'TASK' | 'APPROVAL' | 'NOTIFICATION';
  order:     number;
  metadata:  Record<string, unknown>;
  rules:     TemplateRule[];
}

export interface WorkflowTemplate {
  key:          string;
  name:         string;
  description:  string;
  category:     string;
  icon:         string;
  input_schema: Record<string, unknown>;
  steps:        TemplateStep[];
  start_step_key: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [

  // ─── 1. Expense Approval ───────────────────────────────────────────────────
  {
    key:         'expense-approval',
    name:        'Expense Approval',
    description: 'Multi-level expense approval based on amount, country and priority',
    category:    'Finance',
    icon:        '💰',
    input_schema: {
      amount:     { type: 'number', required: true },
      country:    { type: 'string', required: true },
      department: { type: 'string', required: false },
      priority:   { type: 'string', required: true, allowed_values: ['High', 'Medium', 'Low'] },
    },
    start_step_key: 'manager-approval',
    steps: [
      {
        key: 'manager-approval', name: 'Manager Approval',
        step_type: 'APPROVAL', order: 1,
        metadata: { assignee_email: '', instructions: 'Review and approve or reject this expense request.' },
        rules: [
          { condition: "amount > 100 && country == 'US' && priority == 'High'", next_step_key: 'finance-notification', priority: 1 },
          { condition: "amount <= 100 || department == 'HR'",                   next_step_key: 'ceo-approval',         priority: 2 },
          { condition: "priority == 'Low' && country != 'US'",                  next_step_key: 'task-rejection',       priority: 3 },
          { condition: 'DEFAULT',                                                next_step_key: 'task-rejection',       priority: 4 },
        ],
      },
      {
        key: 'finance-notification', name: 'Finance Notification',
        step_type: 'NOTIFICATION', order: 2,
        metadata: { notification_channel: 'email', template: 'finance-alert', recipient: '' },
        rules: [
          { condition: 'amount > 10000', next_step_key: 'ceo-approval', priority: 1 },
          { condition: 'DEFAULT',        next_step_key: null,            priority: 2 },
        ],
      },
      {
        key: 'ceo-approval', name: 'CEO Approval',
        step_type: 'APPROVAL', order: 3,
        metadata: { assignee_email: '', instructions: 'Final approval for high-value expense.' },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
      {
        key: 'task-rejection', name: 'Task Rejection',
        step_type: 'TASK', order: 4,
        metadata: { action: 'reject', notify_requester: true },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
    ],
  },

  // ─── 2. Leave Management ──────────────────────────────────────────────────
  {
    key:         'leave-management',
    name:        'Leave Management',
    description: 'Employee leave request routed by leave type, days, department and priority',
    category:    'HR',
    icon:        '🏖️',
    input_schema: {
      employee_name: { type: 'string', required: true },
      leave_type:    { type: 'string', required: true,  allowed_values: ['Annual', 'Sick', 'Emergency', 'Casual'] },
      days:          { type: 'number', required: true },
      department:    { type: 'string', required: true,  allowed_values: ['Engineering', 'Finance', 'HR', 'Sales', 'Operations'] },
      priority:      { type: 'string', required: true,  allowed_values: ['High', 'Medium', 'Low'] },
      reason:        { type: 'string', required: false },
    },
    start_step_key: 'request-info',
    steps: [
      {
        key: 'request-info', name: 'Request Info',
        step_type: 'TASK', order: 1,
        metadata: { action: 'validate_request' },
        rules: [
          { condition: "leave_type == 'Emergency'",                                                         next_step_key: 'manager-approval',  priority: 1 },
          { condition: "priority == 'High' && days > 5",                                                    next_step_key: 'manager-approval',  priority: 2 },
          { condition: "leave_type == 'Annual' && days > 3",                                                next_step_key: 'manager-approval',  priority: 3 },
          { condition: "(department == 'Finance' || department == 'Engineering') && days > 2",              next_step_key: 'manager-approval',  priority: 4 },
          { condition: "(leave_type == 'Sick' || leave_type == 'Casual') && days <= 2 && priority == 'Low'", next_step_key: 'hr-notification',  priority: 5 },
          { condition: 'DEFAULT',                                                                            next_step_key: 'manager-approval',  priority: 6 },
        ],
      },
      {
        key: 'manager-approval', name: 'Manager Approval',
        step_type: 'APPROVAL', order: 2,
        metadata: { assignee_email: '', instructions: 'Review the leave request. Check leave type, duration and department workload.' },
        rules: [
          { condition: 'DEFAULT', next_step_key: 'hr-notification', priority: 1 },
        ],
      },
      {
        key: 'hr-notification', name: 'HR Notification',
        step_type: 'NOTIFICATION', order: 3,
        metadata: { notification_channel: 'email', template: 'new-hire-alert', recipient: '' },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
    ],
  },

  // ─── 3. Employee Onboarding ───────────────────────────────────────────────
  {
    key:         'employee-onboarding',
    name:        'Employee Onboarding',
    description: 'Standard onboarding flow for new employees joining the company',
    category:    'HR',
    icon:        '👋',
    input_schema: {
      employee_name: { type: 'string', required: true },
      department:    { type: 'string', required: true },
      role:          { type: 'string', required: true },
      start_date:    { type: 'string', required: true },
    },
    start_step_key: 'hr-notification',
    steps: [
      {
        key: 'hr-notification', name: 'HR Notification',
        step_type: 'NOTIFICATION', order: 1,
        metadata: { notification_channel: 'email', template: 'new-hire-alert', recipient: '' },
        rules: [
          { condition: 'DEFAULT', next_step_key: 'it-setup', priority: 1 },
        ],
      },
      {
        key: 'it-setup', name: 'IT Setup',
        step_type: 'TASK', order: 2,
        metadata: { action: 'provision_accounts', systems: ['email', 'slack', 'github'] },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
    ],
  },

  // ─── 4. Purchase Order Approval ───────────────────────────────────────────
  {
    key:         'purchase-order',
    name:        'Purchase Order Approval',
    description: 'Approve purchase orders based on amount and vendor type',
    category:    'Finance',
    icon:        '🛒',
    input_schema: {
      vendor_name:  { type: 'string', required: true },
      amount:       { type: 'number', required: true },
      vendor_type:  { type: 'string', required: true, allowed_values: ['Approved', 'New', 'International'] },
      department:   { type: 'string', required: true },
      priority:     { type: 'string', required: true, allowed_values: ['High', 'Medium', 'Low'] },
    },
    start_step_key: 'manager-approval',
    steps: [
      {
        key: 'manager-approval', name: 'Manager Approval',
        step_type: 'APPROVAL', order: 1,
        metadata: { assignee_email: '', instructions: 'Review and approve or reject this purchase order.' },
        rules: [
          { condition: "vendor_type == 'International' || amount > 5000", next_step_key: 'finance-review', priority: 1 },
          { condition: "vendor_type == 'New' && amount > 1000",           next_step_key: 'finance-review', priority: 2 },
          { condition: 'DEFAULT',                                          next_step_key: 'notify-requester', priority: 3 },
        ],
      },
      {
        key: 'finance-review', name: 'Finance Review',
        step_type: 'APPROVAL', order: 2,
        metadata: { assignee_email: '', instructions: 'Final review for high-value or international purchase orders.' },
        rules: [
          { condition: 'DEFAULT', next_step_key: 'notify-requester', priority: 1 },
        ],
      },
      {
        key: 'notify-requester', name: 'Notify Requester',
        step_type: 'NOTIFICATION', order: 3,
        metadata: { notification_channel: 'email', template: 'finance-alert', recipient: '' },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
    ],
  },

  // ─── 5. IT Access Request ─────────────────────────────────────────────────
  {
    key:         'it-access-request',
    name:        'IT Access Request',
    description: 'Request access to systems, tools or resources',
    category:    'IT',
    icon:        '🔐',
    input_schema: {
      employee_name:  { type: 'string', required: true },
      system_name:    { type: 'string', required: true },
      access_level:   { type: 'string', required: true, allowed_values: ['Read', 'Write', 'Admin'] },
      department:     { type: 'string', required: true },
      reason:         { type: 'string', required: true },
    },
    start_step_key: 'manager-approval',
    steps: [
      {
        key: 'manager-approval', name: 'Manager Approval',
        step_type: 'APPROVAL', order: 1,
        metadata: { assignee_email: '', instructions: 'Review access request. Approve only if business-justified.' },
        rules: [
          { condition: "access_level == 'Admin'", next_step_key: 'it-review', priority: 1 },
          { condition: 'DEFAULT',                  next_step_key: 'it-setup',  priority: 2 },
        ],
      },
      {
        key: 'it-review', name: 'IT Security Review',
        step_type: 'APPROVAL', order: 2,
        metadata: { assignee_email: '', instructions: 'Security review required for Admin access.' },
        rules: [
          { condition: 'DEFAULT', next_step_key: 'it-setup', priority: 1 },
        ],
      },
      {
        key: 'it-setup', name: 'IT Setup & Notify',
        step_type: 'NOTIFICATION', order: 3,
        metadata: { notification_channel: 'email', template: 'default', recipient: '' },
        rules: [
          { condition: 'DEFAULT', next_step_key: null, priority: 1 },
        ],
      },
    ],
  },

  // ─── 6. Blank Workflow ────────────────────────────────────────────────────
  {
    key:         'blank',
    name:        'Blank Workflow',
    description: 'Start from scratch — add your own steps and rules',
    category:    'Custom',
    icon:        '✏️',
    input_schema: {},
    start_step_key: '',
    steps: [],
  },
];
