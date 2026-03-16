import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const workflowRouter = Router();

const WorkflowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  input_schema: z.record(z.unknown()).optional(),
  start_step_id: z.string().uuid().optional(),
});

// POST /api/workflows
workflowRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = WorkflowSchema.parse(req.body);
    const workflow = await prisma.workflow.create({ data: { ...body, input_schema: body.input_schema ?? {} } });
    res.status(201).json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Create workflow error', { err });
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// GET /api/workflows
workflowRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '10' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

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

// GET /api/workflows/:id
workflowRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: req.params.id },
      include: { steps: { include: { rules: { orderBy: { priority: 'asc' } } }, orderBy: { order: 'asc' } } },
    });
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (err) {
    logger.error('Get workflow error', { err });
    res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// PUT /api/workflows/:id
workflowRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const body = WorkflowSchema.partial().parse(req.body);
    const existing = await prisma.workflow.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Workflow not found' });

    const workflow = await prisma.workflow.update({
      where: { id: req.params.id },
      data: { ...body, version: existing.version + 1 },
    });
    res.json(workflow);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Update workflow error', { err });
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// DELETE /api/workflows/:id
workflowRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.workflow.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    logger.error('Delete workflow error', { err });
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});
