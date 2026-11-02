import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import routes from './routes/index.js';

export function createApp(): express.Application {
  const app = express();

  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:3000',
    process.env.CLIENT_URL || ''
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true
  }));

  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api', routes);

  // Serve Frontend Static Assets if client/dist exists
  const clientDist = path.resolve(process.cwd(), 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Global 404 handler for API routes
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
  });

  return app;
}
