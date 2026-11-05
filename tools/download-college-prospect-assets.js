'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const prospectsRoot = path.join(root, 'college prospects 2027');
const assetsRoot = path.join(prospectsRoot, 'assets');
const manifestPath = path.join(assetsRoot, 'assets-manifest.json');
const positions = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'DB'];
const fields = [
  { property: 'imageUrl', directory: 'headshots', kind: 'headshot' },
  { property: 'schoolLogoUrl', directory: 'schools', kind: 'school-mark' }
];
const allowedHost = 'www.nfldraftbuzz.com';
const concurrency = 6;

function assetRelativePath(field, sourceUrl) {
  const parsed = new URL(sourceUrl);
  if (parsed.hostname !== allowedHost || parsed.protocol !== 'https:') {
    throw new Error(`Unexpected image source: ${sourceUrl}`);
  }

  const sourceName = path.posix.basename(parsed.pathname);
  const extension = path.posix.extname(sourceName).toLowerCase() || '.png';
  const stem = path.posix.basename(sourceName, path.posix.extname(sourceName))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || field.kind;
  const suffix = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 8);
  const relative = `assets/${field.directory}/${stem}-${suffix}${extension}`;
  return {
    relative,
    localUrl: `/college%20prospects%202027/${relative.split('/').map(encodeURIComponent).join('/')}`
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function downloadAsset(sourceUrl, destination) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType || 'missing'}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 100) throw new Error('Image response was unexpectedly small');
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, bytes);
      return { bytes: bytes.length, contentType };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}

async function runWithConcurrency(items, worker) {
  let nextIndex = 0;
  const results = new Array(items.length);
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  await fs.mkdir(assetsRoot, { recursive: true });
  let manifest = { version: 1, assets: {} };
  try {
    const existing = await readJson(manifestPath);
    if (existing && existing.assets && typeof existing.assets === 'object') manifest = existing;
  } catch (_error) {
    // Start a new manifest when no prior download manifest exists.
  }

  const boards = [];
  const sources = new Map();
  for (const position of positions) {
    const filePath = path.join(prospectsRoot, position, `${position.toLowerCase()}-prospects-2027.json`);
    const players = await readJson(filePath);
    if (!Array.isArray(players)) throw new Error(`${filePath} must contain a JSON array`);
    boards.push({ filePath, players });
    players.forEach(player => {
      fields.forEach(field => {
        const imageUrl = String(player[field.property] || '').trim();
        if (/^https:\/\//i.test(imageUrl)) {
          const target = assetRelativePath(field, imageUrl);
          sources.set(imageUrl, { ...target, field, kind: field.kind });
        }
      });
    });
  }

  const downloads = Array.from(sources.entries());
  let downloaded = 0;
  let skipped = 0;
  const failures = [];
  await runWithConcurrency(downloads, async ([sourceUrl, asset]) => {
    const diskPath = path.join(prospectsRoot, ...asset.relative.split('/'));
    try {
      const existing = await fs.stat(diskPath).catch(() => null);
      if (existing && existing.size > 0) {
        skipped += 1;
      } else {
        const result = await downloadAsset(sourceUrl, diskPath);
        downloaded += 1;
        manifest.assets[asset.localUrl] = {
          sourceUrl,
          kind: asset.kind,
          bytes: result.bytes,
          contentType: result.contentType
        };
      }
      return { sourceUrl, ok: true };
    } catch (error) {
      failures.push({ sourceUrl, error: String(error && error.message || error) });
      return { sourceUrl, ok: false };
    }
  });

  let updatedBoards = 0;
  for (const board of boards) {
    let changed = false;
    board.players.forEach(player => {
      fields.forEach(field => {
        const sourceUrl = String(player[field.property] || '').trim();
        const asset = sources.get(sourceUrl);
        if (asset && !failures.some(failure => failure.sourceUrl === sourceUrl)) {
          player[field.property] = asset.localUrl;
          changed = true;
        }
      });
    });
    if (changed) {
      await fs.writeFile(board.filePath, `${JSON.stringify(board.players, null, 2)}\n`, 'utf8');
      updatedBoards += 1;
    }
  }

  manifest.updatedAt = new Date().toISOString();
  manifest.lastRun = { requested: downloads.length, downloaded, skipped, failed: failures.length };
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    uniqueAssets: downloads.length,
    downloaded,
    alreadyPresent: skipped,
    failed: failures.length,
    updatedPositionBoards: updatedBoards,
    manifest: path.relative(root, manifestPath),
    failures
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
