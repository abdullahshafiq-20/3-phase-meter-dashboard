import http from 'node:http';
import path from 'node:path'
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { hivemqClient } from './config/hivemq.js';
import { socketConfig } from './config/socket.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { authenticateAccessToken } from './middlewares/auth.js';
import authRoutes from './routes/authRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import dataRoutes from './routes/dataRoutes.js';
import insightRoutes from './routes/insightRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { liveDataService } from './services/liveDataService.js';
import { logger } from './common/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await hivemqClient.connect();

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
app.use('/alerts', alertRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);

socketConfig.init(server);

liveDataService.subscribeHistorical();

server.listen(config.port, () => {
  logger.info(`Server listening on http://localhost:${config.port}`);
  logger.info('Waiting for MQTT data from meter simulators...');
});
