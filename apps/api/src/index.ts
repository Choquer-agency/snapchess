import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import authRoutes from './routes/auth';
import analysisRoutes from './routes/analysis';
import usageRoutes from './routes/usage';
import subscriptionRoutes from './routes/subscription';
import explainRoutes from './routes/explain';
import webhookRoutes from './routes/webhooks';

const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, health checks)
      if (!origin) return callback(null, true);
      const allowed = env.FRONTEND_URL.split(',').map((u) => u.trim());
      if (allowed.includes(origin) || env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }),
);

// Stripe webhooks need raw body — register BEFORE json parser
app.use('/api/v1/webhooks', webhookRoutes);

// Rate limiting
app.use(
  '/api/v1/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Too many requests, try again later' },
  }),
);

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/analysis', analysisRoutes);
app.use('/api/v1/usage', usageRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/explain', explainRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(env.PORT, () => {
  console.log(`SnapChess API running on port ${env.PORT}`);
});

export default app;
