const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');

// Only folders that are actually served. HushV4.0 is a legacy snapshot and is left alone.
const HTML_DIRS = ['.', 'public'];

const SERVICE_WORKERS = ['service-worker.js', 'public/service-worker.js'];

// Changing any of these should invalidate the installed PWA cache.
const HASHED_ASSETS = [
  'public/silentdraft.js',
  'public/silentdraft.css',
  'public/lobby.js',
  'public/draft-summary.js',
  'public/waivers.js',
  'scripts.js',
  'dashboard.js',
  'styles.css',
  'theme-utils.js',
  'preferences.js',
  'sw-register.js',
  'service-worker.js'
];

const ASSET_REF_PATTERN = /(\.(?:js|css)\?v=)([0-9a-zA-Z._-]+)/g;
const CACHE_NAME_PATTERN = /(const CACHE_NAME = ')([^']+)(';)/;

function listHtmlFiles() {
  const files = [];
  for (const dir of HTML_DIRS) {
    const absDir = path.join(repoRoot, dir);
    if (!fs.existsSync(absDir)) continue;
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

function computeVersion() {
  const hash = crypto.createHash('sha256');
  for (const relPath of HASHED_ASSETS) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) continue;
    hash.update(relPath);
    const content = fs.readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n');
    // The stamped cache name is an output of this tool, so exclude it or the hash never converges.
    hash.update(content.replace(CACHE_NAME_PATTERN, '$1$3'));
  }
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${stamp}-${hash.digest('hex').slice(0, 8)}`;
}

function readCurrentVersions() {
  const found = new Map();
  for (const relPath of listHtmlFiles()) {
    const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
    for (const match of content.matchAll(ASSET_REF_PATTERN)) {
      const version = match[2];
      if (!found.has(version)) found.set(version, []);
      found.get(version).push(relPath);
    }
  }
  return found;
}

function applyVersion(version) {
  const changed = [];

  for (const relPath of listHtmlFiles()) {
    const absPath = path.join(repoRoot, relPath);
    const content = fs.readFileSync(absPath, 'utf8');
    const next = content.replace(ASSET_REF_PATTERN, (full, prefix) => `${prefix}${version}`);
    if (next !== content) {
      fs.writeFileSync(absPath, next);
      changed.push(relPath);
    }
  }

  for (const relPath of SERVICE_WORKERS) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) continue;
    const content = fs.readFileSync(absPath, 'utf8');
    if (!CACHE_NAME_PATTERN.test(content)) continue;
    const next = content.replace(CACHE_NAME_PATTERN, (full, prefix, _old, suffix) => `${prefix}hush-${version}${suffix}`);
    if (next !== content) {
      fs.writeFileSync(absPath, next);
      changed.push(relPath);
    }
  }

  return changed;
}

function commandCheck() {
  const versions = readCurrentVersions();
  const distinct = [...versions.keys()];

  if (distinct.length === 0) {
    console.log('[asset-version] No versioned asset references found.');
    return 0;
  }

  if (distinct.length === 1) {
    console.log(`[asset-version] OK - all references use ${distinct[0]}`);
    return 0;
  }

  console.warn(`[asset-version] DRIFT - ${distinct.length} different versions in use:`);
  for (const [version, files] of versions) {
    console.warn(`  ${version} (${files.length} refs)`);
  }
  console.warn('[asset-version] Run: npm run assets:bump');
  return 1;
}

function commandBump() {
  const explicit = process.argv[3];
  const version = explicit && explicit.trim() ? explicit.trim() : computeVersion();
  const changed = applyVersion(version);

  console.log(`[asset-version] Version: ${version}`);
  if (changed.length === 0) {
    console.log('[asset-version] Already up to date.');
    return 0;
  }
  console.log(`[asset-version] Updated ${changed.length} file(s):`);
  for (const relPath of changed) console.log(`  ${relPath}`);
  return 0;
}

const command = (process.argv[2] || 'check').trim();
if (command === 'bump') {
  process.exit(commandBump());
} else if (command === 'check') {
  process.exit(commandCheck());
} else {
  console.error(`[asset-version] Unknown command "${command}". Use "check" or "bump".`);
  process.exit(2);
}
