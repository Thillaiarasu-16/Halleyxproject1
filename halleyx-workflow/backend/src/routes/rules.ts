import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const ruleRouter = Router();

const RuleSchema = z.object({
  condition: z.string().min(1),
  next_step_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1),
});

// POST /api/steps/:step_id/rules
ruleRouter.post('/steps/:step_id/rules', async (req: Request, res: Response) => {
  try {
    const body = RuleSchema.parse(req.body);
    const rule = await prisma.rule.create({
      data: { ...body, step_id: req.params.step_id },
    });
    res.status(201).json(rule);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Create rule error', { err });
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// GET /api/steps/:step_id/rules
ruleRouter.get('/steps/:step_id/rules', async (req: Request, res: Response) => {
  try {
    const rules = await prisma.rule.findMany({
      where: { step_id: req.params.step_id },
      orderBy: { priority: 'asc' },
    });
    res.json(rules);
  } catch (err) {
    logger.error('List rules error', { err });
    res.status(500).json({ error: 'Failed to list rules' });
  }
});

// PUT /api/rules/:id
ruleRouter.put('/rules/:id', async (req: Request, res: Response) => {
  try {
    const body = RuleSchema.partial().parse(req.body);
    const rule = await prisma.rule.update({ where: { id: req.params.id }, data: body });
    res.json(rule);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    logger.error('Update rule error', { err });
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// DELETE /api/rules/:id
ruleRouter.delete('/rules/:id', async (req: Request, res: Response) => {
  try {
    await prisma.rule.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    logger.error('Delete rule error', { err });
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});
