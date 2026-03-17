import { Router, Response } from 'express';
import { ExecutionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { evaluateRules } from '../services/ruleEngine';
import { handleNotificationStep, sendApprovalRequestEmail, sendApprovalDecisionEmail } from '../services/notificationService';
import { publishMessage, QUEUES } from '../services/rabbitMQ';
import { logger } from '../utils/logger';
import { requireAuth, AuthRequest } from '../middleware/auth';

export const executionRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeLogs(raw: unknown): object[] {
  if (!raw) return [];
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return []; } }
  if (Array.isArray(raw)) return raw as object[];
  return [];
}

// ─── POST /api/workflows/:workflow_id/execute ─────────────────────────────────
executionRouter.post('/workflows/:workflow_id/execute', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.workflow_id },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } }, orderBy: { order: 'asc' } } },
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.start_step_id) return res.status(400).json({ error: 'Workflow has no start step' });

    const user      = req.user!;
    const inputData = req.body.data ?? {};

    const execution = await prisma.execution.create({
      data: {
        workflow_id: workflow.id,
        workflow_version: workflow.version,
        request_version: 1,
        status: ExecutionStatus.IN_PROGRESS,
        data: inputData,
        current_step_id: workflow.start_step_id,
        triggered_by: user.id,
        triggered_by_id: user.id,
        logs: [],
      },
    });

    // Publish step execution to RabbitMQ — falls back to direct if unavailable
    const published = await publishMessage(QUEUES.EXECUTE_STEP, {
      executionId:  execution.id,
      workflowId:   workflow.id,
      fromStepId:   null,
      data:         inputData,
      existingLogs: [],
    });

    if (!published) {
      // RabbitMQ unavailable — run directly
      resumeExecutionFromQueue(execution.id, workflow.id, null, inputData, [])
        .catch((err) => logger.error('Direct execution error', { err }));
    }

    res.status(201).json(execution);
  } catch (err) {
    logger.error('Start execution error', { err });
    res.status(500).json({ error: 'Failed to start execution' });
  }
});

// ─── POST /api/executions/:id/resubmit ───────────────────────────────────────
executionRouter.post('/executions/:id/resubmit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const original = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!original) return res.status(404).json({ error: 'Execution not found' });
    if (original.status !== ExecutionStatus.FAILED) return res.status(400).json({ error: 'Only failed executions can be resubmitted' });
    if (original.triggered_by_id !== req.user!.id) return res.status(403).json({ error: 'You can only resubmit your own requests' });

    const workflow = await prisma.workflow.findUnique({
      where: { id: original.workflow_id },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } },
    });
    if (!workflow?.start_step_id) return res.status(400).json({ error: 'Workflow not found' });

    const newData = req.body.data ?? original.data;

    const newExecution = await prisma.execution.create({
      data: {
        workflow_id:      original.workflow_id,
        workflow_version: original.workflow_version,
        request_version:  original.request_version + 1,
        status:           ExecutionStatus.IN_PROGRESS,
        data:             newData as object,
        current_step_id:  workflow.start_step_id,
        triggered_by:     original.triggered_by,
        triggered_by_id:  original.triggered_by_id,
        parent_id:        original.parent_id ?? original.id,
        logs:             [],
      },
    });

    const published = await publishMessage(QUEUES.EXECUTE_STEP, {
      executionId:  newExecution.id,
      workflowId:   workflow.id,
      fromStepId:   null,
      data:         newData as Record<string, unknown>,
      existingLogs: [],
    });

    if (!published) {
      resumeExecutionFromQueue(newExecution.id, workflow.id, null, newData as Record<string, unknown>, [])
        .catch((err) => logger.error('Direct resubmit error', { err }));
    }

    res.status(201).json(newExecution);
  } catch (err) {
    logger.error('Resubmit error', { err });
    res.status(500).json({ error: 'Failed to resubmit' });
  }
});

