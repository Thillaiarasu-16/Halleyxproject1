import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { StepType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const stepRouter = Router();

const StepSchema = z.object({
  name: z.string().min(1),
  step_type: z.nativeEnum(StepType),
  order: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/workflows/:workflow_id/steps
stepRouter.post('/workflows/:workflow_id/steps', async (req: Request, res: Response) => {
  try {
    const body = StepSchema.parse(req.body);
    const step = await prisma.step.create({
      data: { ...body, workflow_id: req.params.workflow_id, metadata: body.metadata ?? {} },
    });
    res.status(201).json(step);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Create step error', { err });
    res.status(500).json({ error: 'Failed to create step' });
  }
});

// GET /api/workflows/:workflow_id/steps
stepRouter.get('/workflows/:workflow_id/steps', async (req: Request, res: Response) => {
  try {
    const steps = await prisma.step.findMany({
      where: { workflow_id: req.params.workflow_id },
      include: { rules: { orderBy: { priority: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json(steps);
  } catch (err) {
    logger.error('List steps error', { err });
    res.status(500).json({ error: 'Failed to list steps' });
  }
});

// PUT /api/steps/:id
stepRouter.put('/steps/:id', async (req: Request, res: Response) => {
  try {
    const body = StepSchema.partial().parse(req.body);
    const step = await prisma.step.update({
      where: { id: req.params.id },
      data: body,
    });
    res.json(step);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Update step error', { err });
    res.status(500).json({ error: 'Failed to update step' });
  }
});

// DELETE /api/steps/:id
stepRouter.delete('/steps/:id', async (req: Request, res: Response) => {
  try {
    await prisma.step.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    logger.error('Delete step error', { err });
    res.status(500).json({ error: 'Failed to delete step' });
  }
});
