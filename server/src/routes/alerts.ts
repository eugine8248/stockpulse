import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthedRequest } from '../middleware/auth';

export const alertsRouter = Router();
alertsRouter.use(authMiddleware);

const alertSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  type: z.enum(['price_above', 'price_below', 'pct_change_above', 'pct_change_below']),
  threshold: z.number(),
  enabled: z.boolean().optional(),
  notifyChannels: z.array(z.enum(['in_app', 'browser'])).optional(),
});

alertsRouter.get('/', async (req: AuthedRequest, res) => {
  const items = await prisma.alert.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

alertsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = alertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.message });
  const { notifyChannels, ...rest } = parsed.data;
  const item = await prisma.alert.create({
    data: {
      userId: req.userId!,
      ...rest,
      notifyChannels: JSON.stringify(notifyChannels ?? ['in_app']),
    },
  });
  res.json({ success: true, data: item });
});

alertsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  const parsed = alertSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.message });
  const { notifyChannels, ...rest } = parsed.data;
  const data: any = rest;
  if (notifyChannels) data.notifyChannels = JSON.stringify(notifyChannels);
  const updated = await prisma.alert.updateMany({
    where: { id, userId: req.userId! },
    data,
  });
  if (!updated.count) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true });
});

alertsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  await prisma.alert.deleteMany({ where: { id, userId: req.userId! } });
  res.json({ success: true });
});

alertsRouter.get('/events', async (req: AuthedRequest, res) => {
  const events = await prisma.alertEvent.findMany({
    where: { alert: { userId: req.userId! } },
    include: { alert: true },
    orderBy: { triggeredAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: events });
});
