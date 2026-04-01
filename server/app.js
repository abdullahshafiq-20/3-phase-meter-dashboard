import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { config } from './config/index.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { authenticateAccessToken } from './middlewares/auth.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import insightRoutes from './routes/insightRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { liveDataService } from './services/liveDataService.js';
import { csvDataService } from './services/csvDataService.js';
import { logger } from './common/logger.js';

await csvDataService.initialize();

const app = express();
app.use(
  cors({
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
  })
);
app.use(express.json());
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use(authenticateAccessToken);
app.use('/devices', deviceRoutes);
app.use('/data', dataRoutes);
app.use('/insights', insightRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const match = request.url?.match(/^\/data\/([^/]+)\/live\/stream$/);
  if (!match) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const deviceId = decodeURIComponent(match[1]);
    liveDataService.attachClient(ws, deviceId);
  });
});

server.listen(config.port, () => {
  logger.info(`Server listening on http://localhost:${config.port}`);
});
