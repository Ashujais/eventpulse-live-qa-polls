import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from './app.js';
import { initSocketServer } from './socket/index.js';
import { getDb } from './db/index.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

async function bootstrap() {
  try {
    // Initialize database
    console.log('Connecting to database...');
    await getDb();
    console.log('Database schema ready.');

    const app = createApp();
    const server = http.createServer(app);

    // Initialize Socket.IO
    initSocketServer(server, [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);
    console.log('WebSocket engine initialized.');

    server.listen(PORT, () => {
      console.log(`===============================================`);
      console.log(`🚀 EventPulse Backend Server running on port ${PORT}`);
      console.log(`📡 WebSocket ready at ws://localhost:${PORT}`);
      console.log(`🌐 API ready at http://localhost:${PORT}/api`);
      console.log(`===============================================`);
    });
  } catch (error) {
    console.error('Fatal server startup error:', error);
    process.exit(1);
  }
}

bootstrap();
