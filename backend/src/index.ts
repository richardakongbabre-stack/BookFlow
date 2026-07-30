import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import router from './routes';
import { PORT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from './config';

const app = express();

// 1. Basic security middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // For development, allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-provider-slug'],
}));
app.use(express.json());

// 2. Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes',
  },
});
app.use('/api', limiter);

// 3. Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 4. Mount API Routes
app.use('/api', router);

// 5. Global 404 Route handler
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// 6. Global Catch-all Error Handling Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[UNHANDLED EXCEPTION]', err);

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

// 7. Start Express Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` BookFlow Backend API running on port ${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`=========================================`);
});
