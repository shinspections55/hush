'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const path = require('node:path');

function registerLearnHushRoutes(app, requireAdmin, writeAtomically, directory) {
  const file = path.join(directory, 'learn-hush-content.json');
  let writeQueue = Promise.resolve();
  const revision = content => crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const valid = content => content && typeof content === 'object' && !Array.isArray(content)
    && Object.keys(content).length <= 200
    && Object.entries(content).every(([key, value]) => /^(page-title|header-(back|title|subtitle)|block-\d{3})$/.test(key)
      && typeof value === 'string' && value.length <= 4000);

  async function read() {
    let raw;
    try {
      raw = await fs.readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
    const content = JSON.parse(raw);
    if (!valid(content)) throw new Error('Invalid saved Learn Hush content');
    return content;
  }

  app.get('/api/public/learn-hush', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const content = await read();
      res.json({ ok: true, content, revision: revision(content) });
    } catch (error) {
      console.error('[learn-hush] Failed to read content:', error);
      res.status(500).json({ ok: false, error: 'Unable to load Learn Hush content.' });
    }
  });

  app.post('/api/admin/learn-hush', requireAdmin, async (req, res) => {
    const { content, baseRevision } = req.body || {};
    if (!valid(content) || typeof baseRevision !== 'string') {
      return res.status(400).json({ ok: false, error: 'Invalid guide content or revision.' });
    }
    const operation = writeQueue.then(async () => {
      const existing = await read();
      if (baseRevision !== revision(existing)) return null;
      await fs.mkdir(directory, { recursive: true });
      await writeAtomically(file, JSON.stringify(content, null, 2));
      return revision(content);
    });
    writeQueue = operation.catch(() => {});
    try {
      const savedRevision = await operation;
      if (!savedRevision) return res.status(409).json({ ok: false, error: 'The guide changed since you loaded it. Reload before saving.' });
      return res.json({ ok: true, revision: savedRevision });
    } catch (error) {
      console.error('[learn-hush] Failed to save content:', error);
      return res.status(500).json({ ok: false, error: 'Unable to save Learn Hush content.' });
    }
  });
}

module.exports = { registerLearnHushRoutes };
