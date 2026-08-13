const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');
const lockFilePath = path.join(repoRoot, 'login-flow.lock.json');

const lockedFiles = [
  'scripts.js',
  'dashboard.js',
  'public/scripts.js',
  'public/dashboard.js',
  'HushV4.0/scripts.js',
  'HushV4.0/dashboard.js'
];

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashFile(relPath) {
  const absPath = path.join(repoRoot, relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing locked file: ${relPath}`);
  }
  const content = fs.readFileSync(absPath);
  return sha256(content);
}

function buildManifest() {
  const files = {};
  for (const relPath of lockedFiles) {
    files[relPath] = hashFile(relPath);
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    files
  };
}

function main() {
  const manifest = buildManifest();
  fs.writeFileSync(lockFilePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`[login-lock] Wrote ${path.basename(lockFilePath)} with ${Object.keys(manifest.files).length} file hashes.`);
}

main();
