import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { authenticate, optionalAuth, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { AnalysisService } from '../services/AnalysisService';
import { UsageService } from '../services/UsageService';
import { CVService } from '../services/CVService';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const analyzeSchema = z.object({
  fen: z.string().min(10),
  topMoves: z.array(z.any()),
});

// Save a completed analysis
router.post('/', authenticate, validate(analyzeSchema), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const canAnalyze = await UsageService.canAnalyze(req.userId);
    if (!canAnalyze) {
      return res.status(403).json({
        success: false,
        error: 'Daily analysis limit reached. Upgrade to Pro for unlimited analyses.',
      });
    }

    // Check cache first
    const cached = await AnalysisService.findCached(req.body.fen);
    if (cached) {
      // Still count toward usage but return cached result
      await UsageService.increment(req.userId);
      return res.json({ success: true, data: { ...cached, cached: true } });
    }

    const analysis = await AnalysisService.save({
      userId: req.userId,
      fen: req.body.fen,
      topMoves: req.body.topMoves,
    });

    await UsageService.increment(req.userId);

    return res.status(201).json({ success: true, data: analysis });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Detect position from image (CV pipeline)
router.post(
  '/detect-position',
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image provided' });
      }

      const result = await CVService.detectPosition(req.file.buffer);

      return res.json({
        success: true,
        data: {
          fen: result.fen,
          confidence: result.confidence,
          squareConfidences: result.squareConfidences,
          lowConfidenceSquares: result.lowConfidenceSquares,
          needsReview: result.needsReview,
          validationErrors: result.validationErrors,
          processingTimeMs: result.processingTimeMs,
        },
      });
    } catch (error) {
      console.error('CV detection error:', error);
      const message = error instanceof Error ? error.message : 'Detection failed';
      return res.status(500).json({ success: false, error: message });
    }
  },
);

// Get analysis by ID
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const analysis = await AnalysisService.getById(req.params.id);
    if (!analysis) {
      return res.status(404).json({ success: false, error: 'Analysis not found' });
    }

    return res.json({ success: true, data: analysis });
  } catch (error) {
    console.error('Get analysis error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user's analysis history
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const result = await AnalysisService.getUserHistory(req.userId, page, limit);

    return res.json({
      success: true,
      data: result.analyses,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
