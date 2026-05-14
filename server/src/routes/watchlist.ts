import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthedRequest } from '../middleware/auth';
import { rebuildPollSet } from '../services/poller';

export const watchlistRouter = Router();
watchlistRouter.use(authMiddleware);

watchlistRouter.get('/', async (req: AuthedRequest, res) => {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.userId! },
    orderBy: [{ sortOrder: 'asc' }, { addedAt: 'asc' }],
  });
  res.json({ success: true, data: items });
});

watchlistRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = z.object({ symbol: z.string().min(1).max(20).toUpperCase() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.message });
  const symbol = parsed.data.symbol;

  // limit
  const count = await prisma.watchlistItem.count({ where: { userId: req.userId! } });
  if (count >= 50) return res.status(400).json({ success: false, error: 'Watchlist limit (50) reached' });

  try {
    const item = await prisma.watchlistItem.create({
      data: { userId: req.userId!, symbol, sortOrder: count },
    });
    rebuildPollSet();
    res.json({ success: true, data: item });
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(409).json({ success: false, error: 'Symbol already in watchlist' });
    throw e;
  }
});

watchlistRouter.delete('/:id', async (req: AuthedRequest, res) => {
  const id = parseInt(req.params.id, 10);
  await prisma.watchlistItem.deleteMany({ where: { id, userId: req.userId! } });
  rebuildPollSet();
  res.json({ success: true });
});

watchlistRouter.post('/reorder', async (req: AuthedRequest, res) => {
  const parsed = z.object({ ids: z.array(z.number()) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.message });
  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.watchlistItem.updateMany({
        where: { id, userId: req.userId! },
        data: { sortOrder: idx },
      })
    )
  );
  res.json({ success: true });
});
