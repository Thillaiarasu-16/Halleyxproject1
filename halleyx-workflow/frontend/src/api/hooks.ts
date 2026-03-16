import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './client';
import type { Workflow, Step, Rule, Execution, PaginatedResponse } from '../types';

// ─── Workflows ───────────────────────────────────────────────────────────────
export const useWorkflows = (search?: string, page = 1) =>
  useQuery<PaginatedResponse<Workflow>>({
    queryKey: ['workflows', search, page],
    queryFn: () =>
      api.get('/workflows', { params: { search, page, limit: 10 } }).then((r) => r.data),
  });

export const useWorkflow = (id?: string) =>
  useQuery<Workflow>({
    queryKey: ['workflow', id],
    queryFn: () => api.get(`/workflows/${id}`).then((r) => r.data),
    enabled: !!id,
  });

export const useCreateWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Workflow>) => api.post('/workflows', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
};

export const useUpdateWorkflow = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Workflow>) =>
      api.put(`/workflows/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
};

export const useDeleteWorkflow = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workflows/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
};

// ─── Steps ───────────────────────────────────────────────────────────────────
export const useSteps = (workflowId?: string) =>
  useQuery<Step[]>({
    queryKey: ['steps', workflowId],
    queryFn: () => api.get(`/workflows/${workflowId}/steps`).then((r) => r.data),
    enabled: !!workflowId,
  });

export const useCreateStep = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Step>) =>
      api.post(`/workflows/${workflowId}/steps`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['steps', workflowId] });
      qc.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
  });
};

export const useUpdateStep = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Step> & { id: string }) =>
      api.put(`/steps/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  });
};

export const useDeleteStep = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/steps/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  });
};

// ─── Rules ───────────────────────────────────────────────────────────────────
export const useRules = (stepId?: string) =>
  useQuery<Rule[]>({
    queryKey: ['rules', stepId],
    queryFn: () => api.get(`/steps/${stepId}/rules`).then((r) => r.data),
    enabled: !!stepId,
  });

export const useCreateRule = (stepId: string, workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Rule>) =>
      api.post(`/steps/${stepId}/rules`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules', stepId] });
      qc.invalidateQueries({ queryKey: ['steps', workflowId] });
    },
  });
};

export const useUpdateRule = (stepId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Rule> & { id: string }) =>
      api.put(`/rules/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', stepId] }),
  });
};

export const useDeleteRule = (stepId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/rules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules', stepId] }),
  });
};

// ─── Executions ──────────────────────────────────────────────────────────────
export const useExecution = (id?: string) =>
  useQuery<Execution>({
    queryKey: ['execution', id],
    queryFn: () => api.get(`/executions/${id}`).then((r) => r.data),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data?.status === 'IN_PROGRESS' || q.state.data?.status === 'PENDING'
        ? 2000
        : false,
  });

export const useExecutions = () =>
  useQuery<Execution[]>({
    queryKey: ['executions'],
    queryFn: () => api.get('/executions').then((r) => r.data),
  });

export const useStartExecution = (workflowId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { data: Record<string, unknown>; triggered_by?: string }) =>
      api.post(`/workflows/${workflowId}/execute`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }),
  });
};

export const useCancelExecution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/executions/${id}/cancel`).then((r) => r.data),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['execution', id] }),
  });
};