// ─── GET /api/executions ──────────────────────────────────────────────────────
executionRouter.get('/executions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const where = req.user!.role === 'EMPLOYEE' ? { triggered_by_id: req.user!.id } : {};
    const executions = await prisma.execution.findMany({
      where,
      include: {
        workflow: { select: { name: true } },
        user:     { select: { name: true, email: true, role: true } },
      },
      orderBy: { started_at: 'desc' },
      take: 100,
    });
    res.json(executions.map(e => ({ ...e, logs: normalizeLogs(e.logs) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

// ─── GET /api/executions/:id ──────────────────────────────────────────────────
executionRouter.get('/executions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const execution = await prisma.execution.findUnique({
      where: { id: req.params.id },
      include: {
        workflow: { select: { name: true } },
        user:     { select: { name: true, email: true, role: true } },
      },
    });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    if (req.user!.role === 'EMPLOYEE' && execution.triggered_by_id !== req.user!.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ ...execution, logs: normalizeLogs(execution.logs) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

// ─── POST /api/executions/:id/cancel ─────────────────────────────────────────
executionRouter.post('/executions/:id/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const execution = await prisma.execution.update({
      where: { id: req.params.id },
      data: { status: ExecutionStatus.CANCELED, ended_at: new Date() },
    });
    res.json(execution);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ─── POST /api/executions/:id/approve ────────────────────────────────────────
executionRouter.post('/executions/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.status !== ExecutionStatus.PENDING) return res.status(400).json({ error: 'Not awaiting approval' });

    const approver = req.body.approver ?? req.user!.id;
    const comment  = req.body.comment  ?? '';

    const logs    = normalizeLogs(execution.logs);
    const lastLog = logs[logs.length - 1] as Record<string, unknown> | undefined;
    if (lastLog) {
      lastLog.approval_action  = 'approved';
      lastLog.approver         = approver;
      lastLog.approval_comment = comment;
      lastLog.approved_at      = new Date().toISOString();
    }

    await prisma.execution.update({
      where: { id: execution.id },
      data: { status: ExecutionStatus.IN_PROGRESS, logs: logs as object[] },
    });

    // Resume via RabbitMQ or directly
    const published = await publishMessage(QUEUES.EXECUTE_STEP, {
      executionId:  execution.id,
      workflowId:   execution.workflow_id,
      fromStepId:   execution.current_step_id,
      data:         execution.data as Record<string, unknown>,
      existingLogs: logs,
    });

    if (!published) {
      resumeExecutionFromQueue(
        execution.id, execution.workflow_id,
        execution.current_step_id,
        execution.data as Record<string, unknown>,
        logs
      ).catch((err) => logger.error('Resume error', { err }));
    }

    // Send decision email via RabbitMQ queue
    const fullExec = await prisma.execution.findUnique({
      where: { id: execution.id },
      include: {
        user:     { select: { name: true, email: true } },
        workflow: { select: { name: true } },
      },
    });
    if (fullExec?.user?.email) {
      const notifPublished = await publishMessage(QUEUES.DECISION_NOTIFY, {
        to:             fullExec.user.email,
        requesterName:  fullExec.user.name ?? 'Requester',
        approverName:   approver,
        action:         'approved',
        workflowName:   fullExec.workflow?.name ?? '',
        stepName:       (lastLog?.step_name as string) ?? 'Approval',
        executionId:    execution.id,
        requestVersion: fullExec.request_version ?? 1,
        comment,
        data:           fullExec.data as Record<string, unknown>,
      });
      if (!notifPublished) {
        sendApprovalDecisionEmail({
          to: fullExec.user.email,
          requesterName: fullExec.user.name ?? 'Requester',
          approverName: approver,
          action: 'approved',
          workflowName: fullExec.workflow?.name ?? '',
          stepName: (lastLog?.step_name as string) ?? 'Approval',
          executionId: execution.id,
          requestVersion: fullExec.request_version ?? 1,
          comment,
          data: fullExec.data as Record<string, unknown>,
        }).catch((e: unknown) => logger.error('Approval email error', { e }));
      }
    }

    res.json({ message: 'Approved — execution resumed' });
  } catch (err) {
    logger.error('Approve error', { err });
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// ─── POST /api/executions/:id/reject ─────────────────────────────────────────
executionRouter.post('/executions/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const execution = await prisma.execution.findUnique({ where: { id: req.params.id } });
    if (!execution) return res.status(404).json({ error: 'Execution not found' });
    if (execution.status !== ExecutionStatus.PENDING) return res.status(400).json({ error: 'Not awaiting approval' });

    const approver = req.body.approver ?? req.user!.id;
    const comment  = req.body.comment  ?? '';

    const logs    = normalizeLogs(execution.logs);
    const lastLog = logs[logs.length - 1] as Record<string, unknown> | undefined;
    if (lastLog) {
      lastLog.approval_action  = 'rejected';
      lastLog.approver         = approver;
      lastLog.approval_comment = comment;
      lastLog.rejected_at      = new Date().toISOString();
      lastLog.status           = 'rejected';
    }

    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status:         ExecutionStatus.FAILED,
        rejection_note: comment,
        logs:           logs as object[],
        ended_at:       new Date(),
        current_step_id: null,
      },
    });

    // Send rejection email via RabbitMQ queue
    const fullExec = await prisma.execution.findUnique({
      where: { id: execution.id },
      include: {
        user:     { select: { name: true, email: true } },
        workflow: { select: { name: true } },
      },
    });
    if (fullExec?.user?.email) {
      const notifPublished = await publishMessage(QUEUES.DECISION_NOTIFY, {
        to:             fullExec.user.email,
        requesterName:  fullExec.user.name ?? 'Requester',
        approverName:   approver,
        action:         'rejected',
        workflowName:   fullExec.workflow?.name ?? '',
        stepName:       (lastLog?.step_name as string) ?? 'Approval',
        executionId:    execution.id,
        requestVersion: fullExec.request_version ?? 1,
        comment,
        data:           fullExec.data as Record<string, unknown>,
      });
      if (!notifPublished) {
        sendApprovalDecisionEmail({
          to: fullExec.user.email,
          requesterName: fullExec.user.name ?? 'Requester',
          approverName: approver,
          action: 'rejected',
          workflowName: fullExec.workflow?.name ?? '',
          stepName: (lastLog?.step_name as string) ?? 'Approval',
          executionId: execution.id,
          requestVersion: fullExec.request_version ?? 1,
          comment,
          data: fullExec.data as Record<string, unknown>,
        }).catch((e: unknown) => logger.error('Rejection email error', { e }));
      }
    }

    res.json({ message: 'Rejected — execution ended' });
  } catch (err) {
    logger.error('Reject error', { err });
    res.status(500).json({ error: 'Failed to reject' });
  }
});

