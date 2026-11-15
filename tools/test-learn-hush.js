'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { registerLearnHushRoutes } = require('../learn-hush-store');

async function main() {
  const root = path.join(__dirname, '..');
  const guide = await fs.readFile(path.join(root, 'learn-hush.html'), 'utf8');
  assert.equal(guide, await fs.readFile(path.join(root, 'public', 'learn-hush.html'), 'utf8'));
  const keys = [...guide.matchAll(/data-learn-key="([^"]+)"/g)].map(match => match[1]);
  assert.equal(keys.length, 69);
  assert.equal(new Set(keys).size, keys.length);
  for (const match of guide.matchAll(/<(h2|h3|p|li)\b([^>]*)>/g)) {
    assert.match(match[2], /data-learn-key=/);
  }
  for (const name of ['admin-portal.html', 'public/admin-portal.html']) {
    const portal = await fs.readFile(path.join(root, name), 'utf8');
    assert.match(portal, /id="learnEditorForm"/);
    assert.match(portal, /\/public\/admin-learn-hush-editor\.js/);
  }

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hush-learn-test-'));
  const file = path.join(dir, 'learn-hush-content.json');
  const tempFile = path.join(dir, 'test-write.tmp');
  const app = express();
  app.use(express.json());
  registerLearnHushRoutes(app, (req, res, next) => {
    if (req.get('x-admin-key') !== 'test-key') return res.status(401).json({ ok: false });
    next();
  }, async (target, json) => {
    await fs.writeFile(tempFile, json);
    await fs.rename(tempFile, target);
  }, dir);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = () => fetch(`${base}/api/public/learn-hush`);
  const save = (content, baseRevision, key = 'test-key') => fetch(`${base}/api/admin/learn-hush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify({ content, baseRevision })
  });
  try {
    const initialResponse = await get();
    assert.equal(initialResponse.headers.get('cache-control'), 'no-store');
    const initial = await initialResponse.json();
    assert.deepEqual(initial.content, {});
    assert.equal((await save({}, initial.revision, 'wrong')).status, 401);
    assert.equal((await save({ 'bad-key': 'text' }, initial.revision)).status, 400);
    assert.equal((await save({ 'block-001': '<img src=x onerror=alert(1)>' }, initial.revision)).status, 200);
    const saved = await (await get()).json();
    assert.equal(saved.content['block-001'], '<img src=x onerror=alert(1)>');
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), saved.content);
    assert.equal((await save({}, initial.revision)).status, 409);

    const concurrent = await Promise.all([
      save({ 'block-002': 'first' }, saved.revision),
      save({ 'block-002': 'second' }, saved.revision)
    ]);
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
    const latest = await (await get()).json();
    assert.ok(['first', 'second'].includes(latest.content['block-002']));
    await fs.writeFile(file, '{invalid');
    assert.equal((await get()).status, 500);
    assert.equal((await save({}, latest.revision)).status, 500);
    console.log('Learn Hush template and API tests passed.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.unlink(tempFile).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await fs.rmdir(dir);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
