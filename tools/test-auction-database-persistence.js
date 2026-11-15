'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sqlite3 = require('sqlite3');
const { resolveAuctionDatabasePath, prepareAuctionDatabasePath } = require('../auction-database-path');
const { backupAuctionDatabase } = require('./backup-auction-database');

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-db-persistence-'));
  const source = path.join(dir, 'source.db');
  const target = path.join(dir, 'snapshot.sqlite-backup');
  const root = path.resolve(__dirname, '..');
  let connection;
  const run = sql => new Promise((resolve, reject) => connection.run(sql, error => error ? reject(error) : resolve()));
  const close = async () => {
    if (connection) {
      await new Promise((resolve, reject) => connection.close(error => error ? reject(error) : resolve()));
      connection = null;
    }
  };
  try {
    assert.equal(resolveAuctionDatabasePath({}, root).filePath, path.join(root, 'auction_data.db'));
    assert.throws(() => resolveAuctionDatabasePath({ HUSH_AUCTION_DB_PATH: 'relative.db' }, root), /absolute/);
    assert.throws(() => resolveAuctionDatabasePath({ HUSH_AUCTION_DB_PATH: path.join(root, 'inside.db') }, root), /outside/);
    assert.throws(() => prepareAuctionDatabasePath({ HUSH_AUCTION_DB_PATH: source }), /missing/);
    const config = { HUSH_AUCTION_DB_PATH: source, HUSH_ALLOW_NEW_AUCTION_DB: '1' };
    assert.equal(prepareAuctionDatabasePath(config).filePath, source);
    connection = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(source, error => error ? reject(error) : resolve(db));
    });
    await run('PRAGMA journal_mode=WAL');
    await run('CREATE TABLE market (player_id INTEGER PRIMARY KEY, auctions INTEGER, av REAL)');
    await run('INSERT INTO market VALUES (1, 150, 21.75)');
    assert.equal(prepareAuctionDatabasePath({ HUSH_AUCTION_DB_PATH: source }).external, true);
    await backupAuctionDatabase(source, target);
    assert.ok(fs.existsSync(target));
    await assert.rejects(backupAuctionDatabase(source, target), /EEXIST/);
    await assert.rejects(backupAuctionDatabase(source, source), /differ/);
    await close();
    connection = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(target, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
    });
    const row = await new Promise((resolve, reject) => {
      connection.get('SELECT * FROM market', (error, result) => error ? reject(error) : resolve(result));
    });
    assert.deepEqual(row, { player_id: 1, auctions: 150, av: 21.75 }, 'Live WAL writes are included in backup');
    await close();
    const missing = spawnSync(process.execPath, ['-e', "require('./database')"], {
      cwd: root, env: { ...process.env, HUSH_AUCTION_DB_PATH: path.join(dir, 'missing.db'), HUSH_ALLOW_NEW_AUCTION_DB: '' },
      encoding: 'utf8'
    });
    assert.notEqual(missing.status, 0, 'Missing persistent data must stop startup');
    assert.match(missing.stderr, /Persistent auction database is missing/);
    const empty = path.join(dir, 'empty.db');
    fs.writeFileSync(empty, '');
    assert.throws(() => prepareAuctionDatabasePath({ HUSH_AUCTION_DB_PATH: empty }), /non-empty/);
    const broken = path.join(dir, 'broken.db');
    const failedBackup = path.join(dir, 'failed.sqlite-backup');
    fs.writeFileSync(broken, 'not a sqlite database');
    await assert.rejects(backupAuctionDatabase(broken, failedBackup));
    assert.equal(fs.existsSync(failedBackup), false, 'Failed snapshots are removed');
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(process.execPath, ['-e',
        "const d=require('./database'); setTimeout(()=>d.closeDatabase(),500);"
      ], { cwd: root, env: { ...process.env, HUSH_AUCTION_DB_PATH: source, HUSH_ALLOW_NEW_AUCTION_DB: '' }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    connection = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(source, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(db));
    });
    const preserved = await new Promise((resolve, reject) => {
      connection.get('SELECT * FROM market', (error, result) => error ? reject(error) : resolve(result));
    });
    assert.deepEqual(preserved, row, 'Repeated app starts preserve existing data');
    console.log('Auction DB persistence tests passed: paths, startup guard, WAL backup, integrity, overwrite protection, and restart preservation.');
  } finally {
    await close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