// ─── Execution engine (exported so index.ts can wire it to RabbitMQ consumer) ─
export async function resumeExecutionFromQueue(
  executionId: string,
  workflowId:  string,
  fromStepId:  string | null,
  data:        Record<string, unknown>,
  existingLogs: unknown[]
): Promise<void> {
  const MAX_ITERATIONS = 20;
  let   iterations     = 0;
  const logs: unknown[] = [...existingLogs];

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } } } },
  });
  if (!workflow) throw new Error('Workflow not found');

  const stepMap        = new Map(workflow.steps.map((s) => [s.id, s]));
  let   currentStepId: string | null = fromStepId ?? workflow.start_step_id;

  // After approval, evaluate the approval step's rules to get next step
  if (fromStepId) {
    const approvalStep = stepMap.get(fromStepId);
    if (approvalStep) {
      currentStepId = evaluateRules(approvalStep.rules, data).next_step_id;
    }
  }

  while (currentStepId && iterations < MAX_ITERATIONS) {
    iterations++;
    const step = stepMap.get(currentStepId);
    if (!step) break;

    const stepStarted = new Date();
    logger.info(`Executing step: ${step.name} (${step.step_type})`);

    await prisma.execution.update({
      where: { id: executionId },
      data:  { current_step_id: currentStepId, status: ExecutionStatus.IN_PROGRESS },
    });

    // ── APPROVAL: pause and wait ──────────────────────────────────────────────
    if (step.step_type === 'APPROVAL') {
      const meta = step.metadata as Record<string, unknown>;
      logs.push({
        step_name:         step.name,
        step_type:         step.step_type,
        evaluated_rules:   [],
        matched_rule:      null,
        selected_next_step: null,
        status:            'awaiting_approval',
        assignee_email:    meta?.assignee_email ?? null,
        instructions:      meta?.instructions   ?? null,
        started_at:        stepStarted.toISOString(),
        ended_at:          null,
        duration_ms:       null,
        approval_action:   null,
        approver:          null,
        approval_comment:  null,
      });

      await prisma.execution.update({
        where: { id: executionId },
        data:  { status: ExecutionStatus.PENDING, logs: logs as object[], current_step_id: currentStepId },
      });

      logger.info(`Execution ${executionId} paused at: ${step.name}`);

      // Notify approver via RabbitMQ or directly
      const assigneeEmail = meta?.assignee_email as string | null;
      if (assigneeEmail) {
        const execRecord = await prisma.execution.findUnique({
          where: { id: executionId },
          include: {
            user:     { select: { name: true } },
            workflow: { select: { name: true } },
          },
        });

        const notifMsg = {
          to:             assigneeEmail,
          approverName:   assigneeEmail,
          requesterName:  execRecord?.user?.name ?? 'An employee',
          workflowName:   execRecord?.workflow?.name ?? workflowId,
          stepName:       step.name,
          executionId,
          requestVersion: execRecord?.request_version ?? 1,
          data,
        };

        const published = await publishMessage(QUEUES.APPROVAL_NOTIFY, notifMsg);
        if (!published) {
          sendApprovalRequestEmail(notifMsg)
            .catch((e: unknown) => logger.error('Approval notify email failed', { e }));
        }
      }
      return;
    }

    // ── NOTIFICATION: send email and continue ─────────────────────────────────
    if (step.step_type === 'NOTIFICATION') {
      const meta         = step.metadata as Record<string, unknown>;
      const workflowRec  = await prisma.workflow.findUnique({ where: { id: workflowId }, select: { name: true } });
      const notifResult  = await handleNotificationStep(meta, data, step.name, workflowRec?.name ?? 'Workflow', executionId);
      const ruleResult   = evaluateRules(step.rules, data);
      const stepEnded    = new Date();

      logs.push({
        step_name:              step.name,
        step_type:              step.step_type,
        evaluated_rules:        ruleResult.evaluated_rules,
        matched_rule:           ruleResult.matched_rule,
        selected_next_step:     ruleResult.next_step_id ? stepMap.get(ruleResult.next_step_id)?.name ?? null : null,
        status:                 notifResult.success ? 'completed' : 'failed',
        notification_sent:      notifResult.success,
        notification_channel:   notifResult.channel,
        notification_recipient: notifResult.recipient,
        preview_url:            notifResult.preview_url ?? null,
        started_at:             stepStarted.toISOString(),
        ended_at:               stepEnded.toISOString(),
        duration_ms:            stepEnded.getTime() - stepStarted.getTime(),
      });

      currentStepId = ruleResult.next_step_id;
      continue;
    }

    // ── TASK: evaluate rules and continue ─────────────────────────────────────
    const ruleResult = evaluateRules(step.rules, data);
    const stepEnded  = new Date();

    logs.push({
      step_name:          step.name,
      step_type:          step.step_type,
      evaluated_rules:    ruleResult.evaluated_rules,
      matched_rule:       ruleResult.matched_rule,
      selected_next_step: ruleResult.next_step_id ? stepMap.get(ruleResult.next_step_id)?.name ?? null : null,
      status:             'completed',
      started_at:         stepStarted.toISOString(),
      ended_at:           stepEnded.toISOString(),
      duration_ms:        stepEnded.getTime() - stepStarted.getTime(),
    });

    currentStepId = ruleResult.next_step_id;
  }

  await prisma.execution.update({
    where: { id: executionId },
    data:  { status: ExecutionStatus.COMPLETED, logs: logs as object[], ended_at: new Date(), current_step_id: null },
  });

  logger.info(`Execution ${executionId} completed in ${iterations} steps`);
}
