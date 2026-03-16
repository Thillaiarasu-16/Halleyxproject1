export type StepType = 'TASK' | 'APPROVAL' | 'NOTIFICATION';
export type ExecutionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  is_active: boolean;
  input_schema: Record<string, InputField>;
  start_step_id?: string;
  created_at: string;
  updated_at: string;
  steps?: Step[];
  _count?: { steps: number };
}

export interface InputField {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  allowed_values?: string[];
}

export interface Step {
  id: string;
  workflow_id: string;
  name: string;
  step_type: StepType;
  order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  rules?: Rule[];
}

export interface Rule {
  id: string;
  step_id: string;
  condition: string;
  next_step_id: string | null;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: ExecutionStatus;
  data: Record<string, unknown>;
  logs: StepLog[];
  current_step_id?: string;
  retries: number;
  triggered_by?: string;
  started_at: string;
  ended_at?: string;
  workflow?: { name: string };
}

export interface StepLog {
  step_name: string;
  step_type: StepType;
  evaluated_rules: { rule: string; result: boolean; error?: string }[];
  matched_rule: string | null;
  selected_next_step: string | null;
  status: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
