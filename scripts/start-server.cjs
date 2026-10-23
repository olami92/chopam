const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const appRoot = process.cwd();
const serverBundle = path.join(appRoot, 'dist', 'server.cjs');
const webBundle = path.join(appRoot, 'dist', 'index.html');

if (!fs.existsSync(serverBundle) || !fs.existsSync(webBundle)) {
  console.log('[startup] Build output is missing; building the app before startup.');
  const result = spawnSync('npm', ['run', 'build'], { cwd: appRoot, stdio: 'inherit' });
  if (result.error) {
    console.error('[startup] Could not run the build command:', result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(serverBundle)) {
  console.error(`[startup] Build did not create ${serverBundle}`);
  process.exit(1);
}

require(serverBundle);
