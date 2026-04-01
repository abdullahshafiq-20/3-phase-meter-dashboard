import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

let cachedUsers = [];

export const initializeUsers = async () => {
  const raw = await fs.readFile(config.usersConfigPath, 'utf-8');
  const parsed = JSON.parse(raw);
  cachedUsers = parsed.users || [];
};

const ensureInitialized = async () => {
  if (!cachedUsers.length) await initializeUsers();
};

export const validateCredentials = async (username, password) => {
  await ensureInitialized();
  const user = cachedUsers.find((entry) => entry.username === username);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { username: user.username, role: user.role };
};

export const getSanitizedUsers = async () => {
  await ensureInitialized();
  return cachedUsers.map((user) => ({
    username: user.username,
    role: user.role
  }));
};
