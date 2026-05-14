import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

settingsRouter.get('/', async (_req, res) => {
  const rows = await prisma.appSetting.findMany();
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value;
  res.json({ success: true, data: obj });
});

settingsRouter.put('/', async (req, res) => {
  const parsed = z.record(z.string()).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.message });
  await prisma.$transaction(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  );
  res.json({ success: true });
});
