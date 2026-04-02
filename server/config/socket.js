import { Server } from 'socket.io';
import { config } from './index.js';
import { logger } from '../common/logger.js';

let io = null;

export const socketConfig = {
  init(httpServer) {
    io = new Server(httpServer, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: false,
      },
      transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
      logger.info(`Socket.IO client connected: ${socket.id}`);

      socket.on('subscribe:device', (deviceId) => {
        const room = `device:${deviceId}`;
        socket.join(room);
        logger.info(`Socket ${socket.id} joined room ${room}`);
      });

      socket.on('unsubscribe:device', (deviceId) => {
        const room = `device:${deviceId}`;
        socket.leave(room);
        logger.info(`Socket ${socket.id} left room ${room}`);
      });

      socket.on('subscribe:all', () => {
        socket.join('all-devices');
        logger.info(`Socket ${socket.id} joined room all-devices`);
      });

      socket.on('unsubscribe:all', () => {
        socket.leave('all-devices');
        logger.info(`Socket ${socket.id} left room all-devices`);
      });

      socket.on('disconnect', (reason) => {
        logger.info(`Socket.IO client disconnected: ${socket.id} (${reason})`);
      });
    });

    logger.info('Socket.IO server initialized');
    return io;
  },

  emitLiveReading(deviceId, reading) {
    if (!io) return;
    io.to(`device:${deviceId}`).emit('live:reading', reading);
    io.to('all-devices').emit('live:reading', reading);
  },

  broadcastDeviceStatus(deviceId, status) {
    if (!io) return;
    io.to('all-devices').emit('device:status', { deviceId, ...status });
  },

  emitHistoricalBatch(deviceId, readings) {
    if (!io) return;
    io.to(`device:${deviceId}`).emit('historical:batch', readings);
  },

  broadcast(event, data) {
    if (!io) return;
    io.emit(event, data);
  },

  getIO() {
    return io;
  },
};
