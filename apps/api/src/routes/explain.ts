import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AIService } from '../services/AIService';

const router = Router();

const explainSchema = z.object({
  fen: z.string().min(10),
  turn: z.enum(['w', 'b']),
  moves: z.array(
    z.object({
      san: z.string(),
      uci: z.string(),
      score: z.number(),
      mate: z.number().optional(),
      pv: z.array(z.string()),
      rank: z.number(),
    }),
  ),
});

router.post('/', authenticate, validate(explainSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Only Pro users get AI explanations
    if (req.userTier !== 'PRO') {
      return res.status(403).json({
        success: false,
        error: 'AI explanations are a Pro feature. Upgrade to unlock.',
        requiresUpgrade: true,
      });
    }

    const { fen, turn, moves } = req.body;

    const result = await AIService.explainMoves(fen, moves, turn);

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Explain error:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate explanations' });
  }
});

export default router;
