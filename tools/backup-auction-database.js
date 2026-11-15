const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { resolveAuctionDatabasePath } = require('../auction-database-path');

async function backupAuctionDatabase(source, destination) {
  if (!path.isAbsolute(source) || !path.isAbsolute(destination)) {
    throw new Error('Source and destination must be absolute file paths.');
  }
  const stat = fs.statSync(source);
  if (!stat.isFile() || stat.size === 0) throw new Error('Source database is missing or empty.');
  if (path.resolve(source) === path.resolve(destination)) throw new Error('Backup destination must differ from source.');
  const handle = fs.openSync(destination, 'wx');
  fs.closeSync(handle);
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(source, sqlite3.OPEN_READONLY, error => {
        if (error) reject(error);
        else resolve(connection);
      });
    });
    await new Promise((resolve, reject) => {
      db.run('VACUUM INTO ?', [destination], error => error ? reject(error) : resolve());
    });
    await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
    db = null;
    db = await new Promise((resolve, reject) => {
      const connection = new sqlite3.Database(destination, sqlite3.OPEN_READONLY, error => {
        if (error) reject(error);
        else resolve(connection);
      });
    });
    const verification = await new Promise((resolve, reject) => {
      db.get('PRAGMA integrity_check', (error, row) => error ? reject(error) : resolve(row));
    });
    if (!verification || verification.integrity_check !== 'ok') throw new Error('Backup database integrity check failed.');
  } catch (error) {
    if (db) {
      await new Promise((resolve, reject) => db.close(closeError => closeError ? reject(closeError) : resolve()));
      db = null;
    }
    fs.unlinkSync(destination);
    throw error;
  } finally {
    if (db) await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2) {
    console.error('Usage: npm run db:backup -- <absolute-destination> [absolute-source]');
    process.exitCode = 1;
  } else {
    const source = args[1] || resolveAuctionDatabasePath().filePath;
    backupAuctionDatabase(source, args[0]).then(() => {
      console.log(`Auction database snapshot saved to ${args[0]}. Store a copy outside the host for disaster recovery.`);
    }).catch(error => {
      console.error('[DATABASE] Backup failed:', error.message);
      process.exitCode = 1;
    });
  }
}

module.exports = { backupAuctionDatabase };
