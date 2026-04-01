import { validateCredentials } from '../services/userService.js';
import {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken
} from '../services/tokenService.js';
import { sendSuccess, sendError } from '../common/response.js';

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return sendError(res, 'Username and password are required', 400);
  }

  const user = await validateCredentials(username, password);
  if (!user) {
    return sendError(res, 'Invalid username or password', 401);
  }

  const tokenPayload = { username: user.username, role: user.role };
  const accessToken = issueAccessToken(tokenPayload);
  const refreshToken = issueRefreshToken(tokenPayload);

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: { username: user.username, role: user.role }
  }, 'Login successful');
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendError(res, 'Refresh token is required', 400);
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    // Rotate: revoke old, issue new pair
    revokeRefreshToken(refreshToken);
    const tokenPayload = { username: decoded.username, role: decoded.role };
    const newAccessToken = issueAccessToken(tokenPayload);
    const newRefreshToken = issueRefreshToken(tokenPayload);

    return sendSuccess(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    }, 'Token refreshed');
  } catch {
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    revokeRefreshToken(refreshToken);
  }

  return sendSuccess(res, null, 'Logged out successfully');
};
