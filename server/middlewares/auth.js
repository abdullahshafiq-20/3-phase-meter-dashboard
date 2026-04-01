import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { sendError } from '../common/response.js';
import { logger } from '../common/logger.js';

const bearerToken = (authHeader) => {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
};

export const authenticateAccessToken = (req, res, next) => {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    return sendError(res, 'Unauthorized — missing or malformed Bearer token', 401);
  }
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Unauthorized — access token expired', 401);
    }
    if (err.name === 'JsonWebTokenError') {
      if (config.env !== 'production') {
        logger.debug(
          `JWT verify failed (${err.message}). If you changed JWT_SECRET or restarted with a different .env, log in again — old tokens will not verify.`
        );
      }
      return sendError(
        res,
        'Unauthorized — token invalid or signed with a different secret (log in again after changing JWT_SECRET)',
        401
      );
    }
    return sendError(res, 'Unauthorized — invalid token', 401);
  }
};

export const requireRole = (allowedRoles = []) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return sendError(res, 'Forbidden — insufficient permissions', 403);
  }
  return next();
};
