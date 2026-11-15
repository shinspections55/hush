const fs = require('node:fs');
const path = require('node:path');

function resolveAuctionDatabasePath(env = process.env, root = __dirname) {
  const configured = String(env.HUSH_AUCTION_DB_PATH || '').trim();
  if (!configured) {
    return { filePath: path.join(root, 'auction_data.db'), external: false };
  }
  if (!path.isAbsolute(configured)) {
    throw new Error('HUSH_AUCTION_DB_PATH must be an absolute path on persistent storage.');
  }
  const filePath = path.resolve(configured);
  const relative = path.relative(root, filePath);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('HUSH_AUCTION_DB_PATH must be outside the deployed code directory.');
  }
  return { filePath, external: true };
}

function prepareAuctionDatabasePath(env = process.env, root = __dirname) {
  const location = resolveAuctionDatabasePath(env, root);
  if (location.external) {
    if (!fs.existsSync(location.filePath)) {
      if (env.HUSH_ALLOW_NEW_AUCTION_DB !== '1') {
        throw new Error('Persistent auction database is missing. Restore your database backup to HUSH_AUCTION_DB_PATH first. Set HUSH_ALLOW_NEW_AUCTION_DB=1 only for an intentionally empty database.');
      }
      fs.mkdirSync(path.dirname(location.filePath), { recursive: true });
    } else if (!fs.statSync(location.filePath).isFile() || fs.statSync(location.filePath).size === 0) {
      throw new Error('Persistent auction database must be an existing, non-empty SQLite file.');
    }
  }
  return location;
}

module.exports = { resolveAuctionDatabasePath, prepareAuctionDatabasePath };
