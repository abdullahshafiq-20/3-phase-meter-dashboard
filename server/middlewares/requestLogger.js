import { logger } from '../common/logger.js';

export const requestLogger = (req, _res, next) => {
  logger.debug(`${req.method} ${req.originalUrl}`);
  next();
};