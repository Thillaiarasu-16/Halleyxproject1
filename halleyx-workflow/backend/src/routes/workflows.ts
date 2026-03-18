import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { WORKFLOW_TEMPLATES } from '../services/workflowTemplates';

export const workflowRouter = Router();

// Helper — safely convert any value to Prisma-compatible JSON
const toJson = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v ?? {})) as Prisma.InputJsonValue;

const WorkflowSchema = z.object({
  name:          z.string().min(1),
  description:   z.string().optional(),
  input_schema:  z.record(z.unknown()).optional(),
  start_step_id: z.string().uuid().optional(),
});

// ─── POST /api/workflows ──────────────────────────────────────────────────────
workflowRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body     = WorkflowSchema.parse(req.body);
    const workflow = await prisma.workflow.create({
      data: {
        name:          body.name,
        description:   body.description,
        input_schema:  toJson(body.input_schema),
        start_step_id: body.start_step_id,
      },
    });
    res.status(201).json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Create workflow error', { err });
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// ─── GET /api/workflows ───────────────────────────────────────────────────────
workflowRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '10' } = req.query;
    const skip  = (Number(page) - 1) * Number(limit);
    const where = search
      ? { name: { contains: String(search), mode: 'insensitive' as const } }
      : {};

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        skip,
        take: Number(limit),
        include: { _count: { select: { steps: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.workflow.count({ where }),
    ]);

    res.json({ data: workflows, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    logger.error('List workflows error', { err });
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// ─── GET /api/workflows/templates ────────────────────────────────────────────
workflowRouter.get('/templates', (_req: Request, res: Response) => {
  res.json(
    WORKFLOW_TEMPLATES.map(({ key, name, description, category, icon, steps }) => ({
      key, name, description, category, icon, step_count: steps.length,
    }))
  );
});

// ─── POST /api/workflows/from-template ───────────────────────────────────────
workflowRouter.post('/from-template', async (req: Request, res: Response) => {
  try {
    const {
      template_key,
      name,
      description,
      assignee_emails  = {},
      recipient_emails = {},
    } = req.body;

    const template = WORKFLOW_TEMPLATES.find(t => t.key === template_key);
    if (!template) return res.status(400).json({ error: `Template "${template_key}" not found` });

    // 1. Create workflow
    const workflow = await prisma.workflow.create({
      data: {
        name:         name        || template.name,
        description:  description || template.description,
        input_schema: toJson(template.input_schema),
        is_active:    true,
      },
    });

    if (template.steps.length === 0) return res.status(201).json(workflow);

    // 2. Create steps
    const stepKeyToId = new Map<string, string>();

    for (const tStep of template.steps) {
      const meta: Record<string, unknown> = { ...tStep.metadata };
      if (tStep.step_type === 'APPROVAL'     && assignee_emails[tStep.key])  meta.assignee_email = assignee_emails[tStep.key];
      if (tStep.step_type === 'NOTIFICATION' && recipient_emails[tStep.key]) meta.recipient       = recipient_emails[tStep.key];

      const step = await prisma.step.create({
        data: {
          workflow_id: workflow.id,
          name:        tStep.name,
          step_type:   tStep.step_type,
          order:       tStep.order,
          metadata:    toJson(meta),
        },
      });
      stepKeyToId.set(tStep.key, step.id);
    }

    // 3. Create rules
    for (const tStep of template.steps) {
      const stepId = stepKeyToId.get(tStep.key)!;
      for (const rule of tStep.rules) {
        await prisma.rule.create({
          data: {
            step_id:      stepId,
            condition:    rule.condition,
            next_step_id: rule.next_step_key ? (stepKeyToId.get(rule.next_step_key) ?? null) : null,
            priority:     rule.priority,
          },
        });
      }
    }

    // 4. Set start step
    const startStepId = template.start_step_key
      ? (stepKeyToId.get(template.start_step_key) ?? null)
      : null;

    const finalWorkflow = await prisma.workflow.update({
      where:   { id: workflow.id },
      data:    { start_step_id: startStepId },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } }, orderBy: { order: 'asc' } } },
    });

    logger.info(`Workflow created from template "${template_key}": ${workflow.id}`);
    res.status(201).json(finalWorkflow);
  } catch (err) {
    logger.error('Create from template error', { err });
    res.status(500).json({ error: 'Failed to create workflow from template' });
  }
});

// ─── GET /api/workflows/:id ───────────────────────────────────────────────────
workflowRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where:   { id: req.params.id },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } }, orderBy: { order: 'asc' } } },
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    logger.error('Get workflow error', { err });
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// ─── PUT /api/workflows/:id ───────────────────────────────────────────────────
workflowRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const body     = WorkflowSchema.partial().parse(req.body);
    const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });

    const workflow = await prisma.workflow.update({
      where: { id: req.params.id },
      data:  {
        name:          body.name,
        description:   body.description,
        start_step_id: body.start_step_id,
        ...(body.input_schema ? { input_schema: toJson(body.input_schema) } : {}),
        version:       existing.version + 1,
      },
    });
    res.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Update workflow error', { err });
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// ─── DELETE /api/workflows/:id ────────────────────────────────────────────────
workflowRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    logger.error('Delete workflow error', { err });
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});
