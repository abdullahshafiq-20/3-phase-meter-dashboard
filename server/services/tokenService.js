import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

const refreshStore = new Map();
const revokedRefresh = new Set();

export const issueAccessToken = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpiry });

export const issueRefreshToken = (payload) => {
  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ ...payload, tokenType: 'refresh', jti }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiry
  });
  refreshStore.set(jti, { username: payload.username });
  return refreshToken;
};

export const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (decoded.tokenType !== 'refresh' || !decoded.jti) {
    throw new Error('Invalid refresh token');
  }
  if (!refreshStore.has(decoded.jti) || revokedRefresh.has(decoded.jti)) {
    throw new Error('Refresh token revoked');
  }
  return decoded;
};

export const revokeRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded.jti) {
      revokedRefresh.add(decoded.jti);
      refreshStore.delete(decoded.jti);
    }
  } catch {
  }
};

export const isRefreshTokenActive = (jti) => {
  if (!jti) return false;
  return refreshStore.has(jti) && !revokedRefresh.has(jti);
};
