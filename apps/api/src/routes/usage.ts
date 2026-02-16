import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { UsageService } from '../services/UsageService';

const router = Router();

router.get('/today', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const usageInfo = await UsageService.getUsageInfo(req.userId);
    return res.json({ success: true, data: usageInfo });
  } catch (error) {
    console.error('Usage error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/can-analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const canAnalyze = await UsageService.canAnalyze(req.userId);
    return res.json({ success: true, data: { canAnalyze } });
  } catch (error) {
    console.error('Can analyze error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
