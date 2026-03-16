import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ExecutionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { evaluateRules } from '../services/ruleEngine';
import { logger } from '../utils/logger';

export const executionRouter = Router();

// POST /api/workflows/:workflow_id/execute
executionRouter.post('/workflows/:workflow_id/execute', async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.workflow_id },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } }, orderBy: { order: 'asc' } } },
    });

    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.start_step_id) return res.status(400).json({ error: 'Workflow has no start step defined' });

    const inputData = req.body.data ?? {};

    const execution = await prisma.execution.create({
      data: {
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        status: ExecutionStatus.IN_PROGRESS,
        data: inputData,
        current_step_id: workflow.start_step_id,
        triggered_by: req.body.triggered_by ?? 'anonymous',
        logs: [],
      },
    });

    // Run execution asynchronously (non-blocking response)
    runExecution(execution.id, workflow.id, inputData).catch((err) =>
      logger.error('Execution error', { err, executionId: execution.id })
    );

    res.status(201).json(execution);
  } catch (err) {
    logger.error('Start execution error', { err });
    res.status(500).json({ error: 'Failed to start execution' });
  }
});

// GET /api/executions/:id
executionRouter.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    res.json(execution);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

// GET /api/executions (audit log)
executionRouter.get('/executions', async (_req: Request, res: Response) => {
  try {
    const executions = await prisma.execution.findMany({
      include: { workflow: { select: { name: true } } },
      orderBy: { started_at: 'desc' },
      take: 50,
    });
    res.json(executions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

// POST /api/executions/:id/cancel
executionRouter.post('/executions/:id/cancel', async (req: Request, res: Response) => {
  try {
    const execution = await prisma.execution.update({
      where: { id: req.params.id },
      data: { status: ExecutionStatus.CANCELED, ended_at: new Date() },
    });
    res.json(execution);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel execution' });
  }
});

// ─── Execution engine ────────────────────────────────────────────────────────
async function runExecution(
  executionId: string,
  workflowId: string,
  data: Record<string, unknown>
) {
  const MAX_ITERATIONS = 20;
  let iterations = 0;
  const logs: unknown[] = [];

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } },
  });
  if (!workflow) throw new Error('Workflow not found');

  const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
  let currentStepId: string | null = workflow.start_step_id;

  while (currentStepId && iterations < MAX_ITERATIONS) {
    iterations++;
    const step = stepMap.get(currentStepId);
    if (!step) break;

    const stepStarted = new Date();
    logger.info(`Executing step: ${step.name} (${step.step_type})`);

    await prisma.execution.update({
      where: { id: executionId },
      data: { current_step_id: currentStepId, status: ExecutionStatus.IN_PROGRESS },
    });

    // Evaluate rules to find next step
    const ruleResult = evaluateRules(step.rules, data);
    const stepEnded = new Date();

    const stepLog = {
      step_name: step.name,
      step_type: step.step_type,
      evaluated_rules: ruleResult.evaluated_rules,
      matched_rule: ruleResult.matched_rule,
      selected_next_step: ruleResult.next_step_id
        ? stepMap.get(ruleResult.next_step_id)?.name ?? null
        : null,
      status: 'completed',
      started_at: stepStarted.toISOString(),
      ended_at: stepEnded.toISOString(),
      duration_ms: stepEnded.getTime() - stepStarted.getTime(),
    };

    logs.push(stepLog);
    currentStepId = ruleResult.next_step_id;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status: ExecutionStatus.COMPLETED,
      logs: logs as object[],
      ended_at: new Date(),
      current_step_id: null,
    },
  });

  logger.info(`Execution ${executionId} completed with ${iterations} steps`);
}
