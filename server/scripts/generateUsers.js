import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const viewerHash = await bcrypt.hash('viewer123', 10);

  const config = {
    users: [
      { username: 'admin', passwordHash: adminHash, role: 'admin' },
      { username: 'viewer1', passwordHash: viewerHash, role: 'viewer' },
      { username: 'viewer2', passwordHash: viewerHash, role: 'viewer' }
    ]
  };

  const outPath = path.resolve(__dirname, '..', 'users.config.json');
  fs.writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n');
  console.log('Written to', outPath);
  console.log(JSON.stringify(config, null, 2));
}

main();
