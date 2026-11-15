'use strict';

const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

async function retireMockTestContests(filePath, writeJsonFileAtomically) {
  let contents;
  try { contents = await fs.readFile(filePath, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const root = JSON.parse(contents);
  if (root.version !== 2) return;
  const retained = root.contests.filter(contest => contest.year !== 2025 && contest.id !== 'sandbox-2027');
  if (retained.length === root.contests.length) return;
  if (!retained.some(contest => contest.id === 'contest-2027' && contest.year === 2027 &&
    contest.datasets.some(dataset => dataset.id === 'real-nfl' && dataset.type === 'real'))) {
    throw new Error('Cannot retire test contests without the real 2027 contest and NFL results dataset.');
  }
  const backupPath = `${filePath}.retired-tests-${Date.now()}-${randomUUID()}.bak`;
  await fs.writeFile(backupPath, contents, { flag: 'wx' });
  root.contests = retained;
  root.revision += 1;
  await writeJsonFileAtomically(filePath, JSON.stringify(root, null, 2));
  console.info('[mock-draft] Retired 2025 and sandbox contests; preserved a backup before cleanup.');
}

module.exports = { retireMockTestContests };
