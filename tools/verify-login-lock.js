const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const lockFilePath = path.join(repoRoot, 'login-flow.lock.json');
const bypass = String(process.env.HUSH_SKIP_LOGIN_LOCK || '').trim() === '1';

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function fail(message) {
  console.error(`\n[login-lock] ${message}`);
  console.error('[login-lock] If this change is intentional, run: npm run lock:refresh-login-flow');
  console.error('[login-lock] Temporary bypass: set HUSH_SKIP_LOGIN_LOCK=1');
  process.exit(1);
}

function main() {
  if (bypass) {
    console.warn('[login-lock] Bypassed with HUSH_SKIP_LOGIN_LOCK=1');
    return;
  }

  if (!fs.existsSync(lockFilePath)) {
    fail(`Missing lock file: ${path.basename(lockFilePath)}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
  } catch (error) {
    fail(`Unable to parse lock file: ${error.message}`);
  }

  if (!manifest || typeof manifest !== 'object' || !manifest.files || typeof manifest.files !== 'object') {
    fail('Invalid lock file format.');
  }

  const changed = [];
  for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      changed.push(`${relPath} (missing)`);
      continue;
    }

    const actualHash = sha256(fs.readFileSync(absPath));
    if (String(actualHash) !== String(expectedHash)) {
      changed.push(relPath);
    }
  }

  if (changed.length) {
    fail(`Locked login files changed:\n - ${changed.join('\n - ')}`);
  }

  console.log('[login-lock] OK');
}

main();
