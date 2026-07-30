// ...existing code...


const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs/promises');
const crypto = require('crypto');
const compression = require('compression');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');
const app = express();
const port = process.env.PORT || 8000;

// Import database module
const { logAuctionResult, logIndividualBid, bulkLogIndividualBids, getPlayerAV, getPlayerAuctionCount, getPlayerAvTrends, closeDatabase } = require('./database');

// Import CPU logic modules
const { generateServerCPUBids, evaluateBidStrategy } = require('./cpu-silent-auction');
const { runTiedAuctionRound, pickRandomCPU, placeForcedBid, getAggression, decideAction } = require('./cpu-tied-live-auction');

app.use(express.json({ limit: '5mb' }));
app.disable('x-powered-by');
app.use(compression({ threshold: 1024 }));

const AUTH_USERS_FILE = path.join(__dirname, 'auth-users.json');
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const ADMIN_DEBUG_KEY = String(process.env.ADMIN_DEBUG_KEY || '1218').trim();
const CPU_LOGIC_FILE = path.join(__dirname, 'cpulogic.js');
const DEFAULT_RANKINGS_FILE = path.join(__dirname, 'top250.generated.json');
const FALLBACK_RANKINGS_FILE = path.join(__dirname, 'top250.json');
const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']);
const POSITION_FILE_MAP = {
  QB: { fileName: 'qb.json', rankField: 'qbRank', rankPrefix: '' },
  RB: { fileName: 'rb.json', rankField: 'RBrank', rankPrefix: '#' },
  WR: { fileName: 'wr.json', rankField: 'WRrank', rankPrefix: '#' },
  TE: { fileName: 'te.json', rankField: 'TErank', rankPrefix: '#' },
  K: { fileName: 'k.json', rankField: 'Krank', rankPrefix: '#' },
  DEF: { fileName: 'def.json', rankField: 'DEFrank', rankPrefix: '#' }
};

const deliveryDebugState = {
  lastEmail: null,
  lastSms: null
};

const trafficStats = {
  startedAt: Date.now(),
  totalRequests: 0,
  byMethod: {},
  byPath: {},
  statusCodes: {},
  recent: []
};

async function readAuthUsers() {
  try {
    const raw = await fs.readFile(AUTH_USERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeAuthUsers(parsed);
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeAuthUsers(users) {
  await fs.writeFile(AUTH_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeAuthUserRecord(rawUser, fallbackKey = '') {
  if (!rawUser || typeof rawUser !== 'object') return null;

  const username = String(rawUser.username || rawUser.userName || fallbackKey || '').trim();
  const usernameKey = normalizeUsername(rawUser.usernameKey || username || fallbackKey);
  if (!usernameKey) return null;

  const email = normalizeEmail(rawUser.email || rawUser.mail || '');
  const phone = normalizePhone(rawUser.phone || rawUser.phoneNumber || rawUser.mobile || '');
  const fullname = String(rawUser.fullname || rawUser.fullName || rawUser.name || username || usernameKey).trim();

  let passwordSalt = String(rawUser.passwordSalt || rawUser.salt || '').trim();
  let passwordHash = String(rawUser.passwordHash || rawUser.hash || '').trim();

  if ((!passwordSalt || !passwordHash) && rawUser.password != null) {
    const migrated = hashPassword(String(rawUser.password || ''));
    passwordSalt = migrated.salt;
    passwordHash = migrated.hash;
  }

  return {
    fullname,
    email,
    username: username || usernameKey,
    usernameKey,
    phone,
    passwordSalt,
    passwordHash,
    createdAt: Number(rawUser.createdAt || rawUser.created || Date.now()) || Date.now(),
    resetCode: rawUser.resetCode != null ? String(rawUser.resetCode) : null,
    resetCodeExpiresAt: Number(rawUser.resetCodeExpiresAt || 0),
    resetToken: rawUser.resetToken != null ? String(rawUser.resetToken) : null,
    resetTokenExpiresAt: Number(rawUser.resetTokenExpiresAt || 0)
  };
}

function normalizeAuthUsers(parsedUsers) {
  if (!parsedUsers || typeof parsedUsers !== 'object') return {};

  const entries = Array.isArray(parsedUsers)
    ? parsedUsers.map((user, index) => [String(user && (user.usernameKey || user.username || user.email || index) || index), user])
    : Object.entries(parsedUsers);

  return entries.reduce((acc, [key, rawUser]) => {
    const normalized = normalizeAuthUserRecord(rawUser, key);
    if (normalized) {
      acc[normalized.usernameKey] = normalized;
    }
    return acc;
  }, {});
}

function verifyUserPassword(user, password) {
  if (!user || !password) return false;

  if (user.passwordSalt && user.passwordHash) {
    const { hash } = hashPassword(password, user.passwordSalt);
    return safeEq(hash, user.passwordHash);
  }

  return false;
}

function sanitizeAuthUser(user) {
  if (!user) return null;
  return {
    fullname: String(user.fullname || '').trim(),
    email: normalizeEmail(user.email),
    username: String(user.username || user.usernameKey || '').trim(),
    usernameKey: normalizeUsername(user.usernameKey || user.username),
    phone: normalizePhone(user.phone),
    createdAt: Number(user.createdAt || 0) || 0
  };
}

function findAccountForRequest(users, username) {
  const usernameKey = normalizeUsername(username);
  if (!usernameKey) return { user: null, usernameKey: '' };
  return {
    user: users[usernameKey] || null,
    usernameKey
  };
}

function normalizePosition(position) {
  const pos = String(position || '').trim().toUpperCase();
  return VALID_POSITIONS.has(pos) ? pos : '';
}

function normalizePlayerNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function sanitizeStarredNamesInput(rawInput) {
  const source = Array.isArray(rawInput)
    ? rawInput
    : (rawInput && Array.isArray(rawInput.starredNames) ? rawInput.starredNames : []);

  const out = [];
  const seen = new Set();
  source.forEach((name) => {
    const clean = String(name || '').trim();
    const key = normalizePlayerNameKey(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  });

  return out.slice(0, 120);
}

function buildAutoDraftStarPlayerIdsByTeam(teams, allPlayers, autoDraftStarTargets, autoDraftMembers) {
  const players = Array.isArray(allPlayers) ? [...allPlayers] : [];
  players.sort((a, b) => {
    const rankA = Number(a && a.prerank || 9999);
    const rankB = Number(b && b.prerank || 9999);
    if (rankA !== rankB) return rankA - rankB;
    return Number(b && b.avgValue || 0) - Number(a && a.avgValue || 0);
  });

  const playerIdByNameKey = new Map();
  players.forEach((player) => {
    const key = normalizePlayerNameKey(player && player.name);
    const playerId = player && player.id;
    if (!key || playerId == null || playerId === '') return;
    if (!playerIdByNameKey.has(key)) {
      playerIdByNameKey.set(key, String(playerId));
    }
  });

  const teamNameSet = new Set((Array.isArray(teams) ? teams : []).map((team) => String(team && team.name || '').trim()));
  const result = {};

  (Array.isArray(autoDraftMembers) ? autoDraftMembers : []).forEach((teamNameRaw) => {
    const teamName = String(teamNameRaw || '').trim();
    if (!teamName || !teamNameSet.has(teamName)) return;

    const starredNames = sanitizeStarredNamesInput(autoDraftStarTargets && autoDraftStarTargets[teamName]);
    const ids = [];
    const seenIds = new Set();

    starredNames.forEach((name) => {
      const playerId = playerIdByNameKey.get(normalizePlayerNameKey(name));
      if (!playerId || seenIds.has(playerId)) return;
      seenIds.add(playerId);
      ids.push(playerId);
    });

    if (ids.length > 0) {
      result[teamName] = ids;
    }
  });

  return result;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPositionFileMeta(position) {
  const normalizedPos = normalizePosition(position);
  return normalizedPos ? POSITION_FILE_MAP[normalizedPos] || null : null;
}

function parsePositionRankValue(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
  return toNumber(cleaned, fallback);
}

function formatPositionRankValue(position, rankNumber) {
  const meta = getPositionFileMeta(position);
  const rank = Math.max(1, toNumber(rankNumber, 1));
  if (!meta) return rank;
  return meta.rankPrefix ? `${meta.rankPrefix}${rank}` : rank;
}

function normalizePositionFilePlayer(rawPlayer, position, index = 0) {
  const normalizedPos = normalizePosition(position || rawPlayer.position);
  const meta = getPositionFileMeta(normalizedPos);
  if (!normalizedPos || !meta) return null;

  const name = String(rawPlayer.name || '').trim();
  if (!name) return null;

  const parsedRank = parsePositionRankValue(rawPlayer[meta.rankField], index + 1);

  return {
    id: index + 1,
    rank: parsedRank,
    name,
    position: normalizedPos,
    team: String(rawPlayer.team || '').trim().toUpperCase(),
    avgValue: toNumber(rawPlayer.avgValue, 0),
    draftChance: toNumber(rawPlayer.draftChance, 0),
    tier: String(rawPlayer.tier || rawPlayer.tierName || rawPlayer.tierId || '').trim() || undefined,
    img: String(rawPlayer.img || '').trim() || undefined
  };
}

function reindexPositionPlayers(position, players) {
  return [...players].map((player, idx) => ({
    ...player,
    id: idx + 1,
    rank: idx + 1,
    position: normalizePosition(position)
  }));
}

async function readPositionRankingsData(position) {
  const normalizedPos = normalizePosition(position);
  const meta = getPositionFileMeta(normalizedPos);
  if (!meta) {
    throw new Error('Invalid position');
  }

  const filePath = path.join(__dirname, 'players file', meta.fileName);

  try {
    const stat = await fs.stat(filePath);
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const normalizedPlayers = Array.isArray(parsed)
      ? parsed.map((player, index) => normalizePositionFilePlayer(player, normalizedPos, index)).filter(Boolean)
      : [];

    const players = reindexPositionPlayers(normalizedPos, normalizedPlayers);

    return {
      position: normalizedPos,
      sourceFile: meta.fileName,
      filePath,
      lastUpdatedAt: stat.mtimeMs,
      players
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        position: normalizedPos,
        sourceFile: meta.fileName,
        filePath,
        lastUpdatedAt: null,
        players: []
      };
    }
    throw error;
  }
}

async function writePositionRankingsData(position, players) {
  const normalizedPos = normalizePosition(position);
  const meta = getPositionFileMeta(normalizedPos);
  if (!meta) {
    throw new Error('Invalid position');
  }

  const filePath = path.join(__dirname, 'players file', meta.fileName);
  const normalizedPlayers = reindexPositionPlayers(
    normalizedPos,
    (Array.isArray(players) ? players : [])
      .map((player, index) => normalizePositionFilePlayer({ ...player, position: normalizedPos }, normalizedPos, index))
      .filter(Boolean)
  );

  const serialized = normalizedPlayers.map((player, idx) => {
    const output = {
      [meta.rankField]: formatPositionRankValue(normalizedPos, idx + 1),
      name: player.name,
      position: normalizedPos,
      team: player.team || '',
      avgValue: toNumber(player.avgValue, 0),
      draftChance: toNumber(player.draftChance, 0)
    };

    if (player.tier) {
      output.tier = String(player.tier).trim();
    }

    if (player.img) {
      output.img = player.img;
    }

    return output;
  });

  await fs.writeFile(filePath, JSON.stringify(serialized, null, 4), 'utf8');
  return normalizedPlayers;
}

async function rebuildDefaultRankingsFromPositionFiles() {
  const positionLists = await Promise.all(
    Array.from(VALID_POSITIONS).map((position) => readPositionRankingsData(position))
  );

  const mergedPlayers = positionLists
    .flatMap((rankingsData) => rankingsData.players || [])
    .map((player, index) => ({
      ...player,
      _sourceIndex: index,
      _positionRank: toNumber(player.rank, 999999)
    }));

  const dedupedPlayers = [];
  const seenNames = new Set();
  mergedPlayers.forEach((player) => {
    const key = String(player.name || '').trim().toLowerCase();
    if (!key || seenNames.has(key)) return;
    seenNames.add(key);
    dedupedPlayers.push(player);
  });

  const sortedPlayers = dedupedPlayers.sort((a, b) => {
    const avgValueDelta = toNumber(b.avgValue, 0) - toNumber(a.avgValue, 0);
    if (avgValueDelta !== 0) return avgValueDelta;

    const draftChanceDelta = toNumber(b.draftChance, 0) - toNumber(a.draftChance, 0);
    if (draftChanceDelta !== 0) return draftChanceDelta;

    const positionRankDelta = toNumber(a._positionRank, 999999) - toNumber(b._positionRank, 999999);
    if (positionRankDelta !== 0) return positionRankDelta;

    return toNumber(a._sourceIndex, 999999) - toNumber(b._sourceIndex, 999999);
  }).map(({ _sourceIndex, _positionRank, rank, draftChance, img, tier, ...player }) => {
    return {
      ...player,
      tier: null
    };
  });

  return writeDefaultRankingsData(sortedPlayers);
}

function normalizeRankingPlayer(rawPlayer, index = 0) {
  const normalizedPos = normalizePosition(rawPlayer.position);
  if (!normalizedPos) return null;

  const name = String(rawPlayer.name || '').trim();
  if (!name) return null;

  return {
    id: index + 1,
    name,
    position: normalizedPos,
    team: String(rawPlayer.team || '').trim().toUpperCase(),
    prerank: toNumber(rawPlayer.prerank, index + 1),
    avgValue: toNumber(rawPlayer.avgValue, 1),
    tier: String(rawPlayer.tier || rawPlayer.tierId || rawPlayer.tierName || '').trim() || null
  };
}

function sortAndReindexRankings(rankings) {
  const sorted = [...rankings].sort((a, b) => {
    const rankA = toNumber(a.prerank, 999999);
    const rankB = toNumber(b.prerank, 999999);
    if (rankA !== rankB) return rankA - rankB;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return sorted.map((player, idx) => ({
    ...player,
    id: idx + 1,
    prerank: idx + 1
  }));
}

async function readDefaultRankingsData() {
  const candidates = [DEFAULT_RANKINGS_FILE, FALLBACK_RANKINGS_FILE];
  for (const filePath of candidates) {
    try {
      const stat = await fs.stat(filePath);
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed)
        ? parsed
            .map((player, index) => normalizeRankingPlayer(player, index))
            .filter(Boolean)
        : [];
      return {
        sourceFile: path.basename(filePath),
        lastUpdatedAt: stat.mtimeMs,
        players: sortAndReindexRankings(normalized)
      };
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
  }

  return {
    sourceFile: path.basename(DEFAULT_RANKINGS_FILE),
    lastUpdatedAt: null,
    players: []
  };
}

async function writeDefaultRankingsData(players) {
  const normalized = sortAndReindexRankings(
    (Array.isArray(players) ? players : [])
      .map((player, index) => normalizeRankingPlayer(player, index))
      .filter(Boolean)
  );

  const serialized = JSON.stringify(normalized, null, 2);
  await Promise.all([
    fs.writeFile(DEFAULT_RANKINGS_FILE, serialized, 'utf8'),
    fs.writeFile(FALLBACK_RANKINGS_FILE, serialized, 'utf8')
  ]);
  return normalized;
}

function normalizePlayerNameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function applyPositionOrderToTopPlayers(topPlayers, sourcePlayers, targetPosition) {
  const normalizedTop = Array.isArray(topPlayers) ? topPlayers : [];
  const normalizedSource = Array.isArray(sourcePlayers) ? sourcePlayers : [];
  const normalizedTargetPosition = normalizePosition(targetPosition);

  if (!normalizedTop.length || !normalizedTargetPosition) {
    return normalizedTop;
  }

  // Source-of-truth is the selected position file order.
  const sourcePool = normalizedSource
    .filter((player) => normalizePosition(player && player.position) === normalizedTargetPosition)
    .map((player) => ({ ...(player || {}), position: normalizedTargetPosition }));

  if (!sourcePool.length) {
    return normalizedTop;
  }

  let positionCursor = 0;
  return normalizedTop.map((player) => {
    if (normalizePosition(player && player.position) !== normalizedTargetPosition) {
      return player;
    }

    const sourcePlayer = sourcePool[positionCursor] || null;
    positionCursor += 1;

    if (!sourcePlayer) {
      return player;
    }

    // Keep tier metadata anchored to the TOP slot so sync only changes occupants.
    const preservedTierBreakBefore = !!(player && player.tierBreakBefore);
    const hasTierLabel = Object.prototype.hasOwnProperty.call(player || {}, 'tier');
    const hasTierKey = Object.prototype.hasOwnProperty.call(player || {}, 'tierKey');

    const merged = {
      ...sourcePlayer,
      position: normalizedTargetPosition,
      tierBreakBefore: preservedTierBreakBefore
    };

    if (hasTierLabel) {
      merged.tier = player.tier;
    }
    if (hasTierKey) {
      merged.tierKey = player.tierKey;
    }

    return merged;
  });
}

function clearTopTierMetadata(players) {
  const normalizedPlayers = Array.isArray(players) ? players : [];
  return normalizedPlayers.map((player) => {
    const nextPlayer = {
      ...(player || {}),
      tierBreakBefore: false,
      tier: null,
      tierKey: null
    };
    return nextPlayer;
  });
}

function alignTopSlotRanks(players) {
  const normalizedPlayers = Array.isArray(players) ? players : [];
  return normalizedPlayers.map((player, index) => ({
    ...(player || {}),
    id: index + 1,
    prerank: index + 1
  }));
}

async function backupDefaultRankingsSnapshot(reason = 'manual') {
  const rankingsData = await readDefaultRankingsData();
  const backupDir = path.join(__dirname, 'backups', 'top-rankings');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeReason = String(reason || 'manual').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const backupFileName = `top250.backup.${safeReason}.${timestamp}.json`;
  const backupFilePath = path.join(backupDir, backupFileName);

  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(backupFilePath, JSON.stringify(rankingsData.players || [], null, 2), 'utf8');

  return {
    backupFileName,
    backupFilePath,
    count: Array.isArray(rankingsData.players) ? rankingsData.players.length : 0
  };
}

async function syncTopPositionOrderFromPositionFile(options = {}) {
  const normalizedPosition = normalizePosition(options.position || 'RB');
  if (!normalizedPosition) {
    throw new Error('Valid position is required');
  }

  const reason = String(options.reason || `${normalizedPosition.toLowerCase()}-sync`).trim() || `${normalizedPosition.toLowerCase()}-sync`;
  const backup = await backupDefaultRankingsSnapshot(reason);
  const topData = await readDefaultRankingsData();
  const positionData = await readPositionRankingsData(normalizedPosition);

  const syncedPlayers = applyPositionOrderToTopPlayers(topData.players || [], positionData.players || [], normalizedPosition);
  const saved = await writeDefaultRankingsData(alignTopSlotRanks(clearTopTierMetadata(syncedPlayers)));

  return {
    backup,
    updatedCount: saved.length,
    sourceFile: topData.sourceFile,
    sourcePosition: normalizedPosition,
    positionSourceFile: positionData.sourceFile
  };
}

async function syncTopAllPositionOrdersFromPositionFiles(options = {}) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  const reason = String(options.reason || 'all-positions-sync').trim() || 'all-positions-sync';
  const backup = await backupDefaultRankingsSnapshot(reason);
  const topData = await readDefaultRankingsData();

  let syncedPlayers = Array.isArray(topData.players) ? topData.players.slice() : [];
  const sourceFiles = {};

  for (const position of positions) {
    const positionData = await readPositionRankingsData(position);
    sourceFiles[position] = positionData.sourceFile;
    syncedPlayers = applyPositionOrderToTopPlayers(syncedPlayers, positionData.players || [], position);
  }

  const saved = await writeDefaultRankingsData(alignTopSlotRanks(clearTopTierMetadata(syncedPlayers)));

  return {
    backup,
    updatedCount: saved.length,
    sourceFile: topData.sourceFile,
    sourcePositions: positions,
    positionSourceFiles: sourceFiles
  };
}

async function syncTopRbOrderFromRbFile(options = {}) {
  return syncTopPositionOrderFromPositionFile({
    ...options,
    position: 'RB',
    reason: options.reason || 'sync-rb-order'
  });
}

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function safeEq(a, b) {
  const aBuf = Buffer.from(a || '', 'utf8');
  const bBuf = Buffer.from(b || '', 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function normalizePhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) {
    return '+' + raw.slice(1).replace(/\D/g, '');
  }
  return raw.replace(/\D/g, '');
}

function maskEmail(email) {
  const value = normalizeEmail(email);
  const parts = value.split('@');
  if (parts.length !== 2) return '';
  const user = parts[0];
  const domain = parts[1];
  const head = user.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function maskPhone(phone) {
  const value = normalizePhone(phone);
  if (!value) return '';
  const tail = value.slice(-4);
  return `${'*'.repeat(Math.max(0, value.length - 4))}${tail}`;
}

function buildBaseUrl(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function findUserByIdentifier(users, identifier) {
  const key = normalizeUsername(identifier);
  const byUsername = users[key];
  if (byUsername) return byUsername;

  const email = normalizeEmail(identifier);
  if (!email) return null;

  return Object.values(users).find((user) => normalizeEmail(user.email) === email) || null;
}

function findUserByResetToken(users, token) {
  if (!token) return null;
  return Object.values(users).find((user) => user.resetToken === token) || null;
}

async function sendResetEmail(to, username, resetLink, code) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  const subject = 'Reset your password';
  const text = `Hi ${username},\n\nUse this link to reset your password:\n${resetLink}\n\nIf prompted, your verification code is: ${code}\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    console.log('[AUTH] SMTP not configured. Simulated email delivery.');
    console.log('[AUTH] Reset email to:', to, 'link:', resetLink, 'code:', code);
    deliveryDebugState.lastEmail = {
      at: Date.now(),
      to,
      simulated: true,
      ok: true,
      note: 'SMTP not configured'
    };
    return { delivered: false, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text
  });

  deliveryDebugState.lastEmail = {
    at: Date.now(),
    to,
    simulated: false,
    ok: true,
    note: 'Delivered via SMTP'
  };

  return { delivered: true, simulated: false };
}

async function sendResetSms(to, code, resetLink) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  const body = `Your reset code is ${code}. Use it within 10 minutes. You can also reset with this link: ${resetLink}`;

  if (!sid || !token || !from) {
    console.log('[AUTH] Twilio not configured. Simulated SMS delivery.');
    console.log('[AUTH] Reset SMS to:', to, 'code:', code, 'link:', resetLink);
    deliveryDebugState.lastSms = {
      at: Date.now(),
      to,
      simulated: true,
      ok: true,
      note: 'Twilio not configured'
    };
    return { delivered: false, simulated: true };
  }

  const authHeader = Buffer.from(`${sid}:${token}`).toString('base64');
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const payload = new URLSearchParams({
    From: from,
    To: to,
    Body: body
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload
  });

  if (!response.ok) {
    const twilioErr = await response.text();
    deliveryDebugState.lastSms = {
      at: Date.now(),
      to,
      simulated: false,
      ok: false,
      note: `Twilio error ${response.status}`
    };
    throw new Error(`Twilio SMS failed: ${response.status} ${twilioErr}`);
  }

  deliveryDebugState.lastSms = {
    at: Date.now(),
    to,
    simulated: false,
    ok: true,
    note: 'Delivered via Twilio'
  };

  return { delivered: true, simulated: false };
}

function requireAdminDebugKey(req, res, next) {
  if (!ADMIN_DEBUG_KEY) {
    return res.status(503).json({
      ok: false,
      error: 'ADMIN_DEBUG_KEY is not configured on the server'
    });
  }

  const key = String(req.get('x-admin-key') || req.body.adminKey || '').trim();
  if (!key || !safeEq(key, ADMIN_DEBUG_KEY)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  return next();
}

function loadCpuLogicConfig() {
  try {
    delete require.cache[require.resolve('./cpulogic')];
    const loaded = require('./cpulogic');
    if (loaded && typeof loaded === 'object') {
      return loaded;
    }
    return {};
  } catch (_error) {
    return {};
  }
}

function getTeamProfileSeed(teamName) {
  return String(teamName || '').split('').reduce((seed, char) => seed + char.charCodeAt(0), 0);
}

function getProfileLabelForTeam(teamName, profiles, fallbackNames) {
  const sourceProfiles = Array.isArray(profiles) && profiles.length > 0
    ? profiles
    : fallbackNames.map((name) => ({ name }));

  const profileCount = Math.max(1, sourceProfiles.length);
  const profileIndex = getTeamProfileSeed(teamName) % profileCount;
  const profileName = sourceProfiles[profileIndex]?.name || `Profile-${profileIndex + 1}`;
  return `${profileName}#${profileIndex + 1}`;
}

function getProfileNameOnly(profileLabel) {
  return String(profileLabel || '').replace(/#\d+$/, '').trim();
}

function logTeamProfileDebugMap(code, teams, humanMembers) {
  const cfg = loadCpuLogicConfig();
  const silentFallbackNames = ['Balanced', 'Value', 'Sleeper', 'Stars & Scrubs', 'Conservative'];
  const tiedFallbackNames = ['Calm', 'Bulldog', 'Patient', 'Balanced', 'Anxious'];
  const normalizedHumans = new Set((humanMembers || []).map((name) => String(name || '').trim().toLowerCase()));

  const teamProfileRows = (teams || []).map((team) => {
    const teamName = String(team?.name || '').trim();
    if (!teamName) return null;

    const isCpuTeam = /^Team\s+\d+$/i.test(teamName) || !normalizedHumans.has(teamName.toLowerCase());
    if (!isCpuTeam) return null;

    const silentProfile = getProfileLabelForTeam(teamName, cfg?.silentProfiles, silentFallbackNames);
    const tiedProfile = getProfileLabelForTeam(teamName, cfg?.tiedProfiles, tiedFallbackNames);
    const silentApproach = getProfileNameOnly(silentProfile).replace('&', 'and');
    const tiedApproach = getProfileNameOnly(tiedProfile).replace('&', 'and');

    return `${teamName} uses ${silentApproach} approach (silent=${silentProfile}) and ${tiedApproach} approach (tied=${tiedProfile})`;
  }).filter(Boolean);

  if (teamProfileRows.length > 0) {
    console.log(`[CPU PROFILE APPROACH][${code}] ${teamProfileRows.join(' | ')}`);
  }
}

function normalizeCpuLogicPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const normalized = {
    presetName: String(rawPayload.presetName || rawPayload.modelName || 'Custom').trim() || 'Custom',
    updatedAt: Date.now(),
    silent: rawPayload.silent && typeof rawPayload.silent === 'object' ? rawPayload.silent : {},
    tied: rawPayload.tied && typeof rawPayload.tied === 'object' ? rawPayload.tied : {},
    silentProfiles: Array.isArray(rawPayload.silentProfiles) ? rawPayload.silentProfiles : [],
    tiedProfiles: Array.isArray(rawPayload.tiedProfiles) ? rawPayload.tiedProfiles : [],
    silentBidRanges: rawPayload.silentBidRanges && typeof rawPayload.silentBidRanges === 'object' ? rawPayload.silentBidRanges : {}
  };

  return normalized;
}

function serializeCpuLogicConfig(config) {
  return `module.exports = ${JSON.stringify(config, null, 2)};\n`;
}

// Helper function to get effective AV for CPU bidding (learned value if enough data, otherwise static)
async function getEffectiveAV(player) {
  try {
    // Check if we have learned AV data for this player
    const learnedAV = await getPlayerAV(player.id);
    const auctionCount = await getPlayerAuctionCount(player.id);

    // Use learned value if we have 30+ auctions for this player
    if (learnedAV !== null && auctionCount >= 30) {
      console.log(`[CPU LEARNING] Using learned AV $${learnedAV.toFixed(1)} for ${player.name} (${auctionCount} auctions, static: $${player.avgValue})`);
      return learnedAV;
    }

    // Use static AV if no learned data or insufficient auctions
    return player.avgValue;
  } catch (error) {
    console.error('[CPU LEARNING] Error getting effective AV:', error);
    return player.avgValue; // Fallback to static AV
  }
}

const root = path.join(__dirname, '.');

app.use((req, res, next) => {
  const start = Date.now();
  const method = String(req.method || 'GET').toUpperCase();
  const pathKey = String(req.path || '/');

  trafficStats.totalRequests += 1;
  trafficStats.byMethod[method] = (trafficStats.byMethod[method] || 0) + 1;
  trafficStats.byPath[pathKey] = (trafficStats.byPath[pathKey] || 0) + 1;

  res.on('finish', () => {
    const statusKey = String(res.statusCode || 0);
    trafficStats.statusCodes[statusKey] = (trafficStats.statusCodes[statusKey] || 0) + 1;

    trafficStats.recent.push({
      at: Date.now(),
      method,
      path: pathKey,
      status: res.statusCode,
      durationMs: Date.now() - start
    });

    if (trafficStats.recent.length > 100) {
      trafficStats.recent = trafficStats.recent.slice(-100);
    }
  });

  next();
});

app.use(express.static(root, {
  extensions: ['html'],
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }

    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }

    // Cache static assets briefly to reduce repeat load time without making updates hard to pick up.
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Avoid noisy browser 404s when no favicon asset is present.
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

const SPORTS_RSS_SOURCES = [
  {
    name: 'ESPN NFL',
    url: 'https://www.espn.com/espn/rss/nfl/news'
  },
  {
    name: 'Google News Fantasy',
    url: 'https://news.google.com/rss/search?q=NFL+fantasy+football&hl=en-US&gl=US&ceid=US:en'
  }
];

const RSS_CACHE_MS = 5 * 60 * 1000;
let sportsRssCache = {
  fetchedAt: 0,
  items: []
};
const articleMetadataCache = new Map();

function extractMetaContent(html, selectors) {
  for (const selector of selectors) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${selector}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${selector}["'][^>]+content=["']([^"']+)["']`, 'i')
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) return decodeXmlEntities(match[1]);
    }
  }
  return '';
}

async function getArticlePublishedAt(link, fallbackPubDate) {
  if (!link) return fallbackPubDate || '';

  if (articleMetadataCache.has(link)) {
    return articleMetadataCache.get(link) || fallbackPubDate || '';
  }

  let publishedAt = fallbackPubDate || '';

  try {
    const response = await fetch(link, {
      headers: {
        'User-Agent': 'HUSHFantasyDrafts/1.1 (+https://localhost)'
      }
    });

    if (response.ok) {
      const html = await response.text();
      const candidates = [
        extractMetaContent(html, ['article:published_time', 'article:modified_time']),
        extractMetaContent(html, ['datePublished', 'dateModified']),
        extractMetaContent(html, ['pubdate', 'publishdate'])
      ].filter(Boolean);

      if (candidates.length) {
        publishedAt = candidates[0];
      }
    }
  } catch (error) {
    console.warn('[RSS] Article metadata lookup failed for', link, error.message);
  }

  articleMetadataCache.set(link, publishedAt);
  return publishedAt;
}

function decodeXmlEntities(value) {
  if (!value) return '';
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function extractTag(itemXml, tagName) {
  const match = itemXml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? decodeXmlEntities(match[1]) : '';
}

function parseRssItems(xmlText, sourceName) {
  const items = [];
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  itemMatches.forEach((itemXml) => {
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (!title || !link) return;

    items.push({
      title,
      link,
      pubDate,
      source: sourceName
    });
  });

  return items;
}

app.get('/api/rss/sports-news', async (req, res) => {
  try {
    const now = Date.now();
    if (now - sportsRssCache.fetchedAt < RSS_CACHE_MS && sportsRssCache.items.length) {
      return res.json({
        ok: true,
        cached: true,
        items: sportsRssCache.items.slice(0, 9)
      });
    }

    const feedResults = await Promise.allSettled(
      SPORTS_RSS_SOURCES.map(async (feed) => {
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'HUSHFantasyDrafts/1.1 (+https://localhost)'
          }
        });

        if (!response.ok) {
          throw new Error(`${feed.name} responded ${response.status}`);
        }

        const xml = await response.text();
        return parseRssItems(xml, feed.name);
      })
    );

    const combined = [];
    feedResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        combined.push(...result.value);
      }
    });

    const deduped = [];
    const seenLinks = new Set();
    combined.forEach((item) => {
      if (!item.link || seenLinks.has(item.link)) return;
      seenLinks.add(item.link);
      deduped.push(item);
    });

    deduped.sort((a, b) => {
      const aTime = a.pubDate ? Date.parse(a.pubDate) : 0;
      const bTime = b.pubDate ? Date.parse(b.pubDate) : 0;
      return bTime - aTime;
    });

    const enriched = [];
    for (const item of deduped.slice(0, 18)) {
      const publishedAt = await getArticlePublishedAt(item.link, item.pubDate);
      enriched.push({
        ...item,
        publishedAt
      });
    }

    sportsRssCache = {
      fetchedAt: now,
      items: enriched
    };

    res.json({
      ok: true,
      cached: false,
      items: sportsRssCache.items.slice(0, 9)
    });
  } catch (error) {
    console.error('[RSS] Failed to fetch sports feeds:', error.message);
    res.json({
      ok: false,
      degraded: true,
      error: 'Failed to fetch sports RSS feeds',
      items: sportsRssCache.items.slice(0, 9)
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const fullname = String(req.body.fullname || '').trim();
    const email = normalizeEmail(req.body.email);
    const username = String(req.body.username || '').trim();
    const usernameKey = normalizeUsername(username);
    const phone = normalizePhone(req.body.phone);
    const password = String(req.body.password || '');

    if (!fullname || !email || !usernameKey || !password) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (username.length < 3) {
      return res.status(400).json({ ok: false, error: 'Username must be at least 3 characters' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters' });
    }

    const users = await readAuthUsers();
    if (users[usernameKey]) {
      return res.status(409).json({ ok: false, error: 'Username already exists' });
    }

    const emailTaken = Object.values(users).some((user) => normalizeEmail(user.email) === email);
    if (emailTaken) {
      return res.status(409).json({ ok: false, error: 'Email already in use' });
    }

    const { salt, hash } = hashPassword(password);
    users[usernameKey] = {
      fullname,
      email,
      username,
      usernameKey,
      phone,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: Date.now(),
      resetCode: null,
      resetCodeExpiresAt: 0,
      resetToken: null,
      resetTokenExpiresAt: 0
    };

    await writeAuthUsers(users);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[AUTH] Register error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username and password are required' });
    }

    const users = await readAuthUsers();
    const user = users[username] || findUserByIdentifier(users, username);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    if (!verifyUserPassword(user, password)) {
      return res.status(401).json({ ok: false, error: 'Invalid username or password' });
    }

    return res.json({ ok: true, username: user.username });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to login' });
  }
});

app.get('/api/auth/account', async (req, res) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username) {
      return res.status(400).json({ ok: false, error: 'Username is required' });
    }

    const users = await readAuthUsers();
    const { user } = findAccountForRequest(users, username);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'Account not found' });
    }

    return res.json({ ok: true, account: sanitizeAuthUser(user) });
  } catch (error) {
    console.error('[AUTH] Account fetch error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load account' });
  }
});

app.post('/api/auth/account/profile', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const currentPassword = String(req.body.currentPassword || '');
    const fullname = String(req.body.fullname || '').trim();
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);

    if (!username || !currentPassword) {
      return res.status(400).json({ ok: false, error: 'Username and current password are required' });
    }
    if (!fullname || !email) {
      return res.status(400).json({ ok: false, error: 'Full name and email are required' });
    }

    const users = await readAuthUsers();
    const { user, usernameKey } = findAccountForRequest(users, username);
    if (!user || !verifyUserPassword(user, currentPassword)) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
    }

    const emailTaken = Object.values(users).some((candidate) => {
      if (!candidate) return false;
      if (normalizeUsername(candidate.usernameKey || candidate.username) === usernameKey) return false;
      return normalizeEmail(candidate.email) === email;
    });
    if (emailTaken) {
      return res.status(409).json({ ok: false, error: 'Email already in use' });
    }

    user.fullname = fullname;
    user.email = email;
    user.phone = phone;

    await writeAuthUsers(users);
    return res.json({ ok: true, account: sanitizeAuthUser(user), message: 'Account details updated' });
  } catch (error) {
    console.error('[AUTH] Account update error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to update account' });
  }
});

app.post('/api/auth/account/password', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: 'Username, current password, and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }

    const users = await readAuthUsers();
    const { user } = findAccountForRequest(users, username);
    if (!user || !verifyUserPassword(user, currentPassword)) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.resetCode = null;
    user.resetCodeExpiresAt = 0;
    user.resetToken = null;
    user.resetTokenExpiresAt = 0;

    await writeAuthUsers(users);
    return res.json({ ok: true, message: 'Password updated' });
  } catch (error) {
    console.error('[AUTH] Password change error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to change password' });
  }
});

app.post('/api/auth/account/export', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const currentPassword = String(req.body.currentPassword || '');

    if (!username || !currentPassword) {
      return res.status(400).json({ ok: false, error: 'Username and current password are required' });
    }

    const users = await readAuthUsers();
    const { user } = findAccountForRequest(users, username);
    if (!user || !verifyUserPassword(user, currentPassword)) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
    }

    return res.json({
      ok: true,
      export: {
        account: sanitizeAuthUser(user),
        resetStatus: {
          hasResetCode: !!user.resetCode,
          hasResetToken: !!user.resetToken
        }
      }
    });
  } catch (error) {
    console.error('[AUTH] Account export error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to export account data' });
  }
});

app.post('/api/auth/account/delete', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const currentPassword = String(req.body.currentPassword || '');

    if (!username || !currentPassword) {
      return res.status(400).json({ ok: false, error: 'Username and current password are required' });
    }

    const users = await readAuthUsers();
    const { user, usernameKey } = findAccountForRequest(users, username);
    if (!user || !verifyUserPassword(user, currentPassword)) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect' });
    }

    delete users[usernameKey];
    await writeAuthUsers(users);
    return res.json({ ok: true, message: 'Account deleted permanently' });
  } catch (error) {
    console.error('[AUTH] Account delete error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to delete account' });
  }
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  try {
    const identifier = String(req.body.identifier || '').trim();
    const requestedChannel = String(req.body.channel || 'email').toLowerCase();

    if (!identifier) {
      return res.status(400).json({ ok: false, error: 'Identifier is required' });
    }

    const users = await readAuthUsers();
    const user = findUserByIdentifier(users, identifier);

    if (!user) {
      return res.json({
        ok: true,
        message: 'If an account matches that identifier, reset instructions were sent.'
      });
    }

    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const resetToken = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    user.resetCode = resetCode;
    user.resetCodeExpiresAt = now + RESET_CODE_TTL_MS;
    user.resetToken = resetToken;
    user.resetTokenExpiresAt = now + RESET_TOKEN_TTL_MS;

    await writeAuthUsers(users);

    const resetLink = `${buildBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(resetToken)}`;
    let channelUsed = 'email';
    let delivery;

    if (requestedChannel === 'sms' && user.phone) {
      channelUsed = 'sms';
      delivery = await sendResetSms(user.phone, resetCode, resetLink);
    } else {
      delivery = await sendResetEmail(user.email, user.username, resetLink, resetCode);
    }

    return res.json({
      ok: true,
      channel: channelUsed,
      simulated: !!delivery.simulated,
      maskedDestination: channelUsed === 'sms' ? maskPhone(user.phone) : maskEmail(user.email),
      message: 'Reset instructions sent.'
    });
  } catch (error) {
    console.error('[AUTH] Reset request error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to send reset instructions' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const identifier = String(req.body.identifier || '').trim();
    const code = String(req.body.code || '').trim();
    const newPassword = String(req.body.newPassword || '');

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }

    const users = await readAuthUsers();
    const now = Date.now();

    let user = token ? findUserByResetToken(users, token) : null;
    let valid = false;

    if (user && user.resetToken && safeEq(user.resetToken, token) && user.resetTokenExpiresAt > now) {
      valid = true;
    }

    if (!valid && identifier && code) {
      user = findUserByIdentifier(users, identifier);
      if (
        user &&
        user.resetCode &&
        safeEq(String(user.resetCode), code) &&
        Number(user.resetCodeExpiresAt || 0) > now
      ) {
        valid = true;
      }
    }

    if (!valid || !user) {
      return res.status(400).json({ ok: false, error: 'Invalid or expired reset token/code' });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    user.resetCode = null;
    user.resetCodeExpiresAt = 0;
    user.resetToken = null;
    user.resetTokenExpiresAt = 0;

    await writeAuthUsers(users);
    return res.json({ ok: true, message: 'Password reset successful' });
  } catch (error) {
    console.error('[AUTH] Reset password error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to reset password' });
  }
});

app.get('/api/admin/delivery/status', requireAdminDebugKey, (req, res) => {
  const smtpConfigured = !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    (process.env.SMTP_FROM || process.env.SMTP_USER)
  );

  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );

  return res.json({
    ok: true,
    smtpConfigured,
    twilioConfigured,
    appBaseUrl: process.env.APP_BASE_URL || null,
    lastEmail: deliveryDebugState.lastEmail,
    lastSms: deliveryDebugState.lastSms
  });
});

app.post('/api/admin/delivery/test-email', requireAdminDebugKey, async (req, res) => {
  try {
    const to = normalizeEmail(req.body.to);
    const username = String(req.body.username || 'Admin').trim();
    if (!to) {
      return res.status(400).json({ ok: false, error: 'Valid destination email is required' });
    }

    const fakeCode = String(Math.floor(100000 + Math.random() * 900000));
    const fakeToken = crypto.randomBytes(20).toString('hex');
    const resetLink = `${buildBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(fakeToken)}`;
    const result = await sendResetEmail(to, username, resetLink, fakeCode);

    return res.json({ ok: true, simulated: !!result.simulated, to });
  } catch (error) {
    console.error('[ADMIN] Test email failed:', error);
    return res.status(500).json({ ok: false, error: 'Failed to send test email' });
  }
});

app.post('/api/admin/delivery/test-sms', requireAdminDebugKey, async (req, res) => {
  try {
    const to = normalizePhone(req.body.to);
    if (!to) {
      return res.status(400).json({ ok: false, error: 'Destination phone number is required' });
    }

    const fakeCode = String(Math.floor(100000 + Math.random() * 900000));
    const fakeToken = crypto.randomBytes(20).toString('hex');
    const resetLink = `${buildBaseUrl(req)}/reset-password.html?token=${encodeURIComponent(fakeToken)}`;
    const result = await sendResetSms(to, fakeCode, resetLink);

    return res.json({ ok: true, simulated: !!result.simulated, to });
  } catch (error) {
    console.error('[ADMIN] Test SMS failed:', error);
    return res.status(500).json({ ok: false, error: 'Failed to send test SMS' });
  }
});

app.get('/api/admin/traffic', requireAdminDebugKey, (req, res) => {
  const topPaths = Object.entries(trafficStats.byPath)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([pathName, count]) => ({ path: pathName, count }));

  return res.json({
    ok: true,
    startedAt: trafficStats.startedAt,
    uptimeSeconds: Math.floor((Date.now() - trafficStats.startedAt) / 1000),
    totalRequests: trafficStats.totalRequests,
    byMethod: trafficStats.byMethod,
    statusCodes: trafficStats.statusCodes,
    topPaths,
    recent: trafficStats.recent
  });
});

app.get('/api/admin/system-status', requireAdminDebugKey, async (req, res) => {
  try {
    const users = await readAuthUsers();
    const uniqueEmails = new Set(
      Object.values(users)
        .map((user) => normalizeEmail(user && user.email))
        .filter(Boolean)
    );
    const rankingsData = await readDefaultRankingsData();

    const smtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
    );

    const twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );

    return res.json({
      ok: true,
      serverTime: Date.now(),
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsage: process.memoryUsage(),
      authUsersCount: Object.keys(users).length,
      authEmailsCount: uniqueEmails.size,
      defaultRankingsCount: rankingsData.players.length,
      defaultRankingsSource: rankingsData.sourceFile,
      smtpConfigured,
      twilioConfigured,
      lastEmail: deliveryDebugState.lastEmail,
      lastSms: deliveryDebugState.lastSms
    });
  } catch (error) {
    console.error('[ADMIN] System status error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load system status' });
  }
});

app.get('/api/admin/all-data', requireAdminDebugKey, async (req, res) => {
  try {
    const usersMap = await readAuthUsers();
    const uniqueEmails = new Set(
      Object.values(usersMap)
        .map((user) => normalizeEmail(user && user.email))
        .filter(Boolean)
    );

    const userRows = Object.values(usersMap)
      .map((user) => ({
        username: String(user.username || user.usernameKey || '').trim(),
        email: normalizeEmail(user.email),
        created_at: user.createdAt || user.created_at || null,
        is_premium: !!user.isPremium
      }))
      .sort((a, b) => String(a.username || '').localeCompare(String(b.username || '')));

    const positionEntries = await Promise.all(
      Array.from(VALID_POSITIONS).map(async (position) => {
        const data = await readPositionRankingsData(position);
        return [position, data.players];
      })
    );
    const rankings = positionEntries.reduce((acc, [position, players]) => {
      acc[position] = players;
      return acc;
    }, {});

    const defaultRankings = await readDefaultRankingsData();
    const draftRows = Object.entries(drafts)
      .map(([code, draft]) => ({
        code,
        owner: String((draft && draft.host) || (draft && draft.members && draft.members[0]) || '').trim(),
        status: draft && draft.closed ? 'closed' : draft && draft.draftState ? 'active' : 'pending'
      }))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));

    const smtpConfigured = !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      (process.env.SMTP_FROM || process.env.SMTP_USER)
    );

    const twilioConfigured = !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
    );

    return res.json({
      ok: true,
      users: userRows,
      drafts: draftRows,
      rankings,
      stats: {
        serverTime: Date.now(),
        uptimeSeconds: Math.floor(process.uptime()),
        totalRequests: trafficStats.totalRequests,
        authUsersCount: Object.keys(usersMap).length,
        authEmailsCount: uniqueEmails.size,
        defaultRankingsCount: defaultRankings.players.length,
        defaultRankingsSource: defaultRankings.sourceFile,
        smtpConfigured,
        twilioConfigured,
        lastEmail: deliveryDebugState.lastEmail,
        lastSms: deliveryDebugState.lastSms
      }
    });
  } catch (error) {
    console.error('[ADMIN] All-data error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load all admin data' });
  }
});

app.get('/api/admin/cpu-logic', requireAdminDebugKey, async (_req, res) => {
  try {
    const config = loadCpuLogicConfig();
    return res.json({ ok: true, sourceFile: 'cpulogic.js', config });
  } catch (error) {
    console.error('[ADMIN] CPU logic read error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load cpulogic.js' });
  }
});

// Public endpoint to get current CPU tuning preset name (for browser console logging)
app.get('/api/public/cpu-logic-preset', (_req, res) => {
  try {
    const config = loadCpuLogicConfig();
    return res.json({
      ok: true,
      presetName: config && config.presetName ? String(config.presetName).trim() : 'Unknown',
      sourceFile: 'cpulogic.js'
    });
  } catch (error) {
    return res.json({
      ok: false,
      presetName: 'Error',
      sourceFile: 'cpulogic.js'
    });
  }
});

app.get('/api/public/av-trends', async (req, res) => {
  try {
    const limit = Math.min(300, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const minAuctions = Math.max(1, Number.parseInt(req.query.minAuctions, 10) || 1);
    const rows = await getPlayerAvTrends(limit, minAuctions);

    const players = (Array.isArray(rows) ? rows : []).map((row) => {
      const reportedAv = Number(row && row.reported_av || 0);
      const previousReportedAv = Number(row && row.previous_reported_av || reportedAv);
      const delta = Number(row && row.av_step_delta || (reportedAv - previousReportedAv));

      return {
        playerId: Number(row && row.player_id || 0),
        playerName: String(row && row.player_name || ''),
        position: String(row && row.position || ''),
        totalAuctions: Number(row && row.total_auctions || 0),
        marketAvgValue: Number(row && row.avg_value || 0),
        reportedAv,
        previousReportedAv,
        delta,
        direction: delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat'),
        minValue: Number(row && row.min_value || 0),
        maxValue: Number(row && row.max_value || 0),
        lastUpdated: row && row.last_updated ? String(row.last_updated) : null
      };
    });

    return res.json({
      ok: true,
      count: players.length,
      limit,
      minAuctions,
      players
    });
  } catch (error) {
    console.error('[PUBLIC] AV trends error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to load AV trends' });
  }
});

app.post('/api/admin/cpu-logic/save', requireAdminDebugKey, async (req, res) => {
  try {
    const incoming = req.body && typeof req.body === 'object'
      ? (req.body.config && typeof req.body.config === 'object' ? req.body.config : req.body)
      : null;
    const normalized = normalizeCpuLogicPayload(incoming);

    if (!normalized) {
      return res.status(400).json({ ok: false, error: 'Invalid CPU logic payload' });
    }

    await fs.writeFile(CPU_LOGIC_FILE, serializeCpuLogicConfig(normalized), 'utf8');
    return res.json({
      ok: true,
      sourceFile: 'cpulogic.js',
      updatedAt: normalized.updatedAt,
      presetName: normalized.presetName
    });
  } catch (error) {
    console.error('[ADMIN] CPU logic save error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to save cpulogic.js' });
  }
});

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getTargetRosterSizeFromSettings(settings) {
  const safe = settings || {};
  return ['QB', 'WR', 'RB', 'TE', 'FLEX', 'K', 'DEF', 'BN']
    .reduce((sum, key) => sum + Math.max(0, Number(safe[key] || 0)), 0);
}

function buildSimulationRosterLimits(rosterSettings) {
  const settings = normalizeRosterSettingsForSummary(rosterSettings);
  const bench = Math.max(0, Number(settings.BN || 0));
  const flex = Math.max(0, Number(settings.FLEX || 0));

  return {
    QB: { min: settings.QB, max: settings.QB + Math.min(2, bench) + 1 },
    RB: { min: settings.RB, max: settings.RB + bench + flex },
    WR: { min: settings.WR, max: settings.WR + bench + flex },
    TE: { min: settings.TE, max: settings.TE + Math.min(bench, 4) + flex },
    K: { min: settings.K, max: settings.K + 1 },
    DEF: { min: settings.DEF, max: settings.DEF + 1 }
  };
}

function clonePlayersForSimulation(players) {
  return (Array.isArray(players) ? players : []).map((player, index) => ({
    id: Number(player && player.id) || (index + 1),
    name: String(player && player.name || '').trim(),
    position: normalizePosition(player && player.position),
    team: String(player && player.team || '').trim().toUpperCase(),
    avgValue: toNumber(player && player.avgValue, 1),
    prerank: toNumber(player && player.prerank, index + 1),
    positionRank: toNumber(player && player.positionRank, toNumber(player && player.prerank, index + 1)),
    owner: null,
    shown: false,
    bid: 0
  })).filter(player => player.name && player.position);
}

function buildSimulationPlayerPool(players, { poolTargetSize, teamCount }) {
  const sorted = (Array.isArray(players) ? players : [])
    .slice()
    .sort((a, b) => Number(a?.prerank || 9999) - Number(b?.prerank || 9999));

  const targetSize = Math.max(120, Number(poolTargetSize) || 260);
  const pool = sorted.slice(0, Math.min(targetSize, sorted.length));
  const seenIds = new Set(pool.map(player => Number(player?.id || 0)));
  const requiredByPosition = Math.max(6, Number(teamCount || 10) + 2);

  ['K', 'DEF'].forEach((position) => {
    const currentCount = pool.filter(player => normalizePosition(player?.position) === position).length;
    if (currentCount >= requiredByPosition) return;

    const needed = requiredByPosition - currentCount;
    const candidates = sorted
      .filter(player => normalizePosition(player?.position) === position && !seenIds.has(Number(player?.id || 0)))
      .slice(0, needed);

    candidates.forEach((candidate) => {
      pool.push(candidate);
      seenIds.add(Number(candidate?.id || 0));
    });
  });

  return pool;
}

const SIM_AJ_ROUND_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const SIM_AJ_REVERSED_START_POSITIONS = new Set(['WR', 'TE', 'K']);
const SIM_PAGE_SIZE = 12;
const SIM_PAGE1_REQUIREMENTS = [
  { pos: 'QB', min: 2 },
  { pos: 'RB', min: 2 },
  { pos: 'WR', min: 2 },
  { pos: 'TE', min: 1 },
  { pos: 'K', min: 1 },
  { pos: 'DEF', min: 1 }
];
const SIM_PAGE2_REQUIREMENTS = [
  { pos: 'QB', min: 1 },
  { pos: 'RB', min: 1 },
  { pos: 'WR', min: 1 },
  { pos: 'TE', min: 1 }
];

function getSimulationRankSortValue(player) {
  const positionRank = Number.parseInt(player && player.positionRank, 10);
  if (Number.isFinite(positionRank)) return positionRank;
  const prerank = Number.parseInt(player && player.prerank, 10);
  if (Number.isFinite(prerank)) return prerank;
  return 9999;
}

function compareSimulationPlayersForAjSlot(a, b) {
  const positionDelta = getSimulationRankSortValue(a) - getSimulationRankSortValue(b);
  if (positionDelta !== 0) return positionDelta;
  const overallDelta = (Number.parseInt(a && a.prerank, 10) || 9999) - (Number.parseInt(b && b.prerank, 10) || 9999);
  if (overallDelta !== 0) return overallDelta;
  return String(a && a.name || '').localeCompare(String(b && b.name || ''));
}

function getSimulationAjSlotAssignment(positionRank, position = '') {
  const normalizedRank = Math.max(1, Number.parseInt(positionRank, 10) || 1);
  const zeroBasedRank = normalizedRank - 1;
  const blockIndex = Math.floor(zeroBasedRank / 10);
  const offset = zeroBasedRank % 10;
  const normalizedPosition = String(position || '').toUpperCase();
  const startsReversed = SIM_AJ_REVERSED_START_POSITIONS.has(normalizedPosition);
  const isPageOneBlock = startsReversed ? (blockIndex % 2 === 1) : (blockIndex % 2 === 0);
  const roundIndex = isPageOneBlock ? offset : (SIM_AJ_ROUND_CODES.length - 1 - offset);
  const page = isPageOneBlock ? 1 : 2;

  return {
    round: roundIndex + 1,
    page,
    code: `${SIM_AJ_ROUND_CODES[roundIndex]}${page}`
  };
}

function normalizeSimulationAjRoundOrder(raw) {
  if (!Array.isArray(raw)) return SIM_AJ_ROUND_CODES.slice();
  const normalized = raw
    .map(code => String(code || '').trim().toUpperCase())
    .filter(code => SIM_AJ_ROUND_CODES.includes(code));
  const deduped = [];
  normalized.forEach((code) => {
    if (!deduped.includes(code)) deduped.push(code);
  });
  SIM_AJ_ROUND_CODES.forEach((code) => {
    if (!deduped.includes(code)) deduped.push(code);
  });
  return deduped.slice(0, SIM_AJ_ROUND_CODES.length);
}

function getSimulationPositionMinimums(settings) {
  const safe = settings || SUMMARY_DEFAULT_ROSTER_SETTINGS;
  return {
    QB: Number(safe.QB || 0) > 0 ? Math.max(1, Number(safe.QB || 0)) : 0,
    RB: Number(safe.RB || 0) > 0 ? Math.max(1, Number(safe.RB || 0)) : 0,
    WR: Number(safe.WR || 0) > 0 ? Math.max(1, Number(safe.WR || 0)) : 0,
    TE: Number(safe.TE || 0) > 0 ? Math.max(1, Number(safe.TE || 0)) : 0,
    K: Number(safe.K || 0) > 0 ? Math.max(1, Number(safe.K || 0)) : 0,
    DEF: Number(safe.DEF || 0) > 0 ? Math.max(1, Number(safe.DEF || 0)) : 0
  };
}

function getSimulationRemainingUndraftedPlayers(allPlayers, excludePlayers = []) {
  const excluded = new Set((Array.isArray(excludePlayers) ? excludePlayers : []).map(player => Number(player && player.id) || 0));
  return (Array.isArray(allPlayers) ? allPlayers : [])
    .filter(player => !player.owner && !player.shown && !excluded.has(Number(player && player.id) || 0));
}

function getSimulationMaxSelectionsForCurrentRound(position, allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers = [], currentSelected = []) {
  const totalUndraftedAtPosition = (Array.isArray(allPlayers) ? allPlayers : []).filter(player => (
    !player.owner
    && !player.shown
    && normalizePosition(player && player.position) === position
  )).length;

  const roundsAfterCurrent = Math.max(0, Number(totalRounds || 10) - Number(currentRound || 1));
  const futureReserve = roundsAfterCurrent * (Number(roundPositionMinimums && roundPositionMinimums[position] || 0));
  const currentRoundMinimum = Math.min(Number(roundPositionMinimums && roundPositionMinimums[position] || 0), totalUndraftedAtPosition);
  const maxCurrentRoundTotal = Math.max(currentRoundMinimum, totalUndraftedAtPosition - futureReserve);

  const alreadyCommitted = (Array.isArray(excludePlayers) ? excludePlayers : []).filter(player => normalizePosition(player && player.position) === position).length
    + (Array.isArray(currentSelected) ? currentSelected : []).filter(player => normalizePosition(player && player.position) === position).length;

  return Math.max(0, maxCurrentRoundTotal - alreadyCommitted);
}

function canSelectSimulationPlayerForCurrentRound(player, allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers = [], currentSelected = []) {
  return getSimulationMaxSelectionsForCurrentRound(
    normalizePosition(player && player.position),
    allPlayers,
    currentRound,
    totalRounds,
    roundPositionMinimums,
    excludePlayers,
    currentSelected
  ) > 0;
}

function countSimulationPlayersByPosition(selectedPlayers, position) {
  return (Array.isArray(selectedPlayers) ? selectedPlayers : []).filter(player => normalizePosition(player && player.position) === position).length;
}

function getBestAvailableSimulationPlayers(allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers = [], filterFn = null) {
  return getSimulationRemainingUndraftedPlayers(allPlayers, excludePlayers)
    .filter(player => canSelectSimulationPlayerForCurrentRound(player, allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers, []))
    .filter(player => !filterFn || filterFn(player))
    .sort(compareSimulationPlayersForAjSlot);
}

function pickSimulationPlayersForMinimum(position, countNeeded, selectedPlayers, preferredPool, fallbackPool, allPlayers, currentRound, totalRounds, roundPositionMinimums) {
  const picks = [];
  const tryPools = [preferredPool, fallbackPool];

  for (const pool of tryPools) {
    for (const player of (Array.isArray(pool) ? pool : [])) {
      if (picks.length >= countNeeded) break;
      if (normalizePosition(player && player.position) !== position) continue;
      if (selectedPlayers.includes(player) || picks.includes(player)) continue;
      if (!canSelectSimulationPlayerForCurrentRound(player, allPlayers, currentRound, totalRounds, roundPositionMinimums, selectedPlayers.concat(picks), [])) continue;
      picks.push(player);
    }
    if (picks.length >= countNeeded) break;
  }

  return picks;
}

function buildSimulationAjPagePlayers(allPlayers, roundCode, pageNumber, pageSize, excludePlayers, requirements, currentRound, totalRounds, roundPositionMinimums) {
  const availablePlayers = getSimulationRemainingUndraftedPlayers(allPlayers, excludePlayers)
    .filter(player => canSelectSimulationPlayerForCurrentRound(player, allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers, []));

  const assignedPlayers = availablePlayers
    .filter((player) => {
      const assignment = getSimulationAjSlotAssignment(player.positionRank, player.position);
      return assignment.code === `${roundCode}${pageNumber}`;
    })
    .sort(compareSimulationPlayersForAjSlot);

  let selectedPlayers = assignedPlayers.slice(0, pageSize);

  (Array.isArray(requirements) ? requirements : []).forEach(({ pos, min }) => {
    const currentCount = countSimulationPlayersByPosition(selectedPlayers, pos);
    const missing = Math.max(0, Number(min || 0) - currentCount);
    if (missing === 0) return;

    const fallbackPool = availablePlayers
      .filter(player => !selectedPlayers.includes(player))
      .sort(compareSimulationPlayersForAjSlot);

    const additions = pickSimulationPlayersForMinimum(
      pos,
      missing,
      selectedPlayers,
      assignedPlayers,
      fallbackPool,
      allPlayers,
      currentRound,
      totalRounds,
      roundPositionMinimums
    );

    additions.forEach((player) => {
      if (selectedPlayers.length < pageSize) {
        selectedPlayers.push(player);
        return;
      }

      const replacement = selectedPlayers
        .map((selectedPlayer, index) => ({ selectedPlayer, index }))
        .filter(entry => countSimulationPlayersByPosition(selectedPlayers, normalizePosition(entry.selectedPlayer && entry.selectedPlayer.position)) > ((requirements.find(req => req.pos === normalizePosition(entry.selectedPlayer && entry.selectedPlayer.position)) || {}).min || 0))
        .sort((a, b) => compareSimulationPlayersForAjSlot(b.selectedPlayer, a.selectedPlayer))[0];

      if (replacement) {
        selectedPlayers[replacement.index] = player;
      }
    });

    selectedPlayers = selectedPlayers.sort(compareSimulationPlayersForAjSlot).slice(0, pageSize);
  });

  if (selectedPlayers.length < pageSize) {
    const fillers = getBestAvailableSimulationPlayers(allPlayers, currentRound, totalRounds, roundPositionMinimums, excludePlayers.concat(selectedPlayers), player => !selectedPlayers.includes(player));
    for (const player of fillers) {
      if (selectedPlayers.length >= pageSize) break;
      selectedPlayers.push(player);
    }
  }

  return selectedPlayers.sort(compareSimulationPlayersForAjSlot).slice(0, pageSize);
}

function sampleRandomItems(input, count) {
  const source = Array.isArray(input) ? input.slice() : [];
  for (let i = source.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [source[i], source[j]] = [source[j], source[i]];
  }
  return source.slice(0, Math.max(0, Math.min(count, source.length)));
}

function sampleFromTopRankWindow(players, count, windowSize) {
  const sorted = (Array.isArray(players) ? players : [])
    .slice()
    .sort((a, b) => Number(a?.prerank || 9999) - Number(b?.prerank || 9999));

  const selected = [];
  const targetCount = Math.max(0, Number(count) || 0);
  const safeWindow = Math.max(8, Number(windowSize) || 0);

  while (selected.length < targetCount && sorted.length > 0) {
    const poolSize = Math.min(safeWindow, sorted.length);
    const weightedIdx = Math.floor(Math.pow(Math.random(), 1.7) * poolSize);
    selected.push(sorted.splice(weightedIdx, 1)[0]);
  }

  return selected;
}

function percentile(values, pct) {
  const nums = (Array.isArray(values) ? values : [])
    .map(v => Number(v))
    .filter(v => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (nums.length === 0) return 0;

  const safePct = Math.max(0, Math.min(100, Number(pct) || 0));
  const rank = (safePct / 100) * (nums.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return nums[lower];
  const weight = rank - lower;
  return nums[lower] * (1 - weight) + nums[upper] * weight;
}

function calculateRealismScore({
  completionRate,
  medianBudgetRemaining,
  p90BudgetRemaining,
  contestRate,
  bidParticipationRate,
  avgBidsPerActiveAuction,
  starterCompletionRate,
  avgStarterCompletionRound
}) {
  const completionScore = Math.max(0, Math.min(100, Number(completionRate || 0) * 100));

  const medianPenalty = Math.max(0, Number(medianBudgetRemaining || 0) - 55) * 0.6;
  const p90Penalty = Math.max(0, Number(p90BudgetRemaining || 0) - 95) * 0.45;
  const budgetScore = Math.max(0, Math.min(100, 100 - medianPenalty - p90Penalty));

  const contestComponent = Math.max(0, Math.min(1, Number(contestRate || 0) / 0.35));
  const participationComponent = Math.max(0, Math.min(1, Number(bidParticipationRate || 0) / 0.78));
  const bidsPerAuctionComponent = Math.max(0, Math.min(1, Number(avgBidsPerActiveAuction || 0) / 4.5));
  const competitionScore = Math.round((
    (contestComponent * 0.45)
    + (participationComponent * 0.35)
    + (bidsPerAuctionComponent * 0.20)
  ) * 100);

  const completionComponent = Math.max(0, Math.min(1, Number(starterCompletionRate || 0)));
  const roundPenalty = avgStarterCompletionRound === null || avgStarterCompletionRound === undefined
    ? 1
    : Math.max(0, Math.min(1, (Number(avgStarterCompletionRound) - 5.5) / 3.5));
  const timingScore = Math.round((completionComponent * (1 - (roundPenalty * 0.55))) * 100);

  const realismScore = Math.round(
    (completionScore * 0.35)
    + (budgetScore * 0.30)
    + (competitionScore * 0.20)
    + (timingScore * 0.15)
  );

  return {
    realismScore: Math.max(0, Math.min(100, realismScore)),
    breakdown: {
      completionScore: Math.max(0, Math.min(100, Math.round(completionScore))),
      budgetScore: Math.max(0, Math.min(100, Math.round(budgetScore))),
      competitionScore: Math.max(0, Math.min(100, competitionScore)),
      timingScore: Math.max(0, Math.min(100, timingScore))
    }
  };
}

function countRosterByPosition(roster) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
  (Array.isArray(roster) ? roster : []).forEach((player) => {
    const pos = normalizePosition(player && player.position);
    if (counts[pos] !== undefined) counts[pos] += 1;
  });
  return counts;
}

function hasCompletedStarters(roster, settings) {
  const safeSettings = settings || SUMMARY_DEFAULT_ROSTER_SETTINGS;
  const counts = countRosterByPosition(roster);

  const baseMet =
    counts.QB >= Number(safeSettings.QB || 0)
    && counts.RB >= Number(safeSettings.RB || 0)
    && counts.WR >= Number(safeSettings.WR || 0)
    && counts.TE >= Number(safeSettings.TE || 0)
    && counts.K >= Number(safeSettings.K || 0)
    && counts.DEF >= Number(safeSettings.DEF || 0);
  if (!baseMet) return false;

  const flexNeeded = Math.max(0, Number(safeSettings.FLEX || 0));
  if (flexNeeded === 0) return true;

  const flexEligible =
    Math.max(0, counts.RB - Number(safeSettings.RB || 0))
    + Math.max(0, counts.WR - Number(safeSettings.WR || 0))
    + Math.max(0, counts.TE - Number(safeSettings.TE || 0));

  return flexEligible >= flexNeeded;
}

function buildSimulationRoundPlayers(allPlayers, playersPerRound, roundNumber, totalRounds, roundPositionMinimums) {
  const remaining = (allPlayers || []).filter(player => !player.owner && !player.shown);
  if (remaining.length === 0) return [];

  const effectiveRound = Math.max(1, Number(roundNumber || 1));
  const effectiveRounds = Math.max(1, Number(totalRounds || 10));
  const ajRoundOrder = normalizeSimulationAjRoundOrder(SIM_AJ_ROUND_CODES);
  const roundCode = ajRoundOrder[Math.max(0, effectiveRound - 1)] || SIM_AJ_ROUND_CODES[Math.max(0, effectiveRound - 1)] || SIM_AJ_ROUND_CODES[0];
  const desiredCount = SIM_PAGE_SIZE * 2;

  const page1 = buildSimulationAjPagePlayers(
    allPlayers,
    roundCode,
    1,
    SIM_PAGE_SIZE,
    [],
    SIM_PAGE1_REQUIREMENTS,
    effectiveRound,
    effectiveRounds,
    roundPositionMinimums
  );
  const page2 = buildSimulationAjPagePlayers(
    allPlayers,
    roundCode,
    2,
    SIM_PAGE_SIZE,
    page1,
    SIM_PAGE2_REQUIREMENTS,
    effectiveRound,
    effectiveRounds,
    roundPositionMinimums
  );

  let combined = page1.concat(page2);
  if (combined.length < desiredCount) {
    const fillers = getBestAvailableSimulationPlayers(
      allPlayers,
      effectiveRound,
      effectiveRounds,
      roundPositionMinimums,
      combined,
      player => !combined.includes(player)
    );
    combined = combined.concat(fillers.slice(0, Math.max(0, desiredCount - combined.length)));
  }

  const selected = combined.slice(0, desiredCount);
  selected.forEach((player) => {
    player.shown = true;
  });

  return selected;
}

function applySimulationWinner(team, player, pricePaid) {
  const safePrice = Math.max(1, Math.min(Number(pricePaid || 0), Number(team && team.budget || 0)));
  if (!team || !player || safePrice <= 0) return false;

  team.budget = Math.max(0, Number(team.budget || 0) - safePrice);
  if (!Array.isArray(team.roster)) team.roster = [];
  team.roster.push({
    id: player.id,
    name: player.name,
    position: player.position,
    bid: safePrice,
    prerank: player.prerank,
    positionRank: player.positionRank
  });

  player.owner = team.name;
  player.bid = safePrice;
  player.shown = true;
  return true;
}

function getSimulationRosterCounts(team) {
  return countRosterByPosition(Array.isArray(team && team.roster) ? team.roster : []);
}

function isLowAvSpecialist(player) {
  const pos = normalizePosition(player && player.position);
  const av = Math.max(0, Number(player && player.avgValue || 0));
  return (pos === 'K' || pos === 'DEF') && av <= 1;
}

function teamNeedsPositionNow(team, position, rosterLimits) {
  const pos = normalizePosition(position);
  const minRequired = Math.max(1, Number(rosterLimits && rosterLimits[pos] && rosterLimits[pos].min || 1));
  const counts = countRosterByPosition(Array.isArray(team && team.roster) ? team.roster : []);
  return Number(counts[pos] || 0) < minRequired;
}

function sampleOptionalSpecialistBidCap() {
  const roll = Math.random();
  if (roll < 0.10) return 0;   // 10%
  if (roll < 0.70) return 1;   // 60%
  if (roll < 0.95) return 2;   // 25%
  return 3;                    // 5%
}

function sampleSpecialistCapWhenNeeded() {
  const roll = Math.random();
  if (roll < 0.60) return 1;
  if (roll < 0.90) return 2;
  return 3;
}

function capCpuBidForSpecialists(player, amount, roundNumber) {
  const pos = String(player && player.position || '').toUpperCase();
  const safeAmount = Math.max(0, Number(amount || 0));
  const isLate = Number(roundNumber || 0) >= 7;
  const av = Math.max(1, Number(player && player.avgValue || 1));
  if (pos === 'K') {
    const kCap = isLate ? Math.max(2, Math.round(av * 1.2)) : Math.max(2, Math.round(av * 1.5));
    return Math.min(safeAmount, kCap);
  }
  if (pos === 'DEF') {
    const defCap = isLate ? Math.max(3, Math.round(av * 1.35)) : Math.max(4, Math.round(av * 1.6));
    return Math.min(safeAmount, defCap);
  }
  return safeAmount;
}

function shuffleInPlace(items) {
  const arr = Array.isArray(items) ? items : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function applySpecialistParticipationGate(player, bids, rosterLimits) {
  if (!isLowAvSpecialist(player)) return Array.isArray(bids) ? bids : [];

  const safeBids = Array.isArray(bids) ? bids : [];
  const requiredBids = [];
  const optionalCpuBids = [];
  const protectedNonCpuBids = [];

  safeBids.forEach((entry) => {
    const isCpuBid = String(entry && entry.source || 'cpu') !== 'user';
    if (!isCpuBid) {
      protectedNonCpuBids.push(entry);
      return;
    }

    const needsPos = teamNeedsPositionNow(entry && entry.team, player && player.position, rosterLimits);
    if (needsPos) {
      requiredBids.push(entry);
    } else {
      optionalCpuBids.push(entry);
    }
  });

  const neededCount = requiredBids.length;
  const optionalCount = optionalCpuBids.length;
  if (neededCount === 0 && optionalCount === 0) {
    return protectedNonCpuBids;
  }

  // Hard cap: AV=1 specialist auctions should never have more than 3 total active bids.
  const targetTotal = neededCount > 0 ? sampleSpecialistCapWhenNeeded() : sampleOptionalSpecialistBidCap();
  if (targetTotal <= 0) {
    return protectedNonCpuBids;
  }

  const selected = [];
  const neededPool = shuffleInPlace(requiredBids.slice());
  const optionalPool = shuffleInPlace(optionalCpuBids.slice());

  while (selected.length < targetTotal && neededPool.length > 0) {
    selected.push(neededPool.shift());
  }
  while (selected.length < targetTotal && optionalPool.length > 0) {
    selected.push(optionalPool.shift());
  }

  return protectedNonCpuBids.concat(selected);
}

function gateCpuBidsForRound(roundPlayers, teams, cpuBids, rosterLimits, maxRosterSize, roundNumber) {
  const safePlayers = Array.isArray(roundPlayers) ? roundPlayers : [];
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeCpuBids = cpuBids && typeof cpuBids === 'object' ? cpuBids : {};
  const gatedByTeam = {};

  safePlayers.forEach((player) => {
    const candidates = [];

    Object.keys(safeCpuBids).forEach((teamName) => {
      const team = safeTeams.find(entry => String(entry && entry.name || '') === String(teamName));
      if (!team) return;
      if ((Array.isArray(team.roster) ? team.roster.length : 0) >= maxRosterSize) return;
      if (!isValidRosterAddition(team, player, rosterLimits, maxRosterSize)) return;

      const bidEntry = (safeCpuBids[teamName] || []).find(entry => Number(entry?.player?.id) === Number(player.id));
      if (!bidEntry) return;

      const cappedAmount = capCpuBidForSpecialists(player, Number(bidEntry.cpuBid || 0), roundNumber);
      if (cappedAmount <= 0 || cappedAmount > Number(team.budget || 0)) return;

      candidates.push({
        team,
        teamName,
        amount: cappedAmount,
        source: 'cpu',
        original: bidEntry
      });
    });

    const gated = applySpecialistParticipationGate(player, candidates, rosterLimits)
      .filter(entry => String(entry && entry.source || 'cpu') === 'cpu');

    gated.forEach((entry) => {
      if (!gatedByTeam[entry.teamName]) gatedByTeam[entry.teamName] = [];
      gatedByTeam[entry.teamName].push({
        ...(entry.original || {}),
        player: (entry.original && entry.original.player) || player,
        cpuBid: Number(entry.amount || 0)
      });
    });
  });

  return gatedByTeam;
}

function summarizeSimulationRoundPlacedBids(roundPlayers, cpuBids, teamCount) {
  const safePlayers = Array.isArray(roundPlayers) ? roundPlayers : [];
  const safeBids = cpuBids && typeof cpuBids === 'object' ? cpuBids : {};
  const roundPlayerIdSet = new Set(safePlayers.map((player) => Number(player && player.id)).filter(Number.isFinite));
  const playerBidMap = new Map();
  let totalBidAmount = 0;

  Object.keys(safeBids).forEach((teamName) => {
    const teamBids = Array.isArray(safeBids[teamName]) ? safeBids[teamName] : [];
    teamBids.forEach((entry) => {
      const playerId = Number(entry && entry.player && entry.player.id);
      const bidAmount = Math.max(0, Number(entry && entry.cpuBid || 0));
      if (!Number.isFinite(playerId) || !roundPlayerIdSet.has(playerId) || bidAmount <= 0) return;

      totalBidAmount += bidAmount;
      const existing = playerBidMap.get(playerId) || {
        playerId,
        playerName: String(entry && entry.player && entry.player.name || `Player ${playerId}`),
        totalBidAmount: 0,
        bidCount: 0
      };
      existing.totalBidAmount += bidAmount;
      existing.bidCount += 1;
      playerBidMap.set(playerId, existing);
    });
  });

  const playerBidTotals = [...playerBidMap.values()]
    .map((row) => ({
      playerId: Number(row.playerId || 0),
      playerName: String(row.playerName || ''),
      totalBidAmount: Number(row.totalBidAmount || 0),
      bidCount: Number(row.bidCount || 0)
    }))
    .sort((a, b) => {
      if (b.totalBidAmount !== a.totalBidAmount) return b.totalBidAmount - a.totalBidAmount;
      return String(a.playerName || '').localeCompare(String(b.playerName || ''));
    });

  return {
    totalBidAmount: Number(totalBidAmount.toFixed(2)),
    avgBidAmountPerTeam: Number((totalBidAmount / Math.max(1, Number(teamCount || 1))).toFixed(2)),
    playerBidTotals
  };
}

function resolveSimulationRound(roundPlayers, teams, cpuBids, maxRosterSize, roundNumber, totalRounds, rosterLimits = {}, options = {}) {
  const safeTeams = Array.isArray(teams) ? teams : [];
  const safeBids = cpuBids && typeof cpuBids === 'object' ? cpuBids : {};
  const targetRosterSize = Math.max(1, Number(maxRosterSize || 1) - 3);
  const floorRosterSize = Math.max(1, targetRosterSize - 2);
  const floorPriorityActive = Number(roundNumber || 0) >= Math.max(1, Number(totalRounds || 10) - 1);
  let wins = 0;
  let auctionsWithBid = 0;
  let contestedAuctions = 0;
  let bidEntries = 0;
  let winningPriceTotal = 0;
  let tiesTotal = 0;
  const tiesByTeamCount = {};

  (Array.isArray(roundPlayers) ? roundPlayers : []).forEach((player) => {
    const bids = [];

    Object.keys(safeBids).forEach((teamName) => {
      const team = safeTeams.find(entry => String(entry && entry.name || '') === teamName);
      if (!team) return;
      if ((Array.isArray(team.roster) ? team.roster.length : 0) >= maxRosterSize) return;
      if (!isValidRosterAddition(team, player, rosterLimits, maxRosterSize)) return;

      const bidEntry = (safeBids[teamName] || []).find(entry => Number(entry?.player?.id) === Number(player.id));
      if (!bidEntry) return;

      const rawAmount = Math.max(0, Number(bidEntry.cpuBid || 0));
      const amount = capCpuBidForSpecialists(player, rawAmount, roundNumber);
      if (amount <= 0 || amount > Number(team.budget || 0)) return;

      bids.push({ team, amount });
    });

    const gatedBids = options && options.bidsAlreadyGated
      ? bids
      : applySpecialistParticipationGate(player, bids, rosterLimits);
    if (gatedBids.length === 0) return;
    const floorNeedBidders = floorPriorityActive
      ? gatedBids.filter(entry => (Array.isArray(entry?.team?.roster) ? entry.team.roster.length : 0) < floorRosterSize)
      : [];
    const eligibleBids = floorNeedBidders.length > 0 ? floorNeedBidders : gatedBids;

    auctionsWithBid += 1;
    bidEntries += gatedBids.length;
    if (eligibleBids.length >= 2) contestedAuctions += 1;

    const maxBid = Math.max(...eligibleBids.map(entry => entry.amount), 0);
    const topBidders = eligibleBids.filter(entry => entry.amount === maxBid);

    if (topBidders.length > 1) {
      const tiedTeamCount = topBidders.length;
      tiesTotal += 1;
      tiesByTeamCount[tiedTeamCount] = (tiesByTeamCount[tiedTeamCount] || 0) + 1;
    }

    if (topBidders.length === 1) {
      const winner = topBidders[0].team;
      if (!isValidRosterAddition(winner, player, rosterLimits, maxRosterSize)) return;
      const secondHighest = eligibleBids.length > 1
        ? Math.max(...eligibleBids.filter(entry => entry.amount < maxBid).map(entry => entry.amount), 0)
        : 0;
      const pricePaid = Math.max(secondHighest + 1, 1);
      if (applySimulationWinner(winner, player, pricePaid)) {
        wins += 1;
        winningPriceTotal += pricePaid;
      }
      return;
    }

    const validTopBidders = topBidders.filter(entry => isValidRosterAddition(entry.team, player, rosterLimits, maxRosterSize));
    const winnerRef = validTopBidders[Math.floor(Math.random() * validTopBidders.length)] || null;
    if (!winnerRef) return;
    const lowerLosingBids = eligibleBids
      .filter(entry => entry.team !== winnerRef.team && Number(entry.amount || 0) < maxBid)
      .sort((a, b) => b.amount - a.amount);
    const secondHighest = lowerLosingBids.length > 0 ? Number(lowerLosingBids[0].amount || 0) : 0;
    const tiePrice = Math.max(secondHighest + 1, 1);
    if (applySimulationWinner(winnerRef.team, player, tiePrice)) {
      wins += 1;
      winningPriceTotal += tiePrice;
    }
  });

  return {
    wins,
    auctionsSeen: Array.isArray(roundPlayers) ? roundPlayers.length : 0,
    auctionsWithBid,
    contestedAuctions,
    bidEntries,
    winningPriceTotal,
    tieSummary: {
      totalTies: tiesTotal,
      byTeamCount: tiesByTeamCount
    }
  };
}

async function runAdminDraftSimulations({ draftCount, teamCount, rounds, playersPerRound, rosterSettings, lobbySettings = null, commitmentMode = 'B', forceSpread = null, thresholdDebug = null, teamTrace = null }) {
  const rankingsData = await readDefaultRankingsData();
  const effectivePlayersPerRound = SIM_PAGE_SIZE * 2;
  const rawPlayerTemplate = clonePlayersForSimulation(rankingsData.players || []);
  const poolTargetSize = Math.max(220, (Number(rounds || 10) * effectivePlayersPerRound) + 40);
  const playerTemplate = buildSimulationPlayerPool(rawPlayerTemplate, { poolTargetSize, teamCount });
  const normalizedSettings = normalizeRosterSettingsForSummary(rosterSettings);
  const roundPositionMinimums = getSimulationPositionMinimums(normalizedSettings);
  const targetRosterSize = getTargetRosterSizeFromSettings(normalizedSettings);
  const rosterLimits = buildSimulationRosterLimits(normalizedSettings);
  const maxRosterSize = Math.max(1, targetRosterSize + 3);

  if (playerTemplate.length < Math.max(40, effectivePlayersPerRound)) {
    throw new Error('Not enough ranked players to run simulations.');
  }

  const draftRows = [];
  let completeTeamsTotal = 0;
  let rosterCountTotal = 0;
  let budgetRemainingTotal = 0;
  let allCompleteDrafts = 0;
  const endingBudgets = [];
  const endingRosters = [];
  const starterCompletionRounds = [];
  let auctionsSeenTotal = 0;
  let auctionsWithBidTotal = 0;
  let contestedAuctionsTotal = 0;
  let bidEntriesTotal = 0;
  let winningPriceTotal = 0;
  let winsTotal = 0;
  const roundSpendAccumulator = Array.from({ length: Math.max(1, Number(rounds || 10)) }, () => ({
    totalSpend: 0,
    samples: 0
  }));
  const roundTieAccumulator = Array.from({ length: Math.max(1, Number(rounds || 10)) }, () => ({
    totalTies: 0,
    byTeamCount: {},
    samples: 0
  }));
  const roundBudgetAccumulator = Array.from({ length: Math.max(1, Number(rounds || 10)) }, () => ({
    totalBudgetBeforeRound: 0,
    totalBudgetAfterRound: 0,
    samples: 0
  }));
  const thresholdDebugExamples = [];
  const serializeSimulationPlayer = (player) => ({
    id: Number(player && player.id) || null,
    name: String(player && player.name || ''),
    position: normalizePosition(player && player.position),
    bid: Number(player && player.bid) || 0,
    prerank: Number(player && player.prerank) || null,
    positionRank: Number(player && player.positionRank) || null,
    avgValue: Number(player && player.avgValue) || 0
  });
  const serializeSimulationRoster = (roster) => (Array.isArray(roster) ? roster : [])
    .map((player) => serializeSimulationPlayer(player))
    .sort((a, b) => {
      if (b.bid !== a.bid) return b.bid - a.bid;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  const serializeStarTargets = (targets) => (Array.isArray(targets) ? targets : [])
    .map((target) => ({
      id: Number(target && target.id) || null,
      name: String(target && target.name || ''),
      position: normalizePosition(target && target.position),
      avgValue: Number(target && target.avgValue) || 0,
      prerank: Number(target && target.prerank) || null
    }))
    .filter((target) => target.id || target.name)
    .sort((a, b) => {
      if (Number(a?.prerank || 9999) !== Number(b?.prerank || 9999)) {
        return Number(a?.prerank || 9999) - Number(b?.prerank || 9999);
      }
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });
  const normalizedTeamKey = (value) => String(value || '').trim().toLowerCase();
  const normalizedTraceTeamFilter = String(teamTrace?.teamNameFilter || '').trim().toLowerCase();
  const thresholdDebugDraftNumber = Math.max(1, Number(thresholdDebug?.draftNumber || 1));
  const teamTraceDraftNumber = Math.max(1, Number(teamTrace?.draftNumber || thresholdDebugDraftNumber || 1));
  let tracedTeamSummary = null;

  for (let draftIndex = 0; draftIndex < draftCount; draftIndex += 1) {
    const allPlayers = clonePlayersForSimulation(playerTemplate);
    const teams = Array.from({ length: teamCount }, (_unused, idx) => ({
      name: `Team ${idx + 1}`,
      budget: 200,
      roster: [],
      starterCompletedRound: null
    }));
    const draftRoundBidDetails = [];
    const draftNumber = draftIndex + 1;
    const shouldCollectThresholdDebugForDraft = !!thresholdDebug && draftNumber === thresholdDebugDraftNumber;
    const shouldCollectTeamTraceForDraft = !!teamTrace && draftNumber === teamTraceDraftNumber;
    const draftTeamTraceRounds = [];

    for (let roundNumber = 1; roundNumber <= rounds; roundNumber += 1) {
      const roundPlayers = buildSimulationRoundPlayers(allPlayers, effectivePlayersPerRound, roundNumber, rounds, roundPositionMinimums);
      if (roundPlayers.length === 0) break;

      const roundTeamStateBefore = shouldCollectTeamTraceForDraft
        ? new Map((teams || []).map((team) => [
            String(team?.name || ''),
            {
              budgetBefore: Number(team?.budget || 0),
              rosterBefore: serializeSimulationRoster(team?.roster)
            }
          ]))
        : null;

      const roundIdx = Math.max(0, Number(roundNumber || 1) - 1);
      const totalBudgetBeforeRound = (teams || []).reduce((sum, team) => sum + Math.max(0, Number(team && team.budget || 0)), 0);
      if (roundBudgetAccumulator[roundIdx]) {
        roundBudgetAccumulator[roundIdx].totalBudgetBeforeRound += totalBudgetBeforeRound;
        roundBudgetAccumulator[roundIdx].samples += 1;
      }

      const cpuBids = await generateServerCPUBids(
        teams,
        roundPlayers,
        allPlayers,
        targetRosterSize,
        rosterLimits,
        [],
        roundNumber,
        {
          commitmentMode,
          forceSpread,
          thresholdDebug,
          thresholdDebugCollector: shouldCollectThresholdDebugForDraft ? thresholdDebugExamples : null
        }
      );
      const gatedCpuBids = gateCpuBidsForRound(
        roundPlayers,
        teams,
        cpuBids,
        rosterLimits,
        maxRosterSize,
        roundNumber
      );
      const placedBidSummary = summarizeSimulationRoundPlacedBids(roundPlayers, gatedCpuBids, teamCount);

      const roundResult = resolveSimulationRound(
        roundPlayers,
        teams,
        gatedCpuBids,
        maxRosterSize,
        roundNumber,
        rounds,
        rosterLimits,
        { bidsAlreadyGated: true }
      );
      auctionsSeenTotal += Number(roundResult && roundResult.auctionsSeen || 0);
      auctionsWithBidTotal += Number(roundResult && roundResult.auctionsWithBid || 0);
      contestedAuctionsTotal += Number(roundResult && roundResult.contestedAuctions || 0);
      bidEntriesTotal += Number(roundResult && roundResult.bidEntries || 0);
      winningPriceTotal += Number(roundResult && roundResult.winningPriceTotal || 0);
      winsTotal += Number(roundResult && roundResult.wins || 0);
      const tieSummary = roundResult && roundResult.tieSummary ? roundResult.tieSummary : { totalTies: 0, byTeamCount: {} };
      if (roundTieAccumulator[roundIdx]) {
        roundTieAccumulator[roundIdx].totalTies += Number(tieSummary && tieSummary.totalTies || 0);
        roundTieAccumulator[roundIdx].samples += 1;
        Object.keys(tieSummary && tieSummary.byTeamCount || {}).forEach((teamCountKey) => {
          const teamCount = Number(teamCountKey);
          if (!Number.isFinite(teamCount) || teamCount <= 0) return;
          roundTieAccumulator[roundIdx].byTeamCount[teamCount] = (roundTieAccumulator[roundIdx].byTeamCount[teamCount] || 0) + Number(tieSummary.byTeamCount[teamCountKey] || 0);
        });
      }
      const totalBudgetAfterRound = (teams || []).reduce((sum, team) => sum + Math.max(0, Number(team && team.budget || 0)), 0);
      if (roundBudgetAccumulator[roundIdx]) {
        roundBudgetAccumulator[roundIdx].totalBudgetAfterRound += totalBudgetAfterRound;
      }
      if (roundSpendAccumulator[roundIdx]) {
        roundSpendAccumulator[roundIdx].totalSpend += Number(placedBidSummary && placedBidSummary.totalBidAmount || 0);
        roundSpendAccumulator[roundIdx].samples += 1;
      }
      const playerBidTotalsList = Array.isArray(placedBidSummary && placedBidSummary.playerBidTotals)
        ? placedBidSummary.playerBidTotals
        : [];
      const perPlayerBidAmounts = new Map();
      Object.values(gatedCpuBids || {}).forEach((teamBidList) => {
        (teamBidList || []).forEach((bid) => {
          const playerId = Number(bid && bid.player && bid.player.id || 0);
          if (!playerId) return;
          const amount = Math.max(0, Number(bid && bid.cpuBid || 0));
          if (!perPlayerBidAmounts.has(playerId)) {
            perPlayerBidAmounts.set(playerId, []);
          }
          perPlayerBidAmounts.get(playerId).push(amount);
        });
      });
      const bidTotalsByPlayerId = new Map(
        playerBidTotalsList.map((row) => [
          Number(row && row.playerId),
          {
            totalBidAmount: Number(row && row.totalBidAmount || 0),
            bidCount: Number(row && row.bidCount || 0)
          }
        ])
      );
      const roundPlayerResults = (Array.isArray(roundPlayers) ? roundPlayers : []).map((player) => {
        const playerId = Number(player && player.id || 0);
        const bidRow = bidTotalsByPlayerId.get(playerId) || { totalBidAmount: 0, bidCount: 0 };
        const bidAmounts = (perPlayerBidAmounts.get(playerId) || []).slice().sort((a, b) => b - a);
        const winningBidAmount = bidAmounts.length > 0 ? Number(bidAmounts[0] || 0) : 0;
        const secondHighestBid = bidAmounts.length > 1 ? Number(bidAmounts[1] || 0) : 0;
        const winnerTeam = player && player.owner ? String(player.owner) : null;
        const pricePaid = winnerTeam ? Number(player && player.bid || 0) : 0;
        return {
          playerId,
          playerName: String(player && player.name || ''),
          position: normalizePosition(player && player.position),
          prerank: Number(player && player.prerank) || null,
          positionRank: Number(player && player.positionRank) || null,
          avgValue: Number(player && player.avgValue || 0),
          totalBidAmount: Number(bidRow.totalBidAmount || 0),
          bidCount: Number(bidRow.bidCount || 0),
          winningBidAmount,
          secondHighestBid,
          drafted: !!winnerTeam,
          winnerTeam,
          pricePaid
        };
      });
      draftRoundBidDetails.push({
        round: Number(roundNumber || 0),
        totalBidAmount: Number(placedBidSummary && placedBidSummary.totalBidAmount || 0),
        avgBidAmountPerTeam: Number(placedBidSummary && placedBidSummary.avgBidAmountPerTeam || 0),
        playerBidTotals: playerBidTotalsList,
        roundPlayerResults,
        tieSummary
      });

      if (shouldCollectTeamTraceForDraft) {
        const tracedRoundTeams = (teams || [])
          .filter((team) => {
            const teamName = normalizedTeamKey(team?.name || '');
            return !normalizedTraceTeamFilter || teamName === normalizedTraceTeamFilter;
          })
          .map((team) => {
            const teamName = String(team?.name || '');
            const beforeState = roundTeamStateBefore?.get(teamName) || {
              budgetBefore: Number(team?.budget || 0),
              rosterBefore: []
            };
            const rosterAfter = serializeSimulationRoster(team?.roster);
            const beforeRosterIds = new Set(beforeState.rosterBefore.map((player) => Number(player?.id || 0)).filter(Boolean));
            const playersWon = rosterAfter.filter((player) => Number(player?.id || 0) > 0 && !beforeRosterIds.has(Number(player.id)));
            const bidsPlaced = ((gatedCpuBids && gatedCpuBids[teamName]) || [])
              .map((bid) => ({
                playerId: Number(bid?.player?.id || 0),
                playerName: String(bid?.player?.name || ''),
                position: normalizePosition(bid?.player?.position),
                avgValue: Number(bid?.player?.avgValue || 0),
                cpuBid: Number(bid?.cpuBid || 0)
              }))
              .sort((a, b) => {
                if (b.cpuBid !== a.cpuBid) return b.cpuBid - a.cpuBid;
                return String(a.playerName || '').localeCompare(String(b.playerName || ''));
              });

            return {
              teamName,
              cpuProfileApproach: String(team?.cpuProfileApproach || ''),
              cpuProfileLabel: String(team?.cpuProfileLabel || ''),
              starTargets: serializeStarTargets(team?.cpuStarTargets),
              budgetBefore: Number(beforeState.budgetBefore || 0),
              budgetAfter: Number(team?.budget || 0),
              rosterBefore: beforeState.rosterBefore,
              rosterAfter,
              bidsPlaced,
              playersWon
            };
          });

        if (tracedRoundTeams.length > 0) {
          draftTeamTraceRounds.push({
            round: Number(roundNumber || 0),
            teams: tracedRoundTeams
          });
        }
      }

      teams.forEach((team) => {
        if (!team || team.starterCompletedRound !== null) return;
        if (hasCompletedStarters(team.roster, normalizedSettings)) {
          team.starterCompletedRound = roundNumber;
        }
      });
    }

    const teamSummaries = teams.map((team) => {
      const rosterCount = Array.isArray(team.roster) ? team.roster.length : 0;
      const budgetRemaining = Number(team.budget || 0);
      const complete = rosterCount >= targetRosterSize;
      const roster = serializeSimulationRoster(team.roster);
      const starTargets = serializeStarTargets(team.cpuStarTargets);
      const starTargetIdSet = new Set((Array.isArray(team.cpuStarTargetIds) ? team.cpuStarTargetIds : []).map((id) => Number(id)).filter(Boolean));
      const acquiredTargets = roster.filter((player) => starTargetIdSet.has(Number(player?.id || 0)));
      const starTargetTotal = starTargets.length;
      const starTargetHitCount = acquiredTargets.length;
      const starTargetHitPct = starTargetTotal > 0
        ? Number(((starTargetHitCount / starTargetTotal) * 100).toFixed(1))
        : 0;

      return {
        name: team.name,
        cpuProfileApproach: String(team && team.cpuProfileApproach || ''),
        cpuProfileLabel: String(team && team.cpuProfileLabel || ''),
        starTargets,
        starTargetTotal,
        starTargetHitCount,
        starTargetHitPct,
        acquiredTargets,
        rosterCount,
        budgetRemaining,
        budgetSpent: Math.max(0, 200 - budgetRemaining),
        complete,
        starterCompletedRound: Number.isFinite(team && team.starterCompletedRound)
          ? Number(team.starterCompletedRound)
          : null,
        roster
      };
    });

    if (shouldCollectTeamTraceForDraft) {
      const tracedTeams = teams
        .filter((team) => {
          const teamName = normalizedTeamKey(team?.name || '');
          return !normalizedTraceTeamFilter || teamName === normalizedTraceTeamFilter;
        })
        .map((team) => {
          const starTargets = serializeStarTargets(team?.cpuStarTargets);
          const starTargetIdSet = new Set((Array.isArray(team?.cpuStarTargetIds) ? team.cpuStarTargetIds : []).map((id) => Number(id)).filter(Boolean));
          const finalRoster = serializeSimulationRoster(team?.roster);
          const acquiredTargets = finalRoster.filter((player) => starTargetIdSet.has(Number(player?.id || 0)));
          const starTargetTotal = starTargets.length;
          const starTargetHitCount = acquiredTargets.length;
          const starTargetHitPct = starTargetTotal > 0
            ? Number(((starTargetHitCount / starTargetTotal) * 100).toFixed(1))
            : 0;

          return {
            teamName: String(team?.name || ''),
            cpuProfileApproach: String(team?.cpuProfileApproach || ''),
            cpuProfileLabel: String(team?.cpuProfileLabel || ''),
            starTargets,
            starTargetTotal,
            starTargetHitCount,
            starTargetHitPct,
            acquiredTargets
          };
        });

      tracedTeamSummary = {
        draftNumber,
        teamNameFilter: String(teamTrace?.teamNameFilter || ''),
        teams: tracedTeams,
        rounds: draftTeamTraceRounds
      };
    }

    const completeTeams = teamSummaries.filter(team => team.complete).length;
    const undraftedPlayers = (Array.isArray(allPlayers) ? allPlayers : []).filter(player => player && !player.owner);
    const undraftedByPosition = undraftedPlayers.reduce((acc, player) => {
      const pos = normalizePosition(player && player.position) || 'UNK';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {});

    if (completeTeams === teamCount) allCompleteDrafts += 1;

    completeTeamsTotal += completeTeams;
    rosterCountTotal += teamSummaries.reduce((sum, team) => sum + team.rosterCount, 0);
    budgetRemainingTotal += teamSummaries.reduce((sum, team) => sum + team.budgetRemaining, 0);
    teamSummaries.forEach((team) => {
      endingBudgets.push(team.budgetRemaining);
      endingRosters.push(team.rosterCount);
    });
    teams.forEach((team) => {
      if (Number.isFinite(team && team.starterCompletedRound)) {
        starterCompletionRounds.push(Number(team.starterCompletedRound));
      }
    });

    draftRows.push({
      draftNumber: draftIndex + 1,
      completeTeams,
      teamCount,
      completionRate: teamCount > 0 ? Number((completeTeams / teamCount).toFixed(3)) : 0,
      undraftedCount: undraftedPlayers.length,
      undraftedByPosition,
      teams: teamSummaries,
      roundBidDetails: draftRoundBidDetails
    });
  }

  const totalTeams = Math.max(1, draftCount * teamCount);
  const completionRate = Number((completeTeamsTotal / totalTeams).toFixed(3));
  const avgRosterCount = Number((rosterCountTotal / totalTeams).toFixed(2));
  const avgBudgetRemaining = Number((budgetRemainingTotal / totalTeams).toFixed(2));
  const allCompleteDraftRate = Number((allCompleteDrafts / Math.max(1, draftCount)).toFixed(3));
  const undraftedCounts = draftRows.map((draft) => Number(draft && draft.undraftedCount || 0));
  const avgUndraftedCount = undraftedCounts.length > 0
    ? Number((undraftedCounts.reduce((sum, n) => sum + n, 0) / undraftedCounts.length).toFixed(2))
    : 0;
  const medianUndraftedCount = undraftedCounts.length > 0
    ? Number(percentile(undraftedCounts, 50).toFixed(2))
    : 0;
  const p90UndraftedCount = undraftedCounts.length > 0
    ? Number(percentile(undraftedCounts, 90).toFixed(2))
    : 0;
  const medianBudgetRemaining = Number(percentile(endingBudgets, 50).toFixed(2));
  const p90BudgetRemaining = Number(percentile(endingBudgets, 90).toFixed(2));
  const starterCompletionRate = Number((starterCompletionRounds.length / totalTeams).toFixed(3));
  const avgStarterCompletionRound = starterCompletionRounds.length > 0
    ? Number((starterCompletionRounds.reduce((sum, n) => sum + n, 0) / starterCompletionRounds.length).toFixed(2))
    : null;
  const contestRate = auctionsWithBidTotal > 0
    ? Number((contestedAuctionsTotal / auctionsWithBidTotal).toFixed(3))
    : 0;
  const bidParticipationRate = auctionsSeenTotal > 0
    ? Number((auctionsWithBidTotal / auctionsSeenTotal).toFixed(3))
    : 0;
  const avgBidsPerActiveAuction = auctionsWithBidTotal > 0
    ? Number((bidEntriesTotal / auctionsWithBidTotal).toFixed(2))
    : 0;
  const avgWinningPrice = winsTotal > 0 ? Number((winningPriceTotal / winsTotal).toFixed(2)) : 0;
  const roundSpendByRound = roundSpendAccumulator.map((entry, idx) => ({
    round: idx + 1,
    avgSpend: entry.samples > 0 ? Number((entry.totalSpend / entry.samples).toFixed(2)) : 0
  }));
  const roundTieByRound = roundTieAccumulator.map((entry, idx) => {
    const sampleCount = Math.max(1, Number(entry.samples || 1));
    const tieCountByTeam = {};
    [2, 3, 4, 5, 6].forEach((teamCount) => {
      tieCountByTeam[teamCount] = Number(entry.byTeamCount[teamCount] || 0);
    });
    return {
      round: idx + 1,
      avgTiesPerAuction: Number((Number(entry.totalTies || 0) / sampleCount).toFixed(2)),
      avgTwoWayTies: Number((Number(tieCountByTeam[2] || 0) / sampleCount).toFixed(2)),
      avgThreeWayTies: Number((Number(tieCountByTeam[3] || 0) / sampleCount).toFixed(2)),
      avgFourWayTies: Number((Number(tieCountByTeam[4] || 0) / sampleCount).toFixed(2)),
      avgFivePlusWayTies: Number((Object.keys(tieCountByTeam).reduce((sum, teamCountKey) => {
        const teamCount = Number(teamCountKey);
        return sum + (teamCount >= 5 ? Number(tieCountByTeam[teamCount] || 0) : 0);
      }, 0) / sampleCount).toFixed(2))
    };
  });
  const roundBudgetByRound = roundBudgetAccumulator.map((entry, idx) => ({
    round: idx + 1,
    avgBudgetBeforeRound: entry.samples > 0 ? Number((entry.totalBudgetBeforeRound / entry.samples).toFixed(2)) : 0,
    avgBudgetAfterRound: entry.samples > 0 ? Number((entry.totalBudgetAfterRound / entry.samples).toFixed(2)) : 0
  }));
  const roundOneSpend = Number(roundSpendByRound[0] && roundSpendByRound[0].avgSpend || 0);
  const lastRoundSpend = Number(roundSpendByRound[roundSpendByRound.length - 1] && roundSpendByRound[roundSpendByRound.length - 1].avgSpend || 0);
  const lastRoundPotentialSpend = Number(roundBudgetByRound[roundBudgetByRound.length - 1] && roundBudgetByRound[roundBudgetByRound.length - 1].avgBudgetBeforeRound || 0);
  const lastRoundSpendUtilizationPct = lastRoundPotentialSpend > 0
    ? Number(((lastRoundSpend / lastRoundPotentialSpend) * 100).toFixed(1))
    : 0;
  let maxRoundToRoundDropPct = 0;
  for (let i = 1; i < roundSpendByRound.length; i += 1) {
    const prev = Number(roundSpendByRound[i - 1] && roundSpendByRound[i - 1].avgSpend || 0);
    const curr = Number(roundSpendByRound[i] && roundSpendByRound[i].avgSpend || 0);
    if (prev > 0 && curr < prev) {
      const dropPct = ((prev - curr) / prev) * 100;
      if (dropPct > maxRoundToRoundDropPct) maxRoundToRoundDropPct = dropPct;
    }
  }
  const roundOneToLastDropPct = roundOneSpend > 0
    ? Number((((roundOneSpend - lastRoundSpend) / roundOneSpend) * 100).toFixed(1))
    : 0;
  const roundSpendConsistency = {
    roundOneAvgSpend: roundOneSpend,
    lastRoundAvgSpend: lastRoundSpend,
    lastRoundPotentialSpend,
    lastRoundSpendUtilizationPct,
    roundOneAvgBidsPlaced: roundOneSpend,
    lastRoundAvgBidsPlaced: lastRoundSpend,
    lastRoundBidUtilizationPct: lastRoundSpendUtilizationPct,
    roundOneToLastDropPct,
    maxRoundToRoundDropPct: Number(maxRoundToRoundDropPct.toFixed(1)),
    rounds: roundSpendByRound.map((entry, idx) => {
      const prev = idx > 0 ? Number(roundSpendByRound[idx - 1].avgSpend || 0) : 0;
      const potential = Number(roundBudgetByRound[idx] && roundBudgetByRound[idx].avgBudgetBeforeRound || 0);
      const afterRound = Number(roundBudgetByRound[idx] && roundBudgetByRound[idx].avgBudgetAfterRound || 0);
      const avgMoneyLeftPerTeamBeforeRound = Number((potential / Math.max(1, Number(teamCount || 1))).toFixed(2));
      const avgMoneyLeftPerTeamAfterRound = Number((afterRound / Math.max(1, Number(teamCount || 1))).toFixed(2));
      const avgSpendPerTeam = Number((entry.avgSpend / Math.max(1, Number(teamCount || 1))).toFixed(2));
      const pctOfRoundOne = roundOneSpend > 0 ? Number(((entry.avgSpend / roundOneSpend) * 100).toFixed(1)) : 0;
      const dropFromPrevPct = idx > 0 && prev > 0
        ? Number((((prev - entry.avgSpend) / prev) * 100).toFixed(1))
        : 0;
      const spendUtilizationPct = potential > 0 ? Number(((entry.avgSpend / potential) * 100).toFixed(1)) : 0;
      return {
        round: entry.round,
        avgSpend: entry.avgSpend,
        avgTotalBidsPlaced: entry.avgSpend,
        avgPotentialSpend: potential,
        avgBudgetAfterRound: afterRound,
        avgMoneyLeftPerTeamBeforeRound,
        avgMoneyLeftPerTeamAfterRound,
        avgSpendPerTeam,
        avgBidAmountPerTeam: avgSpendPerTeam,
        spendUtilizationPct,
        pctOfRoundOne,
        dropFromPrevPct
      };
    })
  };
  const roundBudgetTracker = {
    teamCount: Number(teamCount || 0),
    rounds: roundSpendConsistency.rounds.map((row) => ({
      round: Number(row.round || 0),
      avgMoneyLeftPerTeamBeforeRound: Number(row.avgMoneyLeftPerTeamBeforeRound || 0),
      avgMoneyLeftPerTeamAfterRound: Number(row.avgMoneyLeftPerTeamAfterRound || 0),
      avgSpendPerTeam: Number(row.avgSpendPerTeam || 0),
      avgBidAmountPerTeam: Number(row.avgBidAmountPerTeam || row.avgSpendPerTeam || 0),
      totalRoundSpend: Number(row.avgSpend || 0)
    }))
  };
  const spendPerTeamSeries = roundBudgetTracker.rounds.map((row) => Number(row.avgSpendPerTeam || 0));
  let spendSmoothnessScore = 100;
  if (spendPerTeamSeries.length > 1) {
    const startSpend = Math.max(1, spendPerTeamSeries[0]);
    let absDeltaTotal = 0;
    let upwardDeltaTotal = 0;
    for (let i = 1; i < spendPerTeamSeries.length; i += 1) {
      const delta = spendPerTeamSeries[i] - spendPerTeamSeries[i - 1];
      absDeltaTotal += Math.abs(delta);
      if (delta > 0) upwardDeltaTotal += delta;
    }
    const avgAbsDelta = absDeltaTotal / (spendPerTeamSeries.length - 1);
    const jaggedRatio = avgAbsDelta / startSpend;
    const upwardRatio = upwardDeltaTotal / startSpend;
    const penalty = Math.min(1, (jaggedRatio * 2.2) + (upwardRatio * 3.0));
    spendSmoothnessScore = Math.max(0, Math.min(100, Math.round(100 * (1 - penalty))));
  }

  const spendSmoothness = {
    score: spendSmoothnessScore,
    label: spendSmoothnessScore >= 80
      ? 'smooth'
      : spendSmoothnessScore >= 60
        ? 'moderate'
        : 'volatile'
  };
  const realism = calculateRealismScore({
    completionRate,
    medianBudgetRemaining,
    p90BudgetRemaining,
    contestRate,
    bidParticipationRate,
    avgBidsPerActiveAuction,
    starterCompletionRate,
    avgStarterCompletionRound
  });

  const realismFlags = [];
  if (avgBudgetRemaining > 70) realismFlags.push('high_leftover_budget');
  if (p90BudgetRemaining > 120) realismFlags.push('extreme_budget_hoarding');
  if (contestRate < 0.2) realismFlags.push('low_market_competition');
  if (bidParticipationRate < 0.65) realismFlags.push('too_many_no_bid_auctions');
  if (completionRate < 0.95) realismFlags.push('roster_completion_risk');
  if (spendSmoothnessScore < 55) realismFlags.push('volatile_round_spend_curve');

  return {
    config: {
      draftCount,
      teamCount,
      rounds,
      playersPerRound: effectivePlayersPerRound,
      commitmentMode,
      forceSpread,
      targetRosterSize,
      rosterSettings: normalizedSettings,
      lobbySettings: lobbySettings || {},
      sourceFile: rankingsData.sourceFile
    },
    aggregate: {
      completionRate,
      avgRosterCount,
      avgBudgetRemaining,
      allCompleteDraftRate,
      avgUndraftedCount,
      medianUndraftedCount,
      p90UndraftedCount
    },
    scorecard: {
      budget: {
        avgRemaining: avgBudgetRemaining,
        medianRemaining: medianBudgetRemaining,
        p90Remaining: p90BudgetRemaining
      },
      competition: {
        contestRate,
        bidParticipationRate,
        avgBidsPerActiveAuction,
        avgWinningPrice
      },
      completion: {
        teamCompletionRate: completionRate,
        allCompleteDraftRate,
        avgRosterCount
      },
      timing: {
        starterCompletionRate,
        avgStarterCompletionRound,
        roundSpendConsistency,
        roundBudgetTracker,
        spendSmoothness,
        tieStats: {
          overall: {
            avgTiesPerRound: roundTieByRound.length > 0 ? Number((roundTieByRound.reduce((sum, row) => sum + Number(row.avgTiesPerAuction || 0), 0) / roundTieByRound.length).toFixed(2)) : 0,
            avgTwoWayTiesPerRound: roundTieByRound.length > 0 ? Number((roundTieByRound.reduce((sum, row) => sum + Number(row.avgTwoWayTies || 0), 0) / roundTieByRound.length).toFixed(2)) : 0,
            avgThreeWayTiesPerRound: roundTieByRound.length > 0 ? Number((roundTieByRound.reduce((sum, row) => sum + Number(row.avgThreeWayTies || 0), 0) / roundTieByRound.length).toFixed(2)) : 0,
            avgFourWayTiesPerRound: roundTieByRound.length > 0 ? Number((roundTieByRound.reduce((sum, row) => sum + Number(row.avgFourWayTies || 0), 0) / roundTieByRound.length).toFixed(2)) : 0,
            avgFivePlusWayTiesPerRound: roundTieByRound.length > 0 ? Number((roundTieByRound.reduce((sum, row) => sum + Number(row.avgFivePlusWayTies || 0), 0) / roundTieByRound.length).toFixed(2)) : 0
          },
          rounds: roundTieByRound
        }
      },
      overall: {
        realismScore: realism.realismScore,
        breakdown: realism.breakdown
      },
      flags: realismFlags
    },
    drafts: draftRows,
    thresholdDebugExamples,
    teamTrace: tracedTeamSummary
  };
}

app.post('/api/admin/simulate-drafts', requireAdminDebugKey, async (req, res) => {
  try {
    const draftCount = clampInt(req.body?.draftCount, 15, 1, 200);
    const teamCount = clampInt(req.body?.teamCount, 10, 2, 12);
    const rounds = clampInt(req.body?.rounds, 10, 1, 15);
    const playersPerRound = clampInt(req.body?.playersPerRound, 24, 8, 40);
    const requestedModeRaw = String(req.body?.commitmentMode || 'B').trim().toUpperCase();
    const commitmentMode = ['A', 'B', 'C'].includes(requestedModeRaw) ? requestedModeRaw : 'B';
    const forceSpreadRaw = req.body?.forceSpread;
    const forceSpread = typeof forceSpreadRaw === 'boolean' ? forceSpreadRaw : null;
    const thresholdDebugRaw = req.body?.thresholdDebug;
    const thresholdDebug = (thresholdDebugRaw && typeof thresholdDebugRaw === 'object')
      ? {
          enabled: thresholdDebugRaw.enabled !== false,
          minRound: clampInt(thresholdDebugRaw.minRound, 6, 1, rounds),
          maxRound: clampInt(thresholdDebugRaw.maxRound, rounds, 1, rounds),
          maxSamplesPerTeamRound: clampInt(thresholdDebugRaw.maxSamplesPerTeamRound, 2, 1, 500),
          draftNumber: clampInt(thresholdDebugRaw.draftNumber, 1, 1, draftCount),
          teams: Array.isArray(thresholdDebugRaw.teams) ? thresholdDebugRaw.teams.map((n) => String(n || '').trim()).filter(Boolean) : [],
          players: Array.isArray(thresholdDebugRaw.players) ? thresholdDebugRaw.players.map((n) => String(n || '').trim()).filter(Boolean) : []
        }
      : null;
    const teamTraceRaw = req.body?.teamTrace;
    const teamTrace = (teamTraceRaw && typeof teamTraceRaw === 'object')
      ? {
          teamNameFilter: String(teamTraceRaw.teamNameFilter || '').trim(),
          draftNumber: clampInt(teamTraceRaw.draftNumber, 1, 1, draftCount)
        }
      : null;
    const rosterSettings = normalizeRosterSettingsForSummary(req.body?.rosterSettings || SUMMARY_DEFAULT_ROSTER_SETTINGS);
    const lobbySettingsRaw = req.body?.lobbySettings;
    const lobbySettings = (lobbySettingsRaw && typeof lobbySettingsRaw === 'object') ? lobbySettingsRaw : null;

    const startedAt = Date.now();
    const simulation = await runAdminDraftSimulations({
      draftCount,
      teamCount,
      rounds,
      playersPerRound,
      rosterSettings,
      lobbySettings,
      commitmentMode,
      forceSpread,
      thresholdDebug,
      teamTrace
    });

    return res.json({
      ok: true,
      durationMs: Date.now() - startedAt,
      simulation
    });
  } catch (error) {
    console.error('[ADMIN] Draft simulation error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unable to run draft simulations' });
  }
});

app.get('/api/admin/rankings/default', requireAdminDebugKey, async (req, res) => {
  try {
    const rankingsData = await readDefaultRankingsData();
    const lastUpdatedAt = Number(rankingsData.lastUpdatedAt || 0) || null;
    const ageMs = lastUpdatedAt ? Math.max(0, Date.now() - lastUpdatedAt) : null;
    const ageDays = ageMs === null ? null : Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const isStaleWeek = ageMs === null ? true : ageMs > (7 * 24 * 60 * 60 * 1000);

    return res.json({
      ok: true,
      sourceFile: rankingsData.sourceFile,
      lastUpdatedAt,
      ageDays,
      isStaleWeek,
      count: rankingsData.players.length,
      players: rankingsData.players
    });
  } catch (error) {
    console.error('[ADMIN] Read rankings error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to read default rankings' });
  }
});

app.post('/api/admin/rankings/default/add', requireAdminDebugKey, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const position = normalizePosition(req.body.position);
    const team = String(req.body.team || '').trim().toUpperCase();
    const avgValue = toNumber(req.body.avgValue, 1);

    if (!name || !position) {
      return res.status(400).json({ ok: false, error: 'Name and valid position are required' });
    }

    const rankingsData = await readDefaultRankingsData();
    const exists = rankingsData.players.some((player) =>
      String(player.name || '').toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({ ok: false, error: 'Player already exists in default rankings' });
    }

    rankingsData.players.push({
      id: rankingsData.players.length + 1,
      name,
      position,
      team,
      prerank: rankingsData.players.length + 1,
      avgValue
    });

    const saved = await writeDefaultRankingsData(rankingsData.players);
    return res.json({ ok: true, count: saved.length });
  } catch (error) {
    console.error('[ADMIN] Add rankings player error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to add player to default rankings' });
  }
});

app.post('/api/admin/rankings/default/remove', requireAdminDebugKey, async (req, res) => {
  try {
    const id = toNumber(req.body.id, 0);
    const name = String(req.body.name || '').trim().toLowerCase();

    if (!id && !name) {
      return res.status(400).json({ ok: false, error: 'Provide id or name to remove a player' });
    }

    const rankingsData = await readDefaultRankingsData();
    const filtered = rankingsData.players.filter((player) => {
      if (id) return toNumber(player.id, -1) !== id;
      return String(player.name || '').toLowerCase() !== name;
    });

    if (filtered.length === rankingsData.players.length) {
      return res.status(404).json({ ok: false, error: 'Player not found in default rankings' });
    }

    const saved = await writeDefaultRankingsData(filtered);
    return res.json({ ok: true, count: saved.length });
  } catch (error) {
    console.error('[ADMIN] Remove rankings player error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to remove player from default rankings' });
  }
});

app.post('/api/admin/rankings/default/save', requireAdminDebugKey, async (req, res) => {
  try {
    const playersInput = Array.isArray(req.body.players) ? req.body.players : null;
    if (!playersInput) {
      return res.status(400).json({ ok: false, error: 'players array is required' });
    }

    const normalizedPlayers = playersInput
      .map((player, idx) => normalizeRankingPlayer({
        ...player,
        prerank: idx + 1
      }, idx))
      .filter(Boolean);

    if (!normalizedPlayers.length) {
      return res.status(400).json({ ok: false, error: 'No valid players provided' });
    }

    const seen = new Set();
    for (const player of normalizedPlayers) {
      const key = String(player.name || '').toLowerCase();
      if (seen.has(key)) {
        return res.status(409).json({ ok: false, error: `Duplicate player in payload: ${player.name}` });
      }
      seen.add(key);
    }

    const saved = await writeDefaultRankingsData(normalizedPlayers);
    return res.json({
      ok: true,
      sourceFile: path.basename(FALLBACK_RANKINGS_FILE),
      count: saved.length
    });
  } catch (error) {
    console.error('[ADMIN] Save rankings layout error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to save default rankings layout' });
  }
});

app.post('/api/admin/rankings/default/sync-rb-order', requireAdminDebugKey, async (req, res) => {
  try {
    const result = await syncTopRbOrderFromRbFile({ reason: 'sync-rb-order' });
    return res.json({
      ok: true,
      message: 'TOP RB order synced from rb.json and backup created.',
      backupFileName: result.backup.backupFileName,
      backupFilePath: result.backup.backupFilePath,
      updatedCount: result.updatedCount,
      rbSourceFile: result.positionSourceFile
    });
  } catch (error) {
    console.error('[ADMIN] Sync TOP RB order error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to sync TOP RB order from rb.json' });
  }
});

app.post('/api/admin/rankings/default/sync-position-order', requireAdminDebugKey, async (req, res) => {
  try {
    const requestedPosition = String(req.body && req.body.position || '').trim().toUpperCase();

    if (requestedPosition === 'ALL') {
      const allResult = await syncTopAllPositionOrdersFromPositionFiles({
        reason: 'sync-all-position-order'
      });

      return res.json({
        ok: true,
        message: 'TOP slots synced for all positions from position files and backup created.',
        backupFileName: allResult.backup.backupFileName,
        backupFilePath: allResult.backup.backupFilePath,
        updatedCount: allResult.updatedCount,
        sourcePositions: allResult.sourcePositions,
        positionSourceFiles: allResult.positionSourceFiles
      });
    }

    const position = normalizePosition(requestedPosition);
    if (!position) {
      return res.status(400).json({ ok: false, error: 'Valid position is required (ALL/QB/RB/WR/TE/K/DEF)' });
    }

    const result = await syncTopPositionOrderFromPositionFile({
      position,
      reason: `sync-${position.toLowerCase()}-order`
    });

    return res.json({
      ok: true,
      message: `TOP ${position} slots synced from ${result.positionSourceFile} and backup created.`,
      backupFileName: result.backup.backupFileName,
      backupFilePath: result.backup.backupFilePath,
      updatedCount: result.updatedCount,
      sourcePosition: result.sourcePosition,
      positionSourceFile: result.positionSourceFile
    });
  } catch (error) {
    console.error('[ADMIN] Sync TOP position order error:', error);
    return res.status(500).json({ ok: false, error: 'Unable to sync TOP position order' });
  }
});

app.get('/api/admin/rankings/position/:position', requireAdminDebugKey, async (req, res) => {
  try {
    const rankingsData = await readPositionRankingsData(req.params.position);
    const lastUpdatedAt = Number(rankingsData.lastUpdatedAt || 0) || null;
    const ageMs = lastUpdatedAt ? Math.max(0, Date.now() - lastUpdatedAt) : null;
    const ageDays = ageMs === null ? null : Math.floor(ageMs / (24 * 60 * 60 * 1000));
    const isStaleWeek = ageMs === null ? true : ageMs > (7 * 24 * 60 * 60 * 1000);

    return res.json({
      ok: true,
      position: rankingsData.position,
      sourceFile: rankingsData.sourceFile,
      lastUpdatedAt,
      ageDays,
      isStaleWeek,
      count: rankingsData.players.length,
      players: rankingsData.players
    });
  } catch (error) {
    console.error('[ADMIN] Read position rankings error:', error);
    return res.status(400).json({ ok: false, error: 'Unable to read position rankings' });
  }
});

app.post('/api/admin/rankings/position/:position/save', requireAdminDebugKey, async (req, res) => {
  try {
    const players = Array.isArray(req.body.players) ? req.body.players : null;
    if (!players) {
      return res.status(400).json({ ok: false, error: 'players array is required' });
    }

    const saved = await writePositionRankingsData(req.params.position, players);
    await rebuildDefaultRankingsFromPositionFiles();
    const meta = getPositionFileMeta(req.params.position);
    return res.json({
      ok: true,
      position: normalizePosition(req.params.position),
      sourceFile: meta ? meta.fileName : '',
      count: saved.length
    });
  } catch (error) {
    console.error('[ADMIN] Save position rankings error:', error);
    return res.status(400).json({ ok: false, error: 'Unable to save position rankings' });
  }
});

app.post('/api/admin/rankings/position/:position/add', requireAdminDebugKey, async (req, res) => {
  try {
    const position = normalizePosition(req.params.position || req.body.position);
    const name = String(req.body.name || '').trim();
    const team = String(req.body.team || '').trim().toUpperCase();
    const avgValue = toNumber(req.body.avgValue, 0);

    if (!position || !name) {
      return res.status(400).json({ ok: false, error: 'Valid position and name are required' });
    }

    const rankingsData = await readPositionRankingsData(position);
    const exists = rankingsData.players.some((player) => String(player.name || '').toLowerCase() === name.toLowerCase());
    if (exists) {
      return res.status(409).json({ ok: false, error: 'Player already exists in this position file' });
    }

    rankingsData.players.push({
      id: rankingsData.players.length + 1,
      rank: rankingsData.players.length + 1,
      name,
      position,
      team,
      avgValue,
      draftChance: 0
    });

    const saved = await writePositionRankingsData(position, rankingsData.players);
    await rebuildDefaultRankingsFromPositionFiles();
    return res.json({ ok: true, count: saved.length });
  } catch (error) {
    console.error('[ADMIN] Add position rankings player error:', error);
    return res.status(400).json({ ok: false, error: 'Unable to add player to position rankings' });
  }
});

app.post('/api/admin/rankings/position/:position/remove', requireAdminDebugKey, async (req, res) => {
  try {
    const position = normalizePosition(req.params.position || req.body.position);
    const rank = toNumber(req.body.rank, 0);
    const name = String(req.body.name || '').trim().toLowerCase();

    if (!position || (!rank && !name)) {
      return res.status(400).json({ ok: false, error: 'Provide valid position and rank or name' });
    }

    const rankingsData = await readPositionRankingsData(position);
    const filtered = rankingsData.players.filter((player) => {
      if (rank) return toNumber(player.rank, -1) !== rank;
      return String(player.name || '').toLowerCase() !== name;
    });

    if (filtered.length === rankingsData.players.length) {
      return res.status(404).json({ ok: false, error: 'Player not found in this position file' });
    }

    const saved = await writePositionRankingsData(position, filtered);
    await rebuildDefaultRankingsFromPositionFiles();
    return res.json({ ok: true, count: saved.length });
  } catch (error) {
    console.error('[ADMIN] Remove position rankings player error:', error);
    return res.status(400).json({ ok: false, error: 'Unable to remove player from position rankings' });
  }
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error(err.stack);
  // Don't exit, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, just log the error
});

// Fallback: if a path has no extension, try to serve path + '.html' or the join page
app.get('*', (req, res, next) => {
  const urlPath = req.path;
  if (urlPath.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'API route not found' });
  }
  if (path.extname(urlPath)) return next(); // has extension, let static handle
  const tryFile = path.join(root, urlPath + '.html');
  res.sendFile(tryFile, err => {
    if (!err) return;
    res.sendFile(path.join(root, 'join-private.html'), err2 => {
      if (err2) res.status(404).send('Not found');
    });
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: true
  }
});

// In-memory map of drafts for real-time sync. This mirrors client localStorage but is ephemeral.
const drafts = {};
const WAIVER_PICK_TIMER_MS = 2 * 60 * 1000;
const WAIVER_TIMER_TICK_MS = 1000;
const WAIVER_CPU_ACTION_DELAY_MS = 10 * 1000;

function normalizeWaiverMode(mode) {
  return String(mode || '').trim().toLowerCase() === 'skill' ? 'skill' : 'random';
}

function normalizeWaiverLobbyMode(mode) {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'random' || normalized === 'skill') return normalized;
  return 'off';
}

function shuffleList(values = []) {
  const copy = Array.isArray(values) ? values.slice() : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getTeamTotalAvScore(team, draft) {
  const roster = Array.isArray(team && team.roster) ? team.roster : [];
  const allPlayers = draft && draft.draftState && Array.isArray(draft.draftState.allPlayers)
    ? draft.draftState.allPlayers
    : [];

  const byId = new Map();
  const byName = new Map();
  allPlayers.forEach((player) => {
    const id = Number(player && player.id);
    if (Number.isFinite(id) && id > 0) {
      byId.set(id, Number(player && (player.avgValue || player.value) || 0));
    }

    const nameKey = String(player && player.name || '').trim().toLowerCase();
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, Number(player && (player.avgValue || player.value) || 0));
    }
  });

  return roster.reduce((sum, player) => {
    const playerAv = Number(player && (player.avgValue || player.value));
    if (Number.isFinite(playerAv)) {
      return sum + playerAv;
    }

    const playerId = Number(player && player.id);
    if (Number.isFinite(playerId) && playerId > 0 && byId.has(playerId)) {
      return sum + Number(byId.get(playerId) || 0);
    }

    const nameKey = String(player && player.name || '').trim().toLowerCase();
    if (nameKey && byName.has(nameKey)) {
      return sum + Number(byName.get(nameKey) || 0);
    }

    return sum;
  }, 0);
}

function resolveWaiverPositionRank(player) {
  const fallback = parsePositionRankValue(player && player.prerank, 999);
  const position = String(player && player.position || '').trim().toUpperCase();
  const positionRankFieldByPos = {
    QB: 'qbRank',
    RB: 'RBrank',
    WR: 'WRrank',
    TE: 'TErank',
    K: 'Krank',
    DEF: 'DEFrank'
  };

  const specificField = positionRankFieldByPos[position];
  const specificRank = parsePositionRankValue(specificField ? player && player[specificField] : undefined, NaN);
  if (Number.isFinite(specificRank) && specificRank > 0) {
    return specificRank;
  }

  const genericPositionRank = parsePositionRankValue(player && player.positionRank, NaN);
  if (Number.isFinite(genericPositionRank) && genericPositionRank > 0) {
    return genericPositionRank;
  }

  return fallback;
}

function toWaiverPoolPlayer(player) {
  return {
    id: Number(player && player.id),
    name: String(player && player.name || '').trim(),
    position: String(player && player.position || 'UNK').trim().toUpperCase(),
    team: String(player && player.team || '').trim().toUpperCase(),
    avgValue: Number(player && (player.avgValue || player.value) || 0),
    positionRank: resolveWaiverPositionRank(player),
    prerank: Number(player && (player.prerank || player.positionRank) || 999)
  };
}

function buildWaiverPoolFromDraft(draft) {
  const allPlayers = draft && draft.draftState && Array.isArray(draft.draftState.allPlayers)
    ? draft.draftState.allPlayers
    : [];

  const rosteredKeys = new Set();
  const teams = draft && draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft && draft.teams) ? draft.teams : []);

  teams.forEach((team) => {
    (Array.isArray(team && team.roster) ? team.roster : []).forEach((player) => {
      const id = Number(player && player.id);
      if (Number.isFinite(id) && id > 0) {
        rosteredKeys.add(`id:${id}`);
      } else {
        rosteredKeys.add(`name:${String(player && player.name || '').trim().toLowerCase()}`);
      }
    });
  });

  return allPlayers
    .map(toWaiverPoolPlayer)
    .filter((player) => player.name)
    .filter((player) => {
      const key = Number.isFinite(player.id) && player.id > 0
        ? `id:${player.id}`
        : `name:${String(player.name || '').trim().toLowerCase()}`;
      return !rosteredKeys.has(key);
    })
    .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999));
}

function getCurrentWaiverTurnTeamName(waiverState) {
  if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return '';
  const idx = Math.max(0, Math.min(Number(waiverState.turnIndex || 0), waiverState.order.length - 1));
  return String(waiverState.order[idx] || '').trim();
}

function getWaiverActedTeams(waiverState) {
  if (!waiverState || !Array.isArray(waiverState.actedTeams)) return [];
  return waiverState.actedTeams.map((name) => String(name || '').trim()).filter(Boolean);
}

function hasWaiverTeamActed(waiverState, teamName) {
  const normalizedTeamName = String(teamName || '').trim().toLowerCase();
  if (!normalizedTeamName) return false;
  return getWaiverActedTeams(waiverState).some((actedTeamName) => String(actedTeamName || '').trim().toLowerCase() === normalizedTeamName);
}

function markWaiverTeamActed(waiverState, teamName) {
  if (!waiverState || !teamName) return;
  const normalizedTeamName = String(teamName || '').trim().toLowerCase();
  if (!normalizedTeamName) return;
  const actedTeams = getWaiverActedTeams(waiverState);
  if (actedTeams.some((actedTeamName) => String(actedTeamName || '').trim().toLowerCase() === normalizedTeamName)) return;
  actedTeams.push(String(teamName || '').trim());
  waiverState.actedTeams = actedTeams;
}

function getNextUnactedWaiverTeam(waiverState) {
  if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return '';
  const order = waiverState.order.map((name) => String(name || '').trim()).filter(Boolean);
  const currentIndex = Math.max(0, Math.min(Number(waiverState.turnIndex || 0), order.length - 1));
  for (let offset = 1; offset <= order.length; offset += 1) {
    const idx = (currentIndex + offset) % order.length;
    const candidate = order[idx];
    if (!hasWaiverTeamActed(waiverState, candidate)) return candidate;
  }
  return '';
}

function getWaiverTurnDurationMs() {
  return WAIVER_PICK_TIMER_MS;
}

function resetWaiverTurnTimer(waiverState, draft, teamName) {
  if (!waiverState) return;
  const now = Date.now();
  const durationMs = getWaiverTurnDurationMs();
  waiverState.turnDurationMs = durationMs;
  waiverState.turnStartedAt = now;
  waiverState.turnEndsAt = now + durationMs;
}

function advanceWaiverTurn(waiverState, draft) {
  if (!waiverState || !Array.isArray(waiverState.order) || waiverState.order.length === 0) return;

  const nextTeamName = getNextUnactedWaiverTeam(waiverState);
  if (!nextTeamName) {
    waiverState.active = false;
    waiverState.completed = true;
    waiverState.updatedAt = Date.now();
    return;
  }

  const nextIndex = waiverState.order.findIndex((name) => String(name || '').trim() === nextTeamName);
  waiverState.turnIndex = nextIndex >= 0 ? nextIndex : 0;
  resetWaiverTurnTimer(waiverState, draft, nextTeamName);
  waiverState.updatedAt = Date.now();
}

function finalizeWaiverStateProgress(draft, waiverState) {
  if (!draft || !waiverState) return;
  waiverState.pool = buildWaiverPoolFromDraft(draft);
  const order = Array.isArray(waiverState.order) ? waiverState.order.map((name) => String(name || '').trim()).filter(Boolean) : [];
  const actedTeams = getWaiverActedTeams(waiverState);
  const allTeamsActed = order.length > 0 && order.every((teamName) => actedTeams.some((actedTeamName) => String(actedTeamName || '').trim().toLowerCase() === String(teamName || '').trim().toLowerCase()));
  if (waiverState.pool.length === 0 || Number(waiverState.passesInRow || 0) >= order.length || allTeamsActed) {
    waiverState.active = false;
    waiverState.completed = true;
  }
}

function getWaiverPlayerValueMaps(draft) {
  const byId = new Map();
  const byName = new Map();
  const allPlayers = draft && draft.draftState && Array.isArray(draft.draftState.allPlayers)
    ? draft.draftState.allPlayers
    : [];

  allPlayers.forEach((player) => {
    const av = Number(player && (player.avgValue || player.value) || 0);
    const pid = Number(player && player.id);
    if (Number.isFinite(pid) && pid > 0) {
      byId.set(pid, av);
    }
    const nameKey = normalizePlayerNameKey(player && player.name);
    if (nameKey && !byName.has(nameKey)) {
      byName.set(nameKey, av);
    }
  });

  return { byId, byName };
}

function getWaiverPlayerAv(player, valueMaps) {
  const direct = Number(player && (player.avgValue || player.value));
  if (Number.isFinite(direct)) return direct;

  const pid = Number(player && player.id);
  if (Number.isFinite(pid) && pid > 0 && valueMaps && valueMaps.byId && valueMaps.byId.has(pid)) {
    return Number(valueMaps.byId.get(pid) || 0);
  }

  const nameKey = normalizePlayerNameKey(player && player.name);
  if (nameKey && valueMaps && valueMaps.byName && valueMaps.byName.has(nameKey)) {
    return Number(valueMaps.byName.get(nameKey) || 0);
  }

  return 0;
}

function scoreWaiverRoster(roster, rosterSettings, valueMaps) {
  const slotBlueprint = buildSummarySlotBlueprint(rosterSettings || SUMMARY_DEFAULT_ROSTER_SETTINGS);
  const candidates = Array.isArray(roster) ? roster.slice() : [];
  const used = new Set();
  let starterScore = 0;
  let missingStarterPenalty = 0;

  slotBlueprint.forEach((slot) => {
    let bestIndex = -1;
    let bestValue = -Infinity;

    for (let i = 0; i < candidates.length; i += 1) {
      if (used.has(i)) continue;
      const player = candidates[i];
      const pos = normalizePosition(player && player.position);
      if (!slot.eligible.includes(pos)) continue;
      const value = getWaiverPlayerAv(player, valueMaps);
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      used.add(bestIndex);
      starterScore += Math.max(0, bestValue);
    } else {
      // Missing a starter slot is a major structural loss.
      missingStarterPenalty += 12;
    }
  });

  const benchScore = candidates.reduce((sum, player, index) => {
    if (used.has(index)) return sum;
    return sum + Math.max(0, getWaiverPlayerAv(player, valueMaps));
  }, 0);

  return starterScore + (benchScore * 0.22) - missingStarterPenalty;
}

function buildWaiverRosterPlayer(addPlayer) {
  return {
    id: Number(addPlayer && addPlayer.id),
    name: String(addPlayer && addPlayer.name || '').trim(),
    position: String(addPlayer && addPlayer.position || 'UNK').trim().toUpperCase(),
    team: String(addPlayer && addPlayer.team || '').trim().toUpperCase(),
    avgValue: Number(addPlayer && (addPlayer.avgValue || addPlayer.value) || 0),
    value: Number(addPlayer && (addPlayer.value || addPlayer.avgValue) || 0),
    bid: 0,
    prerank: Number(addPlayer && (addPlayer.prerank || addPlayer.positionRank) || 999)
  };
}

function findBestCpuWaiverMove(draft, team) {
  if (!draft || !team || !Array.isArray(team.roster) || team.roster.length === 0) return null;
  const waiverPool = Array.isArray(draft && draft.waiverState && draft.waiverState.pool)
    ? draft.waiverState.pool
    : buildWaiverPoolFromDraft(draft);
  if (!waiverPool.length) return null;

  const rosterSettings = normalizeRosterSettingsForSummary(
    (draft && draft.rosterSettings) || (draft && draft.draftState && draft.draftState.rosterSettings)
  );
  const valueMaps = getWaiverPlayerValueMaps(draft);
  const baseRoster = team.roster.slice();
  const baseScore = scoreWaiverRoster(baseRoster, rosterSettings, valueMaps);

  let bestMove = null;

  waiverPool.forEach((addPlayer) => {
    const addPlayerId = Number(addPlayer && addPlayer.id);
    if (!Number.isFinite(addPlayerId) || addPlayerId <= 0) return;

    const addPlayerAv = getWaiverPlayerAv(addPlayer, valueMaps);
    if (addPlayerAv <= 0) return;

    baseRoster.forEach((dropPlayer, dropIndex) => {
      const dropPlayerId = Number(dropPlayer && dropPlayer.id);
      if (!Number.isFinite(dropPlayerId) || dropPlayerId <= 0) return;
      if (dropPlayerId === addPlayerId) return;

      const candidateRoster = baseRoster.filter((_, idx) => idx !== dropIndex);
      candidateRoster.push(buildWaiverRosterPlayer(addPlayer));

      const candidateScore = scoreWaiverRoster(candidateRoster, rosterSettings, valueMaps);
      const scoreGain = candidateScore - baseScore;
      if (scoreGain <= 0) return;

      const dropPlayerAv = getWaiverPlayerAv(dropPlayer, valueMaps);
      const avDelta = addPlayerAv - dropPlayerAv;

      const candidate = {
        addPlayerId,
        dropPlayerId,
        scoreGain,
        avDelta,
        addPrerank: Number(addPlayer && addPlayer.prerank || 999),
        dropPrerank: Number(dropPlayer && dropPlayer.prerank || 999)
      };

      if (!bestMove) {
        bestMove = candidate;
        return;
      }

      if (candidate.scoreGain > bestMove.scoreGain + 0.001) {
        bestMove = candidate;
        return;
      }

      if (Math.abs(candidate.scoreGain - bestMove.scoreGain) <= 0.001) {
        if (candidate.avDelta > bestMove.avDelta + 0.001) {
          bestMove = candidate;
          return;
        }
        if (Math.abs(candidate.avDelta - bestMove.avDelta) <= 0.001 && candidate.addPrerank < bestMove.addPrerank) {
          bestMove = candidate;
        }
      }
    });
  });

  // Require a meaningful gain to avoid noisy churn.
  if (!bestMove || bestMove.scoreGain < 0.75) return null;
  return bestMove;
}

function applyWaiverAddDropForTeam(draft, team, teamName, addPlayerId, dropPlayerId) {
  const allPlayers = draft && draft.draftState && Array.isArray(draft.draftState.allPlayers)
    ? draft.draftState.allPlayers
    : [];
  const addPlayer = allPlayers.find(player => Number(player && player.id) === Number(addPlayerId));
  const dropIndex = Array.isArray(team && team.roster)
    ? team.roster.findIndex(player => Number(player && player.id) === Number(dropPlayerId))
    : -1;

  if (!addPlayer || dropIndex < 0) {
    return { ok: false, reason: 'player_not_found' };
  }

  const addPlayerCurrentOwner = String(addPlayer.owner || '').trim();
  if (addPlayerCurrentOwner && addPlayerCurrentOwner !== String(teamName || '').trim()) {
    return { ok: false, reason: 'add_player_not_available' };
  }

  const dropPlayer = team.roster[dropIndex];
  team.roster.splice(dropIndex, 1);
  team.roster.push(buildWaiverRosterPlayer(addPlayer));

  addPlayer.owner = String(teamName || '').trim();
  addPlayer.shown = true;
  addPlayer.bid = 0;

  const droppedStatePlayer = allPlayers.find(player => Number(player && player.id) === Number(dropPlayer && dropPlayer.id));
  if (droppedStatePlayer) {
    droppedStatePlayer.owner = null;
    droppedStatePlayer.shown = false;
    droppedStatePlayer.bid = 0;
  }

  return {
    ok: true,
    addPlayer,
    dropPlayer,
    addPlayerName: String(addPlayer && addPlayer.name || '').trim(),
    addPlayerPosition: String(addPlayer && addPlayer.position || '').trim().toUpperCase(),
    dropPlayerName: String(dropPlayer && dropPlayer.name || '').trim(),
    dropPlayerPosition: String(dropPlayer && dropPlayer.position || '').trim().toUpperCase()
  };
}

function recordWaiverTeamActivity(waiverState, teamName, action) {
  if (!waiverState) return;
  if (!Array.isArray(waiverState.teamActivity)) {
    waiverState.teamActivity = [];
  }
  const entry = {
    teamName: String(teamName || '').trim(),
    type: String(action && action.type || 'addDrop').trim(),
    addPlayerName: String(action && action.addPlayerName || '').trim(),
    addPlayerPosition: String(action && action.addPlayerPosition || '').trim().toUpperCase(),
    dropPlayerName: String(action && action.dropPlayerName || '').trim(),
    dropPlayerPosition: String(action && action.dropPlayerPosition || '').trim().toUpperCase(),
    at: Number(action && action.at || Date.now())
  };
  if (!entry.teamName) return;
  waiverState.teamActivity.push(entry);
  waiverState.teamActivity = waiverState.teamActivity.slice(-20);
}

function processCpuWaiverTurns(draftCode, draft) {
  if (!draft || !draft.waiverState || !draft.waiverState.active || draft.waiverState.completed) return false;
  const waiverState = draft.waiverState;
  const currentTeamName = getCurrentWaiverTurnTeamName(waiverState);
  if (!currentTeamName || !isCpuSummaryTeam(currentTeamName, draft)) {
    return false;
  }

  const teams = draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft.teams) ? draft.teams : []);
  if (!Array.isArray(teams) || teams.length === 0) return false;

  const turnStartedAt = Number(waiverState.turnStartedAt || 0);
  const turnAgeMs = Number.isFinite(turnStartedAt) && turnStartedAt > 0
    ? (Date.now() - turnStartedAt)
    : 0;
  if (turnAgeMs < WAIVER_CPU_ACTION_DELAY_MS) {
    return false;
  }

  return resolveCpuWaiverTurnAction(draftCode, draft);
}

function emitWaiverStateUpdate(draftCode, draft) {
  const teams = draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft.teams) ? draft.teams : []);

  io.to(draftCode).emit('waiverStateUpdated', {
    draftCode,
    waiverState: draft.waiverState,
    teams,
    allPlayersSnapshot: (draft.draftState && Array.isArray(draft.draftState.allPlayers)) ? draft.draftState.allPlayers : []
  });
}

function resolveCpuWaiverTurnAction(draftCode, draft) {
  if (!draft || !draft.waiverState || !draft.waiverState.active || draft.waiverState.completed) return false;
  const waiverState = draft.waiverState;
  const teamName = getCurrentWaiverTurnTeamName(waiverState);
  if (!teamName || !isCpuSummaryTeam(teamName, draft)) return false;

  const teams = draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft.teams) ? draft.teams : []);
  if (!Array.isArray(teams) || teams.length === 0) return false;

  const team = teams.find(t => String(t && t.name || '').trim() === teamName);
  if (!team || !Array.isArray(team.roster)) {
    markWaiverTeamActed(waiverState, teamName);
    waiverState.passesInRow = Number(waiverState.passesInRow || 0) + 1;
    waiverState.lastAction = {
      type: 'cpuPass',
      by: teamName,
      reason: 'team_not_found',
      at: Date.now()
    };
    recordWaiverTeamActivity(waiverState, teamName, {
      type: 'pass',
      at: Date.now()
    });
    advanceWaiverTurn(waiverState, draft);
    finalizeWaiverStateProgress(draft, waiverState);
    if (draft.draftState && Array.isArray(draft.draftState.teams)) draft.draftState.teams = teams;
    if (Array.isArray(draft.teams)) draft.teams = teams;
    emitWaiverStateUpdate(draftCode, draft);
    return true;
  }

  const move = findBestCpuWaiverMove(draft, team);
  if (!move) {
    markWaiverTeamActed(waiverState, teamName);
    waiverState.passesInRow = Number(waiverState.passesInRow || 0) + 1;
    waiverState.lastAction = {
      type: 'cpuPass',
      by: teamName,
      reason: 'no_upgrade_found',
      at: Date.now()
    };
    recordWaiverTeamActivity(waiverState, teamName, {
      type: 'pass',
      at: Date.now()
    });
    advanceWaiverTurn(waiverState, draft);
    finalizeWaiverStateProgress(draft, waiverState);
    if (draft.draftState && Array.isArray(draft.draftState.teams)) draft.draftState.teams = teams;
    if (Array.isArray(draft.teams)) draft.teams = teams;
    emitWaiverStateUpdate(draftCode, draft);
    return true;
  }

  const applied = applyWaiverAddDropForTeam(draft, team, teamName, move.addPlayerId, move.dropPlayerId);
  if (!applied.ok) {
    markWaiverTeamActed(waiverState, teamName);
    waiverState.passesInRow = Number(waiverState.passesInRow || 0) + 1;
    waiverState.lastAction = {
      type: 'cpuPass',
      by: teamName,
      reason: applied.reason || 'apply_failed',
      at: Date.now()
    };
    recordWaiverTeamActivity(waiverState, teamName, {
      type: 'pass',
      at: Date.now()
    });
    advanceWaiverTurn(waiverState, draft);
    finalizeWaiverStateProgress(draft, waiverState);
    if (draft.draftState && Array.isArray(draft.draftState.teams)) draft.draftState.teams = teams;
    if (Array.isArray(draft.teams)) draft.teams = teams;
    emitWaiverStateUpdate(draftCode, draft);
    return true;
  }

  markWaiverTeamActed(waiverState, teamName);
  waiverState.passesInRow = 0;
  waiverState.lastAction = {
    type: 'cpuAddDrop',
    by: teamName,
    addPlayerId: move.addPlayerId,
    dropPlayerId: move.dropPlayerId,
    addPlayerName: String(applied.addPlayerName || '').trim(),
    addPlayerPosition: String(applied.addPlayerPosition || '').trim().toUpperCase(),
    dropPlayerName: String(applied.dropPlayerName || '').trim(),
    dropPlayerPosition: String(applied.dropPlayerPosition || '').trim().toUpperCase(),
    scoreGain: Number(move.scoreGain.toFixed(3)),
    at: Date.now()
  };
  recordWaiverTeamActivity(waiverState, teamName, {
    type: 'addDrop',
    addPlayerName: String(applied.addPlayerName || '').trim(),
    addPlayerPosition: String(applied.addPlayerPosition || '').trim().toUpperCase(),
    dropPlayerName: String(applied.dropPlayerName || '').trim(),
    dropPlayerPosition: String(applied.dropPlayerPosition || '').trim().toUpperCase(),
    at: Date.now()
  });
  advanceWaiverTurn(waiverState, draft);
  finalizeWaiverStateProgress(draft, waiverState);
  if (draft.draftState && Array.isArray(draft.draftState.teams)) draft.draftState.teams = teams;
  if (Array.isArray(draft.teams)) draft.teams = teams;
  emitWaiverStateUpdate(draftCode, draft);
  return true;
}

function applyWaiverAutoPassIfExpired(draftCode, draft) {
  if (!draft || !draft.waiverState) return false;
  const waiverState = draft.waiverState;
  if (!waiverState.active || waiverState.completed) return false;

  if (processCpuWaiverTurns(draftCode, draft)) {
    return true;
  }

  const turnEndsAt = Number(waiverState.turnEndsAt || 0);
  if (!Number.isFinite(turnEndsAt) || turnEndsAt <= 0) {
    resetWaiverTurnTimer(waiverState);
    waiverState.updatedAt = Date.now();
    return false;
  }

  if (Date.now() < turnEndsAt) return false;

  const expectedTeamName = getCurrentWaiverTurnTeamName(waiverState);

  markWaiverTeamActed(waiverState, expectedTeamName);
  waiverState.passesInRow = Number(waiverState.passesInRow || 0) + 1;
  waiverState.lastAction = {
    type: 'autoPass',
    by: expectedTeamName || null,
    reason: 'timer_expired',
    at: Date.now()
  };
  advanceWaiverTurn(waiverState, draft);
  finalizeWaiverStateProgress(draft, waiverState);
  processCpuWaiverTurns(draftCode, draft);

  const teams = draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft.teams) ? draft.teams : []);

  io.to(draftCode).emit('waiverStateUpdated', {
    draftCode,
    waiverState,
    teams,
    allPlayersSnapshot: (draft.draftState && Array.isArray(draft.draftState.allPlayers)) ? draft.draftState.allPlayers : []
  });

  return true;
}

setInterval(() => {
  Object.entries(drafts).forEach(([draftCode, draft]) => {
    try {
      applyWaiverAutoPassIfExpired(draftCode, draft);
    } catch (error) {
      console.error(`[waiverTimer] Failed auto-pass tick for ${draftCode}:`, error);
    }
  });
}, WAIVER_TIMER_TICK_MS);

const SUMMARY_DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 5 };

function toRosterIntForSummary(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeRosterSettingsForSummary(raw) {
  const merged = Object.assign({}, SUMMARY_DEFAULT_ROSTER_SETTINGS, raw || {});
  const normalized = {
    QB: toRosterIntForSummary(merged.QB, SUMMARY_DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
    WR: toRosterIntForSummary(merged.WR, SUMMARY_DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
    RB: toRosterIntForSummary(merged.RB, SUMMARY_DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
    TE: toRosterIntForSummary(merged.TE, SUMMARY_DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
    FLEX: toRosterIntForSummary(merged.FLEX, SUMMARY_DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
    K: toRosterIntForSummary(merged.K, SUMMARY_DEFAULT_ROSTER_SETTINGS.K, 0, 5),
    DEF: toRosterIntForSummary(merged.DEF, SUMMARY_DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
    BN: toRosterIntForSummary(merged.BN, SUMMARY_DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
  };
  const total = normalized.QB + normalized.WR + normalized.RB + normalized.TE + normalized.FLEX + normalized.K + normalized.DEF + normalized.BN;
  if (total < 8) normalized.BN += (8 - total);
  return normalized;
}

function buildSummarySlotBlueprint(settings) {
  const slotBlueprint = [];
  const addSlots = (count, eligible) => {
    for (let i = 0; i < count; i += 1) slotBlueprint.push({ eligible });
  };
  addSlots(settings.QB || 0, ['QB']);
  addSlots(settings.WR || 0, ['WR']);
  addSlots(settings.RB || 0, ['RB']);
  addSlots(settings.TE || 0, ['TE']);
  addSlots(settings.FLEX || 0, ['RB', 'WR', 'TE']);
  addSlots(settings.K || 0, ['K']);
  addSlots(settings.DEF || 0, ['DEF']);
  return slotBlueprint;
}

function getDraftBenchCutTarget(draft) {
  const rawCutTarget = Number.parseInt(draft && draft.benchCutTarget, 10);
  return Number.isFinite(rawCutTarget) ? Math.max(0, Math.min(rawCutTarget, 13)) : 5;
}

function splitSummaryRoster(roster, rosterSettings) {
  const slotBlueprint = buildSummarySlotBlueprint(rosterSettings);
  const used = [];
  slotBlueprint.forEach((slot) => {
    const found = (Array.isArray(roster) ? roster : [])
      .filter(p => slot.eligible.includes(p.position) && !used.includes(p))
      .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;
    if (found) used.push(found);
  });

  const bench = (Array.isArray(roster) ? roster : []).filter(p => !used.includes(p));
  return { slotBlueprint, bench };
}

function getRequiredCutsForTeamSummary(team, draft) {
  const rosterSettings = normalizeRosterSettingsForSummary(
    (draft && draft.rosterSettings) || (draft && draft.draftState && draft.draftState.rosterSettings)
  );
  const roster = Array.isArray(team && team.roster) ? team.roster : [];
  const { slotBlueprint, bench } = splitSummaryRoster(roster, rosterSettings);
  const benchCutTarget = getDraftBenchCutTarget(draft);
  const maxTotalPlayers = slotBlueprint.length + benchCutTarget;
  const overTotal = Math.max(0, roster.length - maxTotalPlayers);
  const overBench = Math.max(0, bench.length - benchCutTarget);
  return {
    requiredCuts: Math.max(overTotal, overBench),
    bench,
    maxTotalPlayers,
    benchCutTarget
  };
}

function isCpuSummaryTeam(teamName, draft) {
  const normalizedTeam = String(teamName || '').trim().toLowerCase();
  const members = Array.isArray(draft && draft.members) ? draft.members : [];
  return !members.some(member => String(member || '').trim().toLowerCase() === normalizedTeam);
}

function buildDraftCutDebugRows(draft) {
  const teams = draft && draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft && draft.teams) ? draft.teams : []);

  return teams.map((team) => {
    const cutState = getRequiredCutsForTeamSummary(team, draft);
    return {
      teamName: String(team && team.name || '').trim() || 'Unknown Team',
      isCpu: isCpuSummaryTeam(team && team.name, draft),
      requiredCuts: Number(cutState.requiredCuts || 0),
      benchCount: Array.isArray(cutState.bench) ? cutState.bench.length : 0,
      benchCutTarget: Number(cutState.benchCutTarget || 0),
      rosterCount: Array.isArray(team && team.roster) ? team.roster.length : 0,
      maxTotalPlayers: Number(cutState.maxTotalPlayers || 0)
    };
  });
}

function logDraftCutDebug(draft, draftCode = 'unknown', context = 'unknown') {
  const rows = buildDraftCutDebugRows(draft);
  if (!rows.length) {
    console.log(`[WAIVER CUT DEBUG][${draftCode}] ${context} no teams available`);
    return;
  }

  const blockers = rows.filter(row => row.requiredCuts > 0);
  const summary = rows.map((row) => (
    `${row.teamName}{${row.isCpu ? 'CPU' : 'HUM'} cuts:${row.requiredCuts} bench:${row.benchCount}/${row.benchCutTarget} roster:${row.rosterCount}/${row.maxTotalPlayers}}`
  )).join(' | ');

  console.log(`[WAIVER CUT DEBUG][${draftCode}] ${context} blockers=${blockers.length}/${rows.length} :: ${summary}`);
}

function autoCutCpuTeamsForSummary(draft) {
  const teams = draft && draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft && draft.teams) ? draft.teams : null);

  if (!teams || teams.length === 0) {
    return { changedTeamNames: [], teams, allPlayers: [] };
  }

  const allPlayers = draft && draft.draftState && Array.isArray(draft.draftState.allPlayers)
    ? draft.draftState.allPlayers
    : [];
  const normalizeName = (name) => String(name || '').trim().toLowerCase();
  const changedTeamNames = [];

  teams.forEach((team) => {
    if (!team || !Array.isArray(team.roster)) return;
    const teamName = String(team.name || '').trim() || 'Unknown Team';
    const isCpuTeam = isCpuSummaryTeam(team.name, draft);
    if (!isCpuTeam) {
      return;
    }

    const initialCutState = getRequiredCutsForTeamSummary(team, draft);
    console.log(`[CPU CUT DEBUG] ${teamName} before auto-cut: requiredCuts=${initialCutState.requiredCuts}, bench=${initialCutState.bench.length}/${initialCutState.benchCutTarget}, roster=${(team.roster || []).length}/${initialCutState.maxTotalPlayers}`);

    const removedPlayers = [];
    let guard = 0;
    while (guard < 40) {
      guard += 1;
      const { requiredCuts, bench } = getRequiredCutsForTeamSummary(team, draft);
      if (requiredCuts <= 0) break;

      const benchCandidates = bench
        .slice()
        .sort((a, b) => Number(b.prerank || 999) - Number(a.prerank || 999));
      const rosterCandidates = team.roster
        .slice()
        .sort((a, b) => Number(b.prerank || 999) - Number(a.prerank || 999));
      const candidate = benchCandidates[0] || rosterCandidates[0] || null;
      if (!candidate) {
        console.warn(`[CPU CUT DEBUG] ${teamName} no removable candidate found while requiredCuts=${requiredCuts}`);
        break;
      }

      const candidateId = Number(candidate && candidate.id);
      const candidateName = normalizeName(candidate && candidate.name);
      const removeIndex = team.roster.findIndex((player) => {
        const playerId = Number(player && player.id);
        if (Number.isFinite(candidateId) && Number.isFinite(playerId)) {
          return playerId === candidateId;
        }
        return normalizeName(player && player.name) === candidateName;
      });

      if (removeIndex < 0) {
        console.warn(`[CPU CUT DEBUG] ${teamName} failed to find roster index for candidate ${String(candidate && candidate.name || '').trim()}`);
        break;
      }
      const [removed] = team.roster.splice(removeIndex, 1);
      if (removed) removedPlayers.push(removed);
    }

    if (removedPlayers.length > 0) {
      changedTeamNames.push(teamName);
      removedPlayers.forEach((player) => {
        const removedId = Number(player && player.id);
        const removedName = normalizeName(player && player.name);
        const match = allPlayers.find((candidate) => {
          const candidateId = Number(candidate && candidate.id);
          if (Number.isFinite(removedId) && Number.isFinite(candidateId)) {
            return candidateId === removedId;
          }
          return normalizeName(candidate && candidate.name) === removedName;
        });

        if (match) {
          match.owner = null;
          match.shown = false;
          match.bid = 0;
        }
      });

      console.log(`[CPU CUT DEBUG] ${teamName} removed ${removedPlayers.length} player(s): ${removedPlayers.map(player => String(player && player.name || '').trim()).filter(Boolean).join(', ')}`);
    }

    const finalCutState = getRequiredCutsForTeamSummary(team, draft);
    console.log(`[CPU CUT DEBUG] ${teamName} after auto-cut: requiredCuts=${finalCutState.requiredCuts}, bench=${finalCutState.bench.length}/${finalCutState.benchCutTarget}, roster=${(team.roster || []).length}/${finalCutState.maxTotalPlayers}`);
    if (finalCutState.requiredCuts > 0) {
      console.warn(`[CPU CUT DEBUG] ${teamName} still incomplete after auto-cut (requiredCuts=${finalCutState.requiredCuts})`);
    }
  });

  if (draft.draftState && Array.isArray(draft.draftState.teams)) {
    draft.draftState.teams = teams;
  }
  if (Array.isArray(draft.teams)) {
    draft.teams = teams;
  }

  if (draft.waiverState && draft.waiverState.active) {
    draft.waiverState.pool = buildWaiverPoolFromDraft(draft);
    draft.waiverState.updatedAt = Date.now();
  }

  return { changedTeamNames, teams, allPlayers };
}

function areAllTeamsCutCompleteForSummary(draft) {
  const teams = draft && draft.draftState && Array.isArray(draft.draftState.teams)
    ? draft.draftState.teams
    : (Array.isArray(draft && draft.teams) ? draft.teams : []);
  return teams.every((team) => getRequiredCutsForTeamSummary(team, draft).requiredCuts <= 0);
}

// Current draft ID for database logging
let currentDraftId = null;

// ==================== AUCTION LOGIC FUNCTIONS ====================

// Helper function: Check if player can be added to roster.
// Enforces max roster size and per-position caps from rosterLimits.
function isValidRosterAddition(team, player, rosterLimits, maxRosterSize = null) {
  if (!team || !player) return false;

  const roster = Array.isArray(team.roster) ? team.roster : [];
  if (typeof maxRosterSize === 'number' && roster.length >= maxRosterSize) {
    return false;
  }

  const position = normalizePosition(player.position);
  if (!position) return false;

  const counts = roster.reduce((acc, p) => {
    const pos = normalizePosition(p && p.position);
    if (pos) acc[pos] = (acc[pos] || 0) + 1;
    return acc;
  }, {});

  const currentAtPosition = Number(counts[position] || 0);
  const configuredMax = Number(rosterLimits?.[position]?.max);
  const hasConfiguredMax = Number.isFinite(configuredMax) && configuredMax > 0;

  if (position === 'K' || position === 'DEF') {
    const configuredMin = Number(rosterLimits?.[position]?.min || 1);
    const minimumSpecialists = Math.max(1, configuredMin);
    const inferredMaxRoster = typeof maxRosterSize === 'number' && maxRosterSize > 0
      ? maxRosterSize
      : Math.max(1, roster.length + 3);
    const nearFullRoster = roster.length >= Math.max(1, inferredMaxRoster - 2);
    const dynamicSpecialistCap = minimumSpecialists + (nearFullRoster ? 1 : 0);
    const specialistCap = hasConfiguredMax
      ? Math.min(configuredMax, dynamicSpecialistCap)
      : dynamicSpecialistCap;
    return currentAtPosition < specialistCap;
  }

  if (hasConfiguredMax) {
    return currentAtPosition < configuredMax;
  }

  // Fallback guards if limits are missing.
  if ((position === 'K' || position === 'DEF') && currentAtPosition >= 1) return false;
  if (position === 'QB' && currentAtPosition >= 2) return false;
  if (position === 'TE' && currentAtPosition >= 2) return false;
  return true;
}

// Helper function: Get bid range based on position and AV
function getBidRange(position, avgValue) {
  // Define bid ranges by position and value (from your original table)
  const bidRanges = {
    QB: {
      '1-5': { min: 0.65, max: 1.65 },
      '5-10': { min: 0.7, max: 1.45 },
      '10-20': { min: 0.75, max: 1.45 },
      '20-30': { min: 0.8, max: 1.35 },
      '30-40': { min: 0.85, max: 1.25 },
      '40-50': { min: 1.0, max: 1.8 },
      '50-60': { min: 1.1, max: 1.9 },
      '60+': { min: 1.2, max: 2.0 }
    },
    RB: {
      '1-5': { min: 0.5, max: 1.55 },
      '5-10': { min: 0.6, max: 1.45 },
      '10-20': { min: 0.6, max: 1.4 },
      '20-30': { min: 0.7, max: 1.35 },
      '30-40': { min: 0.8, max: 1.25 },
      '40-50': { min: 0.9, max: 1.15 },
      '50-60': { min: 0.92, max: 1.15 },
      '60+': { min: 0.95, max: 1.08 }
    },
    WR: {
      '1-5': { min: 0.5, max: 1.55 },
      '5-10': { min: 0.6, max: 1.45 },
      '10-20': { min: 0.6, max: 1.4 },
      '20-30': { min: 0.7, max: 1.35 },
      '30-40': { min: 0.8, max: 1.25 },
      '40-50': { min: 0.9, max: 1.15 },
      '50-60': { min: 0.92, max: 1.15 },
      '60+': { min: 0.95, max: 1.08 }
    },
    TE: {
      '1-5': { min: 0.4, max: 0.8 },
      '5-10': { min: 0.5, max: 0.9 },
      '10-20': { min: 0.5, max: 1.3 },
      '20-30': { min: 0.6, max: 1.4 },
      '30-40': { min: 0.7, max: 1.5 },
      '40-50': { min: 0.8, max: 1.6 },
      '50-60': { min: 0.9, max: 1.7 },
      '60+': { min: 1.0, max: 1.8 }
    }
  };

  // Get range key based on AV
  function getRangeKey(avgValue) {
    if (avgValue <= 5) return '1-5';
    if (avgValue <= 10) return '5-10';
    if (avgValue <= 20) return '10-20';
    if (avgValue <= 30) return '20-30';
    if (avgValue <= 40) return '30-40';
    if (avgValue <= 50) return '40-50';
    if (avgValue <= 60) return '50-60';
    return '60+';
  }

  const positionRanges = bidRanges[position] || bidRanges['RB']; // Default to RB if position not found
  const rangeKey = getRangeKey(avgValue);
  return positionRanges[rangeKey] || { min: 0.5, max: 1.0 }; // Fallback
}

// ==================== TIED LIVE AUCTION MODULE ====================

// Helper function: Process all auctions for a round
async function processAuctions(roundPlayers, teams, cpuBids, userBids, rosterLimits, flexPositions, rosterSize, roundNumber) {
  try {
    const safeRoundPlayers = Array.isArray(roundPlayers) ? roundPlayers : [];
    const results = [];
    const tiedBids = [];
    const allIndividualBids = []; // Collect all bids for bulk database operations
    const maxRosterSize = Math.max(1, Number(rosterSize || 0) + 3);
    const targetRosterSize = Math.max(1, Number(rosterSize || 0));
    const floorRosterSize = Math.max(1, targetRosterSize - 2);
    const floorPriorityActive = Number(roundNumber || 0) >= 9;
    const teamRoundState = new Map(
      (teams || []).map((team) => [
        String(team && team.name || ''),
        {
          budgetRemaining: Math.max(0, Number(team && team.budget || 0)),
          rosterCount: Array.isArray(team && team.roster) ? team.roster.length : 0
        }
      ])
    );

    console.log(`[processAuctions] Processing ${safeRoundPlayers.length} players`);
    console.log(`[processAuctions] User bids:`, JSON.stringify(userBids));
    console.log(`[processAuctions] CPU teams with bids:`, Object.keys(cpuBids));
    
    // Log which players have user bids
    const playersWithUserBids = Object.keys(userBids).filter(playerId => 
      Object.keys(userBids[playerId]).length > 0
    );
    console.log(`[processAuctions] Players with user bids: ${playersWithUserBids.length} out of ${safeRoundPlayers.length}`);
    playersWithUserBids.forEach(playerId => {
      const player = safeRoundPlayers.find(p => p.id == playerId);
      const bidTeams = Object.keys(userBids[playerId]);
      console.log(`[processAuctions] ${player ? player.name : 'Unknown player'} (${playerId}): bids from ${bidTeams.join(', ')}`);
    });

  function capCpuBidForSpecialists(player, amount) {
    const pos = String(player && player.position || '').toUpperCase();
    const safeAmount = Math.max(0, Number(amount || 0));
    const isLate = Number(roundNumber || 0) >= 7;
    const av = Math.max(1, Number(player && player.avgValue || 1));
    if (pos === 'K') {
      const kCap = isLate ? Math.max(2, Math.round(av * 1.2)) : Math.max(2, Math.round(av * 1.5));
      return Math.min(safeAmount, kCap);
    }
    if (pos === 'DEF') {
      const defCap = isLate ? Math.max(3, Math.round(av * 1.35)) : Math.max(4, Math.round(av * 1.6));
      return Math.min(safeAmount, defCap);
    }
    return safeAmount;
  }

  const cpuCfgSilent = (loadCpuLogicConfig()?.silent) || {};
  function getAvRangeKey(avValue) {
    const av = Number(avValue || 0);
    if (av <= 5) return '1-5';
    if (av <= 10) return '5-10';
    if (av <= 20) return '10-20';
    if (av <= 30) return '20-30';
    if (av <= 40) return '30-40';
    if (av <= 50) return '40-50';
    if (av <= 60) return '50-60';
    return '60+';
  }

  function capCpuBidByAvGuardrail(player, amount, budgetRemaining) {
    const av = Math.max(0, Number(player && player.avgValue || 0));
    const safeAmount = Math.max(0, Number(amount || 0));
    const safeBudget = Math.max(0, Number(budgetRemaining || 0));
    if (av <= 0) {
      return Math.min(safeAmount, safeBudget);
    }

    const multiplierByBucket = {
      '1-5': Math.max(1.0, Number(cpuCfgSilent?.avCapMult1to5 ?? 1.24)),
      '5-10': Math.max(1.0, Number(cpuCfgSilent?.avCapMult5to10 ?? 1.2)),
      '10-20': Math.max(1.0, Number(cpuCfgSilent?.avCapMult10to20 ?? 1.16)),
      '20-30': Math.max(1.0, Number(cpuCfgSilent?.avCapMult20to30 ?? 1.12)),
      '30-40': Math.max(1.0, Number(cpuCfgSilent?.avCapMult30to40 ?? 1.1)),
      '40-50': Math.max(1.0, Number(cpuCfgSilent?.avCapMult40to50 ?? 1.08)),
      '50-60': Math.max(1.0, Number(cpuCfgSilent?.avCapMult50to60 ?? 1.07)),
      '60+': Math.max(1.0, Number(cpuCfgSilent?.avCapMult60Plus ?? 1.06))
    };

    const bucket = getAvRangeKey(av);
    const bucketMultiplier = multiplierByBucket[bucket] || 1.1;
    const baseBuffer = Math.max(0, Number(cpuCfgSilent?.avCapBaseBuffer ?? 1));
    const lateRoundExtraBuffer = Math.max(0, Number(cpuCfgSilent?.avCapLateRoundExtraBuffer ?? 1));
    const targetOverbidMax = Math.max(0, Math.floor(Number(cpuCfgSilent?.targetPlayerOverbidMax ?? 3)));

    let avSoftCap = Math.floor((av * bucketMultiplier) + baseBuffer);
    if (Number(roundNumber || 0) >= 8) {
      avSoftCap += lateRoundExtraBuffer;
    }

    // Server-side safety net: allow at most +$3 over AV soft cap for any CPU bid.
    // Main bidding logic still enforces tighter target-only +$2-$3 behavior.
    const hardGuardrail = Math.max(1, Math.min(safeBudget, avSoftCap + targetOverbidMax));
    return Math.min(safeAmount, hardGuardrail);
  }

  function applyCpuBidJitter(baseAmount, player, teamName, state) {
    const safeBase = Math.max(0, Number(baseAmount || 0));
    const safeBudget = Math.max(0, Number(state?.budgetRemaining || 0));
    if (safeBase <= 0 || safeBudget <= 0) return Math.min(safeBase, safeBudget);

    const round = Math.max(1, Number(roundNumber || 1));
    const av = Math.max(1, Number(player?.avgValue || 1));
    const shouldJitter = round <= 3 && (av >= 12 || Math.random() < 0.55);
    if (!shouldJitter) return Math.min(safeBase, safeBudget);

    const maxExtra = round <= 2 ? 4 : 2;
    const extra = Math.floor(Math.random() * (maxExtra + 1));
    const jittered = Math.min(safeBudget, safeBase + extra);
    return Math.max(1, jittered);
  }

  safeRoundPlayers.forEach(player => {
    try {
    const bids = [];
    
    // Collect user bids from draftState.bids
    Object.keys(userBids[player.id] || {}).forEach(teamName => {
      const team = teams.find(t => t.name === teamName);
      const bidAmount = userBids[player.id][teamName];
      const state = teamRoundState.get(String(teamName || ''));
      const canBid = state
        && state.rosterCount < maxRosterSize
        && bidAmount > 0
        && bidAmount <= state.budgetRemaining
        && isValidRosterAddition(team, player, rosterLimits, maxRosterSize);
      if (team && canBid) {
        bids.push({ team, amount: bidAmount, source: 'user' });
        // Collect for bulk logging instead of individual logging
        allIndividualBids.push({
          draftId: currentDraftId || 'default_draft',
          roundNumber,
          player,
          bidderTeam: teamName,
          bidAmount,
          isWinning: false,
          isSecondHighest: false
        });
        console.log(`[processAuctions] ${player.name}: User bid from ${teamName} = $${bidAmount}`);
      }
    });

    // Collect CPU bids
    Object.keys(cpuBids).forEach(cpuName => {
      const cpuTeam = teams.find(t => t.name === cpuName);
      const cpuBidObj = cpuBids[cpuName].find(b => b.player.id === player.id);
      const state = teamRoundState.get(String(cpuName || ''));
      const specialistCappedBid = cpuBidObj ? capCpuBidForSpecialists(player, cpuBidObj.cpuBid) : 0;
      const cappedCpuBid = cpuBidObj
        ? capCpuBidByAvGuardrail(player, specialistCappedBid, state?.budgetRemaining || 0)
        : 0;
      const jitteredCpuBid = applyCpuBidJitter(cappedCpuBid, player, cpuName, state);
      const canBid = state
        && state.rosterCount < maxRosterSize
        && cpuBidObj
        && jitteredCpuBid > 0
        && jitteredCpuBid <= state.budgetRemaining
        && isValidRosterAddition(cpuTeam, player, rosterLimits, maxRosterSize);
      if (cpuBidObj && cpuTeam && canBid) {
        bids.push({ team: cpuTeam, amount: jitteredCpuBid, source: 'cpu' });
        // Collect for bulk logging instead of individual logging
        allIndividualBids.push({
          draftId: currentDraftId || 'default_draft',
          roundNumber,
          player,
          bidderTeam: cpuName,
          bidAmount: jitteredCpuBid,
          isWinning: false,
          isSecondHighest: false
        });
        console.log(`[processAuctions] ${player.name}: CPU bid from ${cpuName} = $${jitteredCpuBid}`);
      }
    });

    const gatedBids = applySpecialistParticipationGate(player, bids, rosterLimits);
    console.log(`[processAuctions] ${player.name}: Total bids = ${gatedBids.length}`);

    const floorNeedBidders = floorPriorityActive
      ? gatedBids.filter((entry) => {
          const state = teamRoundState.get(String(entry?.team?.name || ''));
          return (state && Number(state.rosterCount || 0) < floorRosterSize);
        })
      : [];
    const eligibleBids = floorNeedBidders.length > 0 ? floorNeedBidders : gatedBids;

    // Create allBids array with ALL teams (including those who bid $0)
    const allTeamsBids = teams.map(team => {
      // Check if this team bid on this player
      const bidEntry = gatedBids.find(b => b.team.name === team.name);
      return {
        teamName: team.name,
        amount: bidEntry ? bidEntry.amount : 0
      };
    });

    const maxBid = Math.max(...eligibleBids.map(b => b.amount), 0);
    const topBidders = eligibleBids.filter(b => b.amount === maxBid);

    if (topBidders.length === 1 && maxBid > 0) {
      const winner = topBidders[0].team;
      const winnerState = teamRoundState.get(String(winner && winner.name || ''));
      if (
        !winnerState
        || winnerState.rosterCount >= maxRosterSize
        || winnerState.budgetRemaining <= 0
        || !isValidRosterAddition(winner, player, rosterLimits, maxRosterSize)
      ) {
        results.push({
          type: 'undrafted',
          playerId: player.id,
          playerName: player.name,
          allBids: allTeamsBids
        });
        return;
      }
      const sortedEligibleBids = eligibleBids
        .map((entry) => ({ team: entry.team, amount: Number(entry.amount || 0) }))
        .sort((a, b) => b.amount - a.amount);
      const runnerUpBidEntry = sortedEligibleBids.find((entry) => entry.amount < maxBid) || null;
      const rawSecondHighestBid = runnerUpBidEntry ? Number(runnerUpBidEntry.amount || 0) : 0;
      // Guardrail: second-highest must always be strictly below the winning bid.
      const secondHighestBid = Math.max(0, Math.min(rawSecondHighestBid, maxBid - 1));
      const secondHighestBidder = runnerUpBidEntry ? String(runnerUpBidEntry.team && runnerUpBidEntry.team.name || '') : null;
      // Silent-auction pricing rule: pay $1 over second highest, never above your own winning bid,
      // and never above remaining budget.
      const unclampedFinalPrice = Math.max(secondHighestBid + 1, 1);
      const finalPrice = Math.max(1, Math.min(unclampedFinalPrice, maxBid, Number(winnerState.budgetRemaining || 0)));

      if (finalPrice > maxBid || finalPrice !== unclampedFinalPrice) {
        console.warn(`[processAuctions] Pricing adjusted for ${player.name}: maxBid=$${maxBid}, rawSecond=$${rawSecondHighestBid}, second=$${secondHighestBid}, unclamped=$${unclampedFinalPrice}, final=$${finalPrice}`);
      }
      
      // Mark winning and second highest bids in our collected data
      const winnerBidIndex = allIndividualBids.findIndex(b =>
        b.player.id === player.id && b.bidderTeam === winner.name && b.bidAmount === maxBid
      );
      if (winnerBidIndex !== -1) {
        allIndividualBids[winnerBidIndex].isWinning = true;
      }

      if (secondHighestBidder) {
        const secondBidIndex = allIndividualBids.findIndex(b =>
          b.player.id === player.id && b.bidderTeam === secondHighestBidder && b.bidAmount === secondHighestBid
        );
        if (secondBidIndex !== -1) {
          allIndividualBids[secondBidIndex].isSecondHighest = true;
        }
      }
      
      results.push({
        type: 'won',
        playerId: player.id,
        playerName: player.name,
        playerPosition: player.position,
        playerPrerank: player.prerank || player.avgValue,
        playerPositionRank: player.positionRank,
        winnerTeam: winner.name,
        bidAmount: maxBid,
        pricePaid: finalPrice,
        secondHighestBid: secondHighestBid,
        secondHighestBidder: secondHighestBidder,
        allBids: allTeamsBids
      });

      winnerState.budgetRemaining = Math.max(0, winnerState.budgetRemaining - finalPrice);
      winnerState.rosterCount += 1;
    } else if (topBidders.length > 1) {
      tiedBids.push({
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        avgValue: player.avgValue,
        positionRank: player.positionRank,
        tiedTeams: topBidders.map(b => b.team.name),
        bidAmount: maxBid
      });
      results.push({
        type: 'tied',
        playerId: player.id,
        playerName: player.name,
        tiedTeams: topBidders.map(b => b.team.name),
        bidAmount: maxBid,
        allBids: allTeamsBids
      });
    } else {
      results.push({
        type: 'undrafted',
        playerId: player.id,
        playerName: player.name,
        allBids: allTeamsBids
      });
    }
    } catch (playerError) {
      console.error('[processAuctions] Player processing error:', {
        roundNumber,
        playerId: player && player.id,
        playerName: player && player.name,
        error: playerError && playerError.message
      });
      results.push({
        type: 'undrafted',
        playerId: player && player.id,
        playerName: String(player && player.name || `Player ${player && player.id ? player.id : '?'}`),
        allBids: (Array.isArray(teams) ? teams : []).map((team) => ({
          teamName: String(team && team.name || ''),
          amount: 0
        }))
      });
    }
  });

  // Bulk database operations - much more efficient!
  console.log(`[processAuctions] Performing bulk database operations for ${allIndividualBids.length} bids...`);

  try {
    // Bulk insert all individual bids
    if (allIndividualBids.length > 0) {
      await bulkLogIndividualBids(allIndividualBids);
      console.log(`[processAuctions] Bulk logged ${allIndividualBids.length} individual bids`);
    }

    // Log auction results (these are fewer operations)
    const auctionResults = results.filter(r => r.type === 'won');
    for (const result of auctionResults) {
      const player = safeRoundPlayers.find(p => p.id === result.playerId);
      if (player) {
        await logAuctionResult(
          currentDraftId || 'default_draft',
          roundNumber,
          player,
          { name: result.winnerTeam },
          result.pricePaid,
          result.secondHighestBid,
          result.secondHighestBidder
        );
      }
    }
    console.log(`[processAuctions] Logged ${auctionResults.length} auction results`);

  } catch (error) {
    console.error('[processAuctions] Database logging error:', error);
  }

  const totalBidAmount = allIndividualBids.reduce((sum, bid) => sum + Math.max(0, Number(bid && bid.bidAmount || 0)), 0);
  const playerBidMap = new Map();
  allIndividualBids.forEach((bid) => {
    const playerId = Number(bid && bid.player && bid.player.id);
    const playerName = String(bid && bid.player && bid.player.name || '').trim();
    const bidAmount = Math.max(0, Number(bid && bid.bidAmount || 0));
    if (!Number.isFinite(playerId) || !playerName || bidAmount <= 0) return;

    const existing = playerBidMap.get(playerId) || {
      playerId,
      playerName,
      totalBidAmount: 0,
      bidCount: 0
    };
    existing.totalBidAmount += bidAmount;
    existing.bidCount += 1;
    playerBidMap.set(playerId, existing);
  });
  const playerBidTotals = [...playerBidMap.values()]
    .map((row) => ({
      playerId: Number(row.playerId || 0),
      playerName: String(row.playerName || ''),
      totalBidAmount: Number(row.totalBidAmount || 0),
      bidCount: Number(row.bidCount || 0)
    }))
    .sort((a, b) => {
      if (b.totalBidAmount !== a.totalBidAmount) return b.totalBidAmount - a.totalBidAmount;
      return String(a.playerName || '').localeCompare(String(b.playerName || ''));
    });
  const teamsWithBidSet = new Set(
    allIndividualBids
      .map(bid => String(bid && bid.bidderTeam || '').trim())
      .filter(Boolean)
  );
  const teamsInDraft = Array.isArray(teams) ? teams.length : 0;
  const playersInRound = safeRoundPlayers.length;
  const bidEntries = allIndividualBids.length;
  const participationStats = {
    roundNumber: Number(roundNumber || 0),
    teamsInDraft,
    teamsWithBid: teamsWithBidSet.size,
    playersInRound,
    bidEntries,
    totalBidAmount,
    totalBidAmountPerTeam: teamsInDraft > 0 ? Number((totalBidAmount / teamsInDraft).toFixed(2)) : 0,
    playerBidTotals,
    avgBidPerPlayer: playersInRound > 0 ? Number((totalBidAmount / playersInRound).toFixed(2)) : 0,
    avgBidPerEntry: bidEntries > 0 ? Number((totalBidAmount / bidEntries).toFixed(2)) : 0,
    participationRate: teamsInDraft > 0 ? Number(((teamsWithBidSet.size / teamsInDraft) * 100).toFixed(1)) : 0
  };

  console.log(`[processAuctions] Completed processing ${results.length} results, ${tiedBids.length} tied bids`);
  return { results, tiedBids, participationStats };
  } catch (error) {
    console.error('[processAuctions] CRITICAL ERROR processing auctions:', error);
    console.error(error.stack);

    const fallbackRoundPlayers = Array.isArray(roundPlayers) ? roundPlayers : [];
    const fallbackResults = fallbackRoundPlayers.map((player) => ({
      type: 'undrafted',
      playerId: player && player.id,
      playerName: String(player && player.name || `Player ${player && player.id ? player.id : '?'}`),
      allBids: (Array.isArray(teams) ? teams : []).map((team) => ({
        teamName: String(team && team.name || ''),
        amount: 0
      }))
    }));
    
    // Return empty results on error to prevent server crash
    return {
      results: fallbackResults,
      tiedBids: [],
      participationStats: {
        roundNumber: Number(roundNumber || 0),
        teamsInDraft: Array.isArray(teams) ? teams.length : 0,
        teamsWithBid: 0,
        playersInRound: fallbackRoundPlayers.length,
        bidEntries: 0,
        totalBidAmount: 0,
        totalBidAmountPerTeam: 0,
        playerBidTotals: [],
        avgBidPerPlayer: 0,
        avgBidPerEntry: 0,
        participationRate: 0
      }
    };
  }
}

// ==================== SOCKET.IO HANDLERS ====================

function normalizeServerRoundTimerMinutes(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(3, Math.min(parsed, 10));
}

function ensureDraftStateForSocket(code, socket, options = {}) {
  const draftCode = String(code || '').trim();
  if (!draftCode) {
    return null;
  }

  if (!drafts[draftCode]) {
    drafts[draftCode] = {
      members: [],
      type: null,
      capacity: 10,
      public: false
    };
  }

  const draft = drafts[draftCode];
  draft.members = Array.isArray(draft.members) ? draft.members : [];
  if (!draft.host && draft.members.length > 0) {
    draft.host = draft.members[0];
  }

  const username = String(options.username || socket?.data?.username || '').trim();
  if (username && !draft.members.includes(username)) {
    draft.members.push(username);
  }

  if (!draft.draftState || typeof draft.draftState !== 'object') {
    const roundTimerMinutes = normalizeServerRoundTimerMinutes(draft.roundTimerMinutes);
    draft.draftState = {
      currentRound: 1,
      roundTimer: roundTimerMinutes * 60,
      roundTimerMinutes,
      currentPlayers: [],
      completedRounds: [],
      bids: {},
      autoDraftStatus: {},
      autoDraftStarTargets: {},
      chatMessages: [],
      participationTracker: {
        history: [],
        lastRound: null,
        baselineAvgBidPerPlayer: 0,
        dropFromBaselinePct: 0
      },
      submittedMembers: []
    };
  }

  if (!draft.draftState.autoDraftStatus || typeof draft.draftState.autoDraftStatus !== 'object') {
    draft.draftState.autoDraftStatus = {};
  }

  if (!draft.draftState.autoDraftStarTargets || typeof draft.draftState.autoDraftStarTargets !== 'object') {
    draft.draftState.autoDraftStarTargets = {};
  }

  if (!Array.isArray(draft.draftState.chatMessages)) {
    draft.draftState.chatMessages = [];
  }

  if (!draft.draftState.participationTracker || typeof draft.draftState.participationTracker !== 'object') {
    draft.draftState.participationTracker = {
      history: [],
      lastRound: null,
      baselineAvgBidPerPlayer: 0,
      dropFromBaselinePct: 0
    };
  }

  if (!Array.isArray(draft.draftState.submittedMembers)) {
    draft.draftState.submittedMembers = [];
  }

  if (!draft.draftState.bids || typeof draft.draftState.bids !== 'object') {
    draft.draftState.bids = {};
  }

  if (typeof draft.draftState.roundTimerMinutes === 'undefined' || draft.draftState.roundTimerMinutes === null) {
    draft.draftState.roundTimerMinutes = normalizeServerRoundTimerMinutes(draft.roundTimerMinutes);
  }

  if (!Number.isFinite(Number(draft.draftState.roundTimer))) {
    draft.draftState.roundTimer = Number(draft.draftState.roundTimerMinutes || normalizeServerRoundTimerMinutes(draft.roundTimerMinutes)) * 60;
  }

  return draft;
}

io.on('connection', (socket) => {
  console.log(`[connection] New socket connected: ${socket.id}`);
  
  // join room and receive current state
  socket.on('joinDraftRoom', (code, username) => {
    socket.join(code);
    if (drafts[code] && !drafts[code].host && drafts[code].members && drafts[code].members.length > 0) {
      drafts[code].host = drafts[code].members[0];
    }
    // Store username in socket data
    if (username) {
      socket.data.username = username;
      socket.data.currentDraft = code;
      console.log(`[joinDraftRoom] ${username} (${socket.id}) joined room ${code}`);
    }
    socket.emit('draftUpdate', drafts[code] || { members: [], type: null, capacity: null, public: false });
  });

  // Client requests to create a draft and join it in one call
  socket.on('createAndJoinDraft', (code, state, username, cb) => {
    drafts[code] = Object.assign(drafts[code] || {}, state || {});
    drafts[code].members = drafts[code].members || [];
    if (!drafts[code].host) drafts[code].host = username;
    // Set default capacity if not specified
    if (!drafts[code].capacity) drafts[code].capacity = 10;
  // clear any previous closed flag when a host (creator) makes/joins a draft
  if(drafts[code].closed){ delete drafts[code].closed; }

    // Set current draft ID for database logging
    currentDraftId = code;
    // enforce capacity if already set
    const cap = drafts[code].capacity ? drafts[code].capacity : null;
    if(cap && drafts[code].members.length >= cap && !drafts[code].members.includes(username)){
      if(cb) cb({ ok: false, reason: 'capacity' });
      return;
    }
    if(!drafts[code].members.includes(username)) drafts[code].members.push(username);
    socket.join(code);
    socket.data.username = username;
    socket.data.currentDraft = code;
    io.to(code).emit('draftUpdate', drafts[code]);
    if(cb) cb({ ok: true, draft: drafts[code] });
  });

  // Client requests to join an existing draft (server authoritative)
  socket.on('requestJoin', (code, username, cb) => {
  // Important: User must have the code to even call this endpoint
  // The code acts as the access credential for private drafts
  
  // If draft doesn't exist yet, this is the first person creating it
  drafts[code] = drafts[code] || { members: [], type: null, capacity: 10, public: false };
  if (!drafts[code].host) drafts[code].host = username;
  
  // If draft was closed but a previous member is rejoining, reopen it
  if(drafts[code].closed && drafts[code].members.includes(username)){ 
    console.log(`[requestJoin] ${username} (previous member) reopening closed draft ${code}`);
    delete drafts[code].closed;
  }
  
  // if the draft is still closed after the check above, reject joins
  if(drafts[code].closed){ 
    if(drafts[code].members.includes(username)){
      console.log(`[requestJoin] ${username} (previous member) reopening closed draft ${code}`);
      delete drafts[code].closed;
    } else {
      // Draft is closed and user is not a previous member - reject
      console.log(`[requestJoin] ${username} denied - draft ${code} is closed`);
      if(cb) cb({ ok: false, reason: 'closed' }); 
      return;
    }
  }
    drafts[code].members = drafts[code].members || [];
    const cap = drafts[code].capacity ? drafts[code].capacity : null;
    console.log(`[requestJoin] ${username} -> ${code}: capacity=${cap}, members=${drafts[code].members.length}, already member=${drafts[code].members.includes(username)}`);
    if(cap && drafts[code].members.length >= cap && !drafts[code].members.includes(username)){
      console.log(`[requestJoin] ${username} denied - capacity reached`);
      if(cb) cb({ ok: false, reason: 'capacity' });
      return;
    }
    if(!drafts[code].members.includes(username)) drafts[code].members.push(username);
    socket.join(code);
    socket.data.username = username;
    socket.data.currentDraft = code;
    console.log(`[requestJoin] ${username} joined ${code} successfully. Total members: ${drafts[code].members.length}`);
    io.to(code).emit('draftUpdate', drafts[code]);
    if(cb) cb({ ok: true, draft: drafts[code] });
  });

  // Clients can request to leave a draft; server will update state and broadcast
  socket.on('leaveDraft', (code, username, cb) => {
    if(drafts[code] && drafts[code].members){
      // determine if leaving user is the host (first member)
      const wasHost = drafts[code].members.length && drafts[code].members[0] === username;
      drafts[code].members = drafts[code].members.filter(m => m !== username);
      if(wasHost){
        // mark draft closed so new joins are rejected and notify remaining clients
        drafts[code].closed = true;
        drafts[code].host = null;
      }
      io.to(code).emit('draftUpdate', drafts[code]);
    }
    try{ socket.leave(code); }catch(e){}
    if(cb) cb({ ok: true });
  });

  // Generic state update - still supported but server won't accept member lists blindly
  socket.on('updateDraft', (code, state) => {
    // merge only non-members fields (type, capacity, public, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder, waiverMode)
    drafts[code] = drafts[code] || { members: [], type: null, capacity: null, public: false };
    const allowed = (({ type, capacity, public: pub, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder, waiverMode }) => ({ type, capacity, public: pub, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder, waiverMode }))(state || {});
    // apply allowed fields
    if(typeof allowed.type !== 'undefined') drafts[code].type = allowed.type;
    if(typeof allowed.capacity !== 'undefined') drafts[code].capacity = allowed.capacity;
    if(typeof allowed.public !== 'undefined') drafts[code].public = allowed.public;
    if(typeof allowed.draftOrder !== 'undefined') drafts[code].draftOrder = allowed.draftOrder;
    if(typeof allowed.draftOrderAssignments !== 'undefined') drafts[code].draftOrderAssignments = allowed.draftOrderAssignments;
    if(typeof allowed.customBudgets !== 'undefined') drafts[code].customBudgets = allowed.customBudgets;
    if(typeof allowed.rosterSettings !== 'undefined') drafts[code].rosterSettings = allowed.rosterSettings;
    if(typeof allowed.benchCutTarget !== 'undefined') drafts[code].benchCutTarget = allowed.benchCutTarget;
    if(typeof allowed.roundTimerMinutes !== 'undefined') drafts[code].roundTimerMinutes = allowed.roundTimerMinutes;
    if(typeof allowed.ajDraftMode !== 'undefined') drafts[code].ajDraftMode = !!allowed.ajDraftMode;
    if(typeof allowed.ajRoundOrder !== 'undefined') drafts[code].ajRoundOrder = Array.isArray(allowed.ajRoundOrder) ? allowed.ajRoundOrder.slice(0, 10) : undefined;
    if(typeof allowed.waiverMode !== 'undefined') drafts[code].waiverMode = normalizeWaiverLobbyMode(allowed.waiverMode);
    console.log(`[updateDraft] ${code} capacity=${drafts[code].capacity} members=${drafts[code].members.length}`);
    io.to(code).emit('draftUpdate', drafts[code]);
    // Also push roster/bench changes to any active draft room (draft_<code>)
    if(typeof allowed.rosterSettings !== 'undefined' || typeof allowed.benchCutTarget !== 'undefined' || typeof allowed.roundTimerMinutes !== 'undefined' || typeof allowed.ajDraftMode !== 'undefined' || typeof allowed.ajRoundOrder !== 'undefined') {
      const roundTimerMinutes = Number.parseInt(drafts[code].roundTimerMinutes, 10);
      const normalizedRoundTimerMinutes = Number.isFinite(roundTimerMinutes) ? Math.max(3, Math.min(roundTimerMinutes, 10)) : 10;
      if (drafts[code].draftState) {
        drafts[code].draftState.roundTimer = normalizedRoundTimerMinutes * 60;
        drafts[code].draftState.roundTimerMinutes = normalizedRoundTimerMinutes;
      }
      io.to(`draft_${code}`).emit('rosterSettingsUpdated', {
        rosterSettings: drafts[code].rosterSettings,
        benchCutTarget: drafts[code].benchCutTarget,
        roundTimerMinutes: normalizedRoundTimerMinutes,
        ajDraftMode: !!drafts[code].ajDraftMode,
        ajRoundOrder: Array.isArray(drafts[code].ajRoundOrder) ? drafts[code].ajRoundOrder.slice(0, 10) : undefined
      });
    }
  });

  // Host starts the draft - notify all members to navigate to draft page
  socket.on('startDraft', (code, draftType, roundTimerMinutesOrCb, cbMaybe) => {
    const parsedRoundTimerMinutes = Number.parseInt(roundTimerMinutesOrCb, 10);
    const roundTimerMinutes = Number.isFinite(parsedRoundTimerMinutes)
      ? Math.max(3, Math.min(parsedRoundTimerMinutes, 10))
      : undefined;
    const cb = typeof roundTimerMinutesOrCb === 'function' ? roundTimerMinutesOrCb : cbMaybe;
    console.log(`[startDraft] ${code} type=${draftType} by ${socket.data.username} rawTimerArg=${roundTimerMinutesOrCb}`);
    // Verify the requester is the host (use explicit host field with fallback)
    const draft = drafts[code];
    const host = draft && (draft.host || (Array.isArray(draft.members) && draft.members[0]));
    if(draft && host && host === socket.data.username){
      if (typeof roundTimerMinutes !== 'undefined') {
        draft.roundTimerMinutes = roundTimerMinutes;
      }
      console.log(`[startDraft] ${code} resolved roundTimerMinutes=${draft.roundTimerMinutes}`);
      // Mark draft as started and store the draft type
      draft.started = true;
      draft.type = draftType;
      draft.startedAt = Date.now();
      
      // Get all sockets in this room
      const roomSockets = io.sockets.adapter.rooms.get(code);
      console.log(`[startDraft] Broadcasting to ${roomSockets ? roomSockets.size : 0} sockets in room ${code}`);
      console.log(`[startDraft] Members in draft: ${(draft.members || []).join(', ')}`);
      
      // Broadcast to all members in the room (including host)
      io.to(code).emit('draftStarted', draftType);
      console.log(`[startDraft] Broadcast sent`);
      if(cb) cb({ ok: true });
    } else {
      console.log(`[startDraft] denied - ${socket.data.username} is not the host (${host || 'unknown'})`);
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // Get current draft state from server (for draft page to load)
  socket.on('getDraftState', (code, cb) => {
    const draftCode = String(code || '').trim();
    console.log(`[getDraftState] ${draftCode} requested by ${socket.data.username}`);
    const draft = ensureDraftStateForSocket(draftCode, socket, { username: socket.data.username });
    if (draft) {
      const autoCutResult = autoCutCpuTeamsForSummary(draft);
      if (!draft.host && draft.members && draft.members.length > 0) {
        draft.host = draft.members[0];
      }

      if (autoCutResult.changedTeamNames.length > 0) {
        autoCutResult.changedTeamNames.forEach((cpuTeamName) => {
          const cpuTeam = autoCutResult.teams.find(t => String(t && t.name || '').trim() === cpuTeamName);
          if (cpuTeam) {
            io.to(draftCode).emit('benchUpdated', {
              teamName: cpuTeamName,
              newRoster: cpuTeam.roster
            });
          }
        });
      }

      logDraftCutDebug(draft, draftCode, 'getDraftState.afterAutoCut');

      console.log(`[getDraftState] ${draftCode} host=${draft.host || draft.members?.[0] || 'unknown'} members=${(draft.members || []).join(', ')}`);
      if(cb) cb({ ok: true, draft });
    } else {
      if(cb) cb({ ok: false, reason: 'not_found' });
    }
  });

  // Join the active draft room for real-time bidding
  socket.on('joinActiveDraft', (code, username) => {
    const draftCode = String(code || '').trim();
    if (!draftCode) {
      console.warn(`[joinActiveDraft] Draft code missing`);
      return;
    }

    const draft = ensureDraftStateForSocket(draftCode, socket, { username });
    if (!draft) {
      console.warn(`[joinActiveDraft] Draft not found for code ${draftCode}`);
      return;
    }

    const providedName = String(username || '').trim();
    const normalizedProvidedName = providedName.toLowerCase();
    let resolvedUsername = providedName;
    if (Array.isArray(draft.members)) {
      const matchedMember = draft.members.find((member) => (
        String(member || '').trim().toLowerCase() === normalizedProvidedName
      ));
      if (matchedMember) {
        resolvedUsername = matchedMember;
      }
    }

    socket.join(`draft_${draftCode}`);
    socket.data.activeDraftCode = draftCode;
    socket.data.username = resolvedUsername;
    console.log(`[joinActiveDraft] ${resolvedUsername} joined active draft ${draftCode}`);
    
    const roundTimerMinutes = normalizeServerRoundTimerMinutes(draft.roundTimerMinutes);

    if (draft.draftState) {
      draft.draftState.roundTimer = roundTimerMinutes * 60;
      draft.draftState.roundTimerMinutes = roundTimerMinutes;
    }

    // Default each joining user to OFF until they explicitly toggle ON.
    if (typeof draft.draftState.autoDraftStatus[resolvedUsername] === 'undefined') {
      draft.draftState.autoDraftStatus[resolvedUsername] = false;
    }
    
    // Send current draft state to the joining player
    socket.emit('draftStateSync', draft.draftState);

    // Rehydrate any active live auction so a reconnecting PWA client can recover
    // the tied-auction UI instead of freezing at the last disconnected screen.
    const liveAuctions = draft.draftState.liveAuctions || {};
    const activeAuctionEntry = Object.entries(liveAuctions).find(([, auction]) => auction && auction.active);
    if (activeAuctionEntry) {
      const [auctionId, auction] = activeAuctionEntry;
      socket.emit('liveAuctionSync', {
        auctionId,
        playerId: auction.playerId,
        playerName: auction.playerName,
        playerPosition: auction.playerPosition,
        playerAvgValue: auction.playerAvgValue,
        playerPositionRank: auction.playerPositionRank,
        tiedTeams: Array.isArray(auction.tiedTeams) ? auction.tiedTeams.slice() : [],
        startBid: Number(auction.currentBid || 0),
        currentBid: Number(auction.currentBid || 0),
        currentWinner: auction.currentWinner || null,
        timer: Number(auction.timer || 0),
        isTiedAuction: !!auction.isTiedAuction,
        backedOutTeams: Array.isArray(auction.backedOutTeams) ? auction.backedOutTeams.slice() : []
      });
    }

    // Also sync current auto-draft statuses for UI badges.
    socket.emit('autoDraftStatusSync', draft.draftState.autoDraftStatus);
  });

  // Update and broadcast auto-draft toggle status for a team/user.
  socket.on('setAutoDraftStatus', (code, username, enabled, starredPayloadOrCb, cbMaybe) => {
    const starredPayload = typeof starredPayloadOrCb === 'function' ? undefined : starredPayloadOrCb;
    const cb = typeof starredPayloadOrCb === 'function' ? starredPayloadOrCb : cbMaybe;
    if (!drafts[code] || !drafts[code].draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    if (!drafts[code].draftState.autoDraftStatus) {
      drafts[code].draftState.autoDraftStatus = {};
    }

    if (!drafts[code].draftState.autoDraftStarTargets || typeof drafts[code].draftState.autoDraftStarTargets !== 'object') {
      drafts[code].draftState.autoDraftStarTargets = {};
    }

    const requestUser = socket.data.username;
    if (!requestUser || requestUser !== username) {
      if (cb) cb({ ok: false, reason: 'unauthorized' });
      return;
    }

    drafts[code].draftState.autoDraftStatus[username] = !!enabled;
    if (typeof starredPayload !== 'undefined') {
      drafts[code].draftState.autoDraftStarTargets[username] = sanitizeStarredNamesInput(starredPayload);
    }

    io.to(`draft_${code}`).emit('autoDraftStatusChanged', {
      username,
      enabled: !!enabled,
      statuses: drafts[code].draftState.autoDraftStatus
    });

    // If toggling auto-draft means all required manual members are already submitted,
    // immediately advance submission state for the round.
    const draft = drafts[code];
    const allMembers = draft.members || [];
    const statusMap = draft.draftState.autoDraftStatus || {};
    const requiredManualMembers = allMembers.filter(member => !statusMap[member]);
    const submittedMembers = draft.draftState.submittedMembers || [];
    const submittedRequiredCount = submittedMembers.filter(member => requiredManualMembers.includes(member)).length;
    if (requiredManualMembers.length === 0 || submittedRequiredCount >= requiredManualMembers.length) {
      io.to(`draft_${code}`).emit('allBidsSubmitted');
    }

    if (cb) cb({ ok: true });
  });

  socket.on('syncAutoDraftStarTargets', (code, username, starredPayload, cb) => {
    if (!drafts[code] || !drafts[code].draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    const requestUser = socket.data.username;
    if (!requestUser || requestUser !== username) {
      if (cb) cb({ ok: false, reason: 'unauthorized' });
      return;
    }

    if (!drafts[code].draftState.autoDraftStarTargets || typeof drafts[code].draftState.autoDraftStarTargets !== 'object') {
      drafts[code].draftState.autoDraftStarTargets = {};
    }

    drafts[code].draftState.autoDraftStarTargets[username] = sanitizeStarredNamesInput(starredPayload);
    if (cb) cb({ ok: true });
  });

  socket.on('sendDraftChatMessage', (code, text, cb) => {
    const draft = drafts[code];
    const username = String(socket.data.username || '').trim();

    if (!draft || !draft.draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    const normalizedUsername = username.toLowerCase();
    const matchedMember = Array.isArray(draft.members)
      ? draft.members.find((member) => String(member || '').trim().toLowerCase() === normalizedUsername)
      : null;

    if (!username || !matchedMember) {
      if (cb) cb({ ok: false, reason: 'not_in_draft' });
      return;
    }

    const trimmed = String(text || '').trim();
    if (!trimmed) {
      if (cb) cb({ ok: false, reason: 'empty_message' });
      return;
    }

    const normalized = trimmed.slice(0, 240);
    const payload = {
      username: matchedMember,
      text: normalized,
      timestamp: Date.now()
    };

    if (!Array.isArray(draft.draftState.chatMessages)) {
      draft.draftState.chatMessages = [];
    }
    draft.draftState.chatMessages.push(payload);
    if (draft.draftState.chatMessages.length > 200) {
      draft.draftState.chatMessages = draft.draftState.chatMessages.slice(-200);
    }

    io.to(`draft_${code}`).emit('draftChatMessage', payload);
    if (cb) cb({ ok: true });
  });

  // Host sets the players for a round (all members will see these same players)
  socket.on('setRoundPlayers', (code, players, cb) => {
    const username = socket.data.username;
    console.log(`[setRoundPlayers] ${username} set ${players.length} players for round ${drafts[code].draftState.currentRound}`);
    
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === username){
      // Host is setting the round players
      drafts[code].draftState.currentPlayers = players;
      
      // Reset submission tracking for new round
      drafts[code].draftState.submittedMembers = [];
      
      // Broadcast to all members in the draft
      io.to(`draft_${code}`).emit('roundPlayersSet', players);
      
      if(cb) cb({ ok: true });
    } else {
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  const applyUserBidToDraftState = (draft, username, playerId, bidAmount) => {
    if (!draft || !draft.draftState || !draft.draftState.bids) return { ok: false, reason: 'draft_not_ready' };

    const safePlayerId = Number(playerId);
    if (!Number.isFinite(safePlayerId)) {
      return { ok: false, reason: 'invalid_player_id' };
    }

    const numericBid = Number(bidAmount);
    const safeBid = Number.isFinite(numericBid) && numericBid > 0 ? Math.floor(numericBid) : 0;

    if (!draft.draftState.bids[safePlayerId]) {
      draft.draftState.bids[safePlayerId] = {};
    }

    if (safeBid > 0) {
      draft.draftState.bids[safePlayerId][username] = safeBid;
    } else {
      delete draft.draftState.bids[safePlayerId][username];
      if (Object.keys(draft.draftState.bids[safePlayerId]).length === 0) {
        delete draft.draftState.bids[safePlayerId];
      }
    }

    return { ok: true, playerId: safePlayerId, bidAmount: safeBid };
  };

  // Sync all bids for the current round in one payload to avoid submit-time socket churn.
  socket.on('syncRoundBids', (code, bidEntries, cb) => {
    const username = socket.data.username;
    const draft = ensureDraftStateForSocket(code, socket, { username });
    if (!draft || !draft.draftState || !draft.draftState.bids) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    const entries = Array.isArray(bidEntries) ? bidEntries.slice(0, 120) : [];
    let appliedCount = 0;
    let skippedCount = 0;

    entries.forEach((entry) => {
      const playerId = entry && entry.playerId;
      const bidAmount = entry && entry.bidAmount;
      const result = applyUserBidToDraftState(draft, username, playerId, bidAmount);
      if (result.ok) {
        appliedCount += 1;
      } else {
        skippedCount += 1;
      }
    });

    if (cb) cb({ ok: true, appliedCount, skippedCount });
  });

  // Place a bid on a player
  socket.on('placeBid', (code, playerId, bidAmount, cb) => {
    const username = socket.data.username;
    const draft = ensureDraftStateForSocket(code, socket, { username });
    if (!draft || !draft.draftState || !draft.draftState.bids) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    const result = applyUserBidToDraftState(draft, username, playerId, bidAmount);
    if (!result.ok) {
      if (cb) cb(result);
      return;
    }

    const safePlayerId = result.playerId;
    const safeBid = result.bidAmount;

    console.log(`[placeBid] ${username} bid $${safeBid} on player ${safePlayerId} in draft ${code}`);
    
    // Broadcast bid to all members in the draft
    io.to(`draft_${code}`).emit('bidUpdate', { playerId: safePlayerId, username, bidAmount: safeBid });
    
    if(cb) cb({ ok: true });
  });

  // User has submitted their bids for the round
  socket.on('submitBids', (code, username, autoDraftEnabledOrCb, cbMaybe) => {
    const autoDraftEnabled = typeof autoDraftEnabledOrCb === 'boolean' ? autoDraftEnabledOrCb : undefined;
    const cb = typeof autoDraftEnabledOrCb === 'function' ? autoDraftEnabledOrCb : cbMaybe;
    const draftCode = String(code || '').trim();
    const submissionUsername = String(username || socket.data.username || '').trim();
    console.log(`[submitBids] ${submissionUsername} submitted bids in ${draftCode}`);

    const draft = ensureDraftStateForSocket(draftCode, socket, { username: submissionUsername });
    if (!draft || !draft.draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    if (!draft.draftState.autoDraftStatus) {
      draft.draftState.autoDraftStatus = {};
    }

    // Keep server authority aligned with the client's current toggle at submit time.
    if (typeof autoDraftEnabled === 'boolean') {
      draft.draftState.autoDraftStatus[submissionUsername] = autoDraftEnabled;
    }
    
    if(!draft.draftState.submittedMembers) {
      draft.draftState.submittedMembers = [];
    }
    
    // Track this member's submission
    if(!draft.draftState.submittedMembers.includes(submissionUsername)) {
      draft.draftState.submittedMembers.push(submissionUsername);
    }
    
    // Broadcast to all other members in the draft room (not the sender)
    socket.to(`draft_${draftCode}`).emit('bidsSubmitted', { username: submissionUsername });
    
    // Only members with auto-draft OFF are required to submit manually.
    const allMembers = Array.isArray(draft.members) ? draft.members : [];
    const autoDraftStatus = draft.draftState.autoDraftStatus || {};
    const requiredManualMembers = allMembers.filter(member => !autoDraftStatus[member]);
    const submittedCount = draft.draftState.submittedMembers.filter(member => requiredManualMembers.includes(member)).length;
    console.log('[submitBids][debug] submittedMembers:', draft.draftState.submittedMembers);
    console.log('[submitBids][debug] requiredManualMembers:', requiredManualMembers);
    console.log('[submitBids][debug] current bids snapshot:', JSON.stringify(draft.draftState.bids || {}, null, 2));
    
    console.log(`[submitBids] ${submittedCount}/${requiredManualMembers.length} manual members have submitted`);
    
    if(submittedCount >= requiredManualMembers.length) {
      console.log(`[submitBids] All members submitted - triggering round processing`);
      // All members have submitted, trigger round processing
      io.to(`draft_${draftCode}`).emit('allBidsSubmitted');
    }
    
    if(cb) cb({ ok: true });
  });

  // Host can force round submission on timer expiry.
  // This simulates all required manual members hitting Submit Bids.
  socket.on('forceTimerRoundEnd', (code, cb) => {
    const requester = socket.data.username;
    if (!drafts[code] || !drafts[code].draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    const draft = drafts[code];
    const host = draft.members && draft.members[0];
    if (requester !== host) {
      if (cb) cb({ ok: false, reason: 'only_host_can_force' });
      return;
    }

    if (!draft.draftState.submittedMembers) {
      draft.draftState.submittedMembers = [];
    }

    const allMembers = draft.members || [];
    const autoDraftStatus = draft.draftState.autoDraftStatus || {};
    const requiredManualMembers = allMembers.filter(member => !autoDraftStatus[member]);

    const missingMembers = requiredManualMembers.filter(
      member => !draft.draftState.submittedMembers.includes(member)
    );

    console.log('[forceTimerRoundEnd][debug] requester:', requester);
    console.log('[forceTimerRoundEnd][debug] requiredManualMembers:', requiredManualMembers);
    console.log('[forceTimerRoundEnd][debug] alreadySubmitted:', draft.draftState.submittedMembers);
    console.log('[forceTimerRoundEnd][debug] missingMembers:', missingMembers);
    console.log('[forceTimerRoundEnd][debug] bids snapshot before force:', JSON.stringify(draft.draftState.bids || {}, null, 2));

    // Mark all missing required members as submitted.
    missingMembers.forEach(member => {
      draft.draftState.submittedMembers.push(member);
      socket.to(`draft_${code}`).emit('bidsSubmitted', { username: member, timerForced: true });
    });

    io.to(`draft_${code}`).emit('allBidsSubmitted');

    if (cb) {
      cb({
        ok: true,
        forcedCount: missingMembers.length,
        requiredManualCount: requiredManualMembers.length
      });
    }
  });

  // Process round - server authoritatively determines auction results
  socket.on('processRound', async (code, roundData, cb) => {
    const username = socket.data.username;
    console.log(`[processRound] ${username} requested processing round in ${code}`);
    
    if(!drafts[code] || !drafts[code].draftState) {
      if(cb) cb({ ok: false, reason: 'no_draft_state' });
      return;
    }

    const hostUsername = drafts[code].members && drafts[code].members[0];
    if (username !== hostUsername) {
      console.log(`[processRound] Rejected non-host processor ${username}; host is ${hostUsername}`);
      if (cb) cb({ ok: false, reason: 'only_host_can_process' });
      return;
    }

    // Check if there's an active auction
    const hasActiveAuction = drafts[code].draftState.liveAuctions && 
      Object.values(drafts[code].draftState.liveAuctions).some(auction => auction.active);
    
    if(hasActiveAuction) {
      console.log(`[processRound] Cannot process new round while auction is active in ${code}`);
      if(cb) cb({ ok: false, reason: 'auction_in_progress' });
      return;
    }
    
    // Prevent duplicate round processing with a flag
    if(drafts[code].draftState.isProcessingRound) {
      console.log(`[processRound] Round already processing for ${code}, ignoring duplicate request`);
      if(cb) cb({ ok: false, reason: 'already_processing' });
      return;
    }
    
    // Ensure all required manual members have submitted bids before processing
    const allMembers = drafts[code].members || [];
    const autoDraftStatus = drafts[code].draftState.autoDraftStatus || {};
    const requiredManualMembers = allMembers.filter(member => !autoDraftStatus[member]);
    const submittedMembers = drafts[code].draftState.submittedMembers || [];
    const submittedRequiredCount = submittedMembers.filter(member => requiredManualMembers.includes(member)).length;
    console.log('[processRound][debug] requiredManualMembers:', requiredManualMembers);
    console.log('[processRound][debug] submittedMembers:', submittedMembers);
    console.log('[processRound][debug] server bids at process start:', JSON.stringify(drafts[code].draftState.bids || {}, null, 2));
    if (submittedRequiredCount < requiredManualMembers.length) {
      console.log(`[processRound] Not all required members have submitted bids yet (${submittedRequiredCount}/${requiredManualMembers.length})`);
      if(cb) cb({ ok: false, reason: 'not_all_submitted' });
      return;
    }
    
    drafts[code].draftState.isProcessingRound = true;

    const draftState = drafts[code].draftState;
    const payload = roundData && typeof roundData === 'object' ? roundData : {};
    const clientRoundPlayers = Array.isArray(payload.roundPlayers) ? payload.roundPlayers : [];
    const stateRoundPlayers = Array.isArray(draftState.currentPlayers) ? draftState.currentPlayers : [];
    const roundPlayers = clientRoundPlayers.length > 0 ? clientRoundPlayers : stateRoundPlayers;

    const clientTeams = Array.isArray(payload.teams) ? payload.teams : [];
    const stateTeams = Array.isArray(draftState.teams) ? draftState.teams : [];
    const teams = clientTeams.length > 0 ? clientTeams : stateTeams;

    const clientAllPlayers = Array.isArray(payload.allPlayers) ? payload.allPlayers : [];
    const stateAllPlayers = Array.isArray(draftState.allPlayers) ? draftState.allPlayers : [];
    const allPlayers = clientAllPlayers.length > 0 ? clientAllPlayers : stateAllPlayers;

    const rosterSize = Number.isFinite(Number(payload.rosterSize)) ? Number(payload.rosterSize) : 0;
    const rosterLimits = payload.rosterLimits && typeof payload.rosterLimits === 'object'
      ? payload.rosterLimits
      : (draftState.rosterLimits && typeof draftState.rosterLimits === 'object' ? draftState.rosterLimits : {});
    const flexPositions = Array.isArray(payload.flexPositions)
      ? payload.flexPositions
      : (Array.isArray(draftState.flexPositions) ? draftState.flexPositions : ['RB', 'WR', 'TE']);

    if (!Array.isArray(roundPlayers) || roundPlayers.length === 0) {
      console.warn(`[processRound] No round players available for ${code}; client=${clientRoundPlayers.length}, state=${stateRoundPlayers.length}`);
      drafts[code].draftState.isProcessingRound = false;
      io.to(`draft_${code}`).emit('roundProcessingError', {
        message: 'Failed to process round results',
        error: 'No round players available on server'
      });
      if (cb) cb({ ok: false, reason: 'no_round_players' });
      return;
    }

    if (!Array.isArray(teams) || teams.length === 0) {
      console.warn(`[processRound] No teams available for ${code}; client=${clientTeams.length}, state=${stateTeams.length}`);
      drafts[code].draftState.isProcessingRound = false;
      io.to(`draft_${code}`).emit('roundProcessingError', {
        message: 'Failed to process round results',
        error: 'No teams available on server'
      });
      if (cb) cb({ ok: false, reason: 'no_teams' });
      return;
    }

    console.log('[processRound][debug] authoritative inputs:', {
      roundPlayersFromClient: clientRoundPlayers.length,
      roundPlayersFromState: stateRoundPlayers.length,
      selectedRoundPlayers: roundPlayers.length,
      teamsFromClient: clientTeams.length,
      teamsFromState: stateTeams.length,
      selectedTeams: teams.length,
      allPlayersFromClient: clientAllPlayers.length,
      allPlayersFromState: stateAllPlayers.length,
      selectedAllPlayers: allPlayers.length
    });
    
    // Store teams, allPlayers and rosterLimits for live auction use
    draftState.teams = teams;
    draftState.allPlayers = allPlayers;
    draftState.rosterLimits = rosterLimits;
    draftState.currentPlayers = roundPlayers;
    
    // Add risk tolerance to CPU teams for tie breaker logic
    draftState.teams.forEach(team => {
      if (/^Team \d+$/.test(team.name)) {
        // CPU teams get random risk tolerance between 0.8 and 1.2
        team.riskTolerance = 0.8 + Math.random() * 0.4;
        console.log(`[CPU Risk Tolerance] ${team.name}: ${team.riskTolerance.toFixed(2)}x`);
      }
    });
    
    // Members with auto-draft OFF are treated as human/manual for this round.
    const humanMembers = requiredManualMembers;

    // Debug visibility: print silent/tied profile assignment for every team each round.
    logTeamProfileDebugMap(code, teams, humanMembers);

    // Remove stale manual bids for teams currently controlled by auto-draft.
    const autoDraftMembers = allMembers.filter(member => autoDraftStatus[member]);
    const autoDraftStarTargets = draftState.autoDraftStarTargets || {};
    const autoDraftStarPlayerIdsByTeam = buildAutoDraftStarPlayerIdsByTeam(
      teams,
      allPlayers,
      autoDraftStarTargets,
      autoDraftMembers
    );
    const sanitizedUserBids = Object.entries(draftState.bids || {}).reduce((acc, [playerId, teamBids]) => {
      const filteredTeamBids = Object.entries(teamBids || {}).reduce((teamAcc, [teamName, amount]) => {
        if (!autoDraftMembers.includes(teamName)) {
          teamAcc[teamName] = amount;
        }
        return teamAcc;
      }, {});

      if (Object.keys(filteredTeamBids).length > 0) {
        acc[playerId] = filteredTeamBids;
      }
      return acc;
    }, {});
    
    // Generate CPU bids once on server for consistency
    // Filter out all human members, so only CPU teams get bids generated
    console.log(`[processRound] Starting CPU bid generation...`);
    const cpuBidsPromise = generateServerCPUBids(
      teams,
      roundPlayers,
      allPlayers,
      rosterSize,
      rosterLimits,
      humanMembers,
      draftState.currentRound,
      { autoDraftStarPlayerIdsByTeam }
    );
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('CPU bid generation timeout')), 30000); // 30 second timeout
    });
    
    let cpuBids;
    try {
      cpuBids = await Promise.race([cpuBidsPromise, timeoutPromise]);
      console.log(`[processRound] CPU bid generation completed successfully`);
    } catch (error) {
      console.error(`[processRound] CPU bid generation failed:`, error.message);
      cpuBids = {}; // Use empty bids if generation fails
    }

    if (!cpuBids || Object.keys(cpuBids).length === 0) {
      const normalizedHumans = new Set((humanMembers || []).map(name => String(name || '').trim().toLowerCase()));
      const maxRosterSize = Math.max(1, (rosterSize || 0) + 3);
      const fallbackBids = {};
      const undraftedRoundPlayers = (roundPlayers || []).filter(player => player && !player.owner);

      for (const team of teams || []) {
        const teamName = String(team && team.name || '').trim();
        if (!teamName) continue;

        const isCpuTeam = /^Team\s+\d+$/i.test(teamName) || !normalizedHumans.has(teamName.toLowerCase());
        if (!isCpuTeam) continue;

        const currentRosterSize = Array.isArray(team.roster) ? team.roster.length : 0;
        if (currentRosterSize >= maxRosterSize) continue;

        const teamBudget = Number(team.budget || 0);
        if (teamBudget <= 0) continue;

        const pick = undraftedRoundPlayers.find(player => {
          if (!player || !player.position) return false;
          const positionRules = rosterLimits[player.position];
          if (!positionRules) return false;
          const currentAtPosition = (team.roster || []).filter(p => p.position === player.position).length;
          return currentAtPosition < positionRules.max;
        }) || undraftedRoundPlayers[0];

        if (!pick) continue;

        const fallbackBid = Math.max(1, Math.min(5, teamBudget));
        fallbackBids[teamName] = [{ player: pick, cpuBid: fallbackBid }];
      }

      if (Object.keys(fallbackBids).length > 0) {
        cpuBids = fallbackBids;
        console.warn(`[processRound] Applied emergency CPU fallback bids for ${Object.keys(fallbackBids).length} teams`);
      }
    }
    
    console.log(`[processRound] Processing round ${draftState.currentRound} with:`);
    console.log(`[processRound] - ${roundPlayers.length} players in round`);
    console.log(`[processRound] - ${humanMembers.length} human members: ${humanMembers.join(', ')}`);
    console.log(`[processRound] - CPU bids generated for ${Object.keys(cpuBids).length} teams`);
    console.log(`[processRound] - User bids available:`, JSON.stringify(sanitizedUserBids, null, 2));

    const cpuBidTeamCount = Object.keys(cpuBids || {}).length;
    const cpuBidEntryCount = Object.values(cpuBids || {}).reduce((sum, arr) => {
      const size = Array.isArray(arr) ? arr.length : 0;
      return sum + size;
    }, 0);
    const userBidPlayerCount = Object.keys(sanitizedUserBids || {}).length;
    const userBidEntryCount = Object.values(sanitizedUserBids || {}).reduce((sum, teamBids) => {
      const size = teamBids && typeof teamBids === 'object' ? Object.keys(teamBids).length : 0;
      return sum + size;
    }, 0);
    const roundDiagnostics = {
      draftCode: code,
      round: Number(draftState.currentRound || 0),
      roundPlayers: Array.isArray(roundPlayers) ? roundPlayers.length : 0,
      teams: Array.isArray(teams) ? teams.length : 0,
      cpuBidTeamCount,
      cpuBidEntryCount,
      userBidPlayerCount,
      userBidEntryCount
    };
    console.log('[processRound][debug] diagnostics:', roundDiagnostics);
    io.to(`draft_${code}`).emit('roundDiagnostics', roundDiagnostics);
    
    try {
      // Process each player's auction
      const auctionResults = await processAuctions(roundPlayers, teams, cpuBids, sanitizedUserBids, rosterLimits, flexPositions, rosterSize, draftState.currentRound);
      if (Array.isArray(roundPlayers) && roundPlayers.length > 0 && Array.isArray(auctionResults.results) && auctionResults.results.length === 0) {
        console.warn('[processRound] Empty results returned for non-empty roundPlayers; applying undrafted fallback', {
          draftCode: code,
          round: draftState.currentRound,
          roundPlayers: roundPlayers.length
        });
        auctionResults.results = roundPlayers.map((player) => ({
          type: 'undrafted',
          playerId: player && player.id,
          playerName: String(player && player.name || `Player ${player && player.id ? player.id : '?'}`),
          allBids: (Array.isArray(teams) ? teams : []).map((team) => ({
            teamName: String(team && team.name || ''),
            amount: 0
          }))
        }));
      }

      const existingTracker = draftState.participationTracker && typeof draftState.participationTracker === 'object'
        ? draftState.participationTracker
        : { history: [], lastRound: null, baselineAvgBidPerPlayer: 0, dropFromBaselinePct: 0 };
      const previousHistory = Array.isArray(existingTracker.history) ? existingTracker.history : [];
      const previousWindow = previousHistory.slice(-3);
      const baselineAvgBidPerPlayer = previousWindow.length > 0
        ? Number((previousWindow.reduce((sum, round) => sum + Number(round && round.avgBidPerPlayer || 0), 0) / previousWindow.length).toFixed(2))
        : Number(auctionResults.participationStats && auctionResults.participationStats.avgBidPerPlayer || 0);
      const currentAvgBidPerPlayer = Number(auctionResults.participationStats && auctionResults.participationStats.avgBidPerPlayer || 0);
      const dropFromBaselinePct = baselineAvgBidPerPlayer > 0
        ? Number(Math.max(0, ((baselineAvgBidPerPlayer - currentAvgBidPerPlayer) / baselineAvgBidPerPlayer) * 100).toFixed(1))
        : 0;

      const roundParticipation = {
        roundNumber: Number(draftState.currentRound || 0),
        avgBidPerPlayer: currentAvgBidPerPlayer,
        avgBidPerEntry: Number(auctionResults.participationStats && auctionResults.participationStats.avgBidPerEntry || 0),
        totalBidAmount: Number(auctionResults.participationStats && auctionResults.participationStats.totalBidAmount || 0),
        totalBidAmountPerTeam: Number(auctionResults.participationStats && auctionResults.participationStats.totalBidAmountPerTeam || 0),
        teamsInDraft: Number(auctionResults.participationStats && auctionResults.participationStats.teamsInDraft || 0),
        teamsWithBid: Number(auctionResults.participationStats && auctionResults.participationStats.teamsWithBid || 0),
        participationRate: Number(auctionResults.participationStats && auctionResults.participationStats.participationRate || 0),
        playersInRound: Number(auctionResults.participationStats && auctionResults.participationStats.playersInRound || 0),
        bidEntries: Number(auctionResults.participationStats && auctionResults.participationStats.bidEntries || 0),
        playerBidTotals: Array.isArray(auctionResults.participationStats && auctionResults.participationStats.playerBidTotals)
          ? auctionResults.participationStats.playerBidTotals
          : [],
        dropFromBaselinePct
      };

      draftState.participationTracker = {
        history: previousHistory.concat(roundParticipation).slice(-20),
        lastRound: roundParticipation,
        baselineAvgBidPerPlayer,
        dropFromBaselinePct
      };
      
      // Final safety net: enforce silent-auction pricing invariants on emitted results.
      if (Array.isArray(auctionResults && auctionResults.results)) {
        auctionResults.results = auctionResults.results.map((result) => {
          if (!result || result.type !== 'won') {
            return result;
          }

          const resultBids = Array.isArray(result.allBids) ? result.allBids : [];
          const winnerTeamName = String(result.winnerTeam || '').trim();
          const winnerBidFromAllBids = resultBids.find((entry) => String(entry && entry.teamName || '').trim() === winnerTeamName);
          const winningBid = Math.max(0, Number(
            winnerBidFromAllBids && Number.isFinite(Number(winnerBidFromAllBids.amount))
              ? winnerBidFromAllBids.amount
              : result.bidAmount
          ));

          const secondHighestEntry = resultBids
            .map((entry) => ({
              teamName: String(entry && entry.teamName || '').trim(),
              amount: Math.max(0, Number(entry && entry.amount || 0))
            }))
            .filter((entry) => entry.teamName && entry.amount > 0 && entry.amount < winningBid)
            .sort((a, b) => b.amount - a.amount)[0] || null;

          const secondHighest = secondHighestEntry ? Number(secondHighestEntry.amount || 0) : 0;
          const normalizedSecondHighest = Math.min(secondHighest, Math.max(0, winningBid - 1));
          const normalizedSecondHighestBidder = secondHighestEntry ? secondHighestEntry.teamName : null;
          const expectedPrice = winningBid > 0
            ? Math.max(1, Math.min(normalizedSecondHighest + 1, winningBid))
            : 0;
          const currentPrice = Math.max(0, Number(result.pricePaid || 0));
          const currentWinningBid = Math.max(0, Number(result.bidAmount || 0));
          const currentSecondBid = Math.max(0, Number(result.secondHighestBid || 0));
          const currentSecondBidder = result.secondHighestBidder ? String(result.secondHighestBidder).trim() : null;

          if (
            expectedPrice !== currentPrice
            || winningBid !== currentWinningBid
            || normalizedSecondHighest !== currentSecondBid
            || (normalizedSecondHighestBidder || null) !== (currentSecondBidder || null)
          ) {
            console.warn(`[processRound] Corrected winning result for ${result.playerName}: bid=$${currentWinningBid}->${winningBid}, second=$${currentSecondBid}->${normalizedSecondHighest}, secondBidder=${currentSecondBidder || 'none'}->${normalizedSecondHighestBidder || 'none'}, price=$${currentPrice}->${expectedPrice}`);
            return {
              ...result,
              bidAmount: winningBid,
              secondHighestBid: normalizedSecondHighest,
              secondHighestBidder: normalizedSecondHighestBidder,
              pricePaid: expectedPrice
            };
          }

          return result;
        });
      }

      // Store complete results (including tiedBids) for auction processing
      draftState.lastRoundResults = auctionResults;

      const emittedResults = Array.isArray(auctionResults && auctionResults.results) ? auctionResults.results : [];
      const resultTypeSummary = emittedResults.reduce((acc, result) => {
        const type = String(result && result.type || 'unknown').trim().toLowerCase();
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});
      const winnerTeamSample = emittedResults
        .filter(result => String(result && result.type || '').trim().toLowerCase() === 'won')
        .slice(0, 12)
        .map(result => ({
          playerId: result && result.playerId,
          playerName: result && result.playerName,
          winnerTeam: result && result.winnerTeam,
          bidAmount: result && result.bidAmount,
          pricePaid: result && result.pricePaid
        }));
      console.log('[processRound][debug] roundResults payload summary:', {
        draftCode: code,
        round: draftState.currentRound,
        totalResults: emittedResults.length,
        resultTypeSummary,
        winnerTeamSample
      });
      
      // Broadcast results array to all members (they expect the results array)
      io.to(`draft_${code}`).emit('roundResults', auctionResults.results);
      console.log(`[processRound] Emitted roundResults to room draft_${code}:`, auctionResults.results.length, 'results');
      io.to(`draft_${code}`).emit('roundDiagnostics', {
        ...roundDiagnostics,
        emittedResults: Array.isArray(auctionResults.results) ? auctionResults.results.length : 0,
        emittedWon: Array.isArray(auctionResults.results) ? auctionResults.results.filter(r => String(r && r.type || '').toLowerCase() === 'won').length : 0,
        emittedTied: Array.isArray(auctionResults.results) ? auctionResults.results.filter(r => String(r && r.type || '').toLowerCase() === 'tied').length : 0,
        emittedUndrafted: Array.isArray(auctionResults.results) ? auctionResults.results.filter(r => String(r && r.type || '').toLowerCase() === 'undrafted').length : 0
      });
      io.to(`draft_${code}`).emit('participationTrackerUpdated', draftState.participationTracker);
      
      // Reset acceptance tracking for the new round results
      drafts[code].draftState.acceptedMembers = [];
      
      console.log(`[processRound] Results: ${auctionResults.results.length} outcomes, ${auctionResults.tiedBids.length} tied bids`);
      if(cb) cb({ ok: true });
    } catch (error) {
      console.error(`[processRound] ERROR processing auctions:`, error);
      console.error(error.stack);
      
      // Reset processing flag on error
      drafts[code].draftState.isProcessingRound = false;
      
      // Emit error to client
      io.to(`draft_${code}`).emit('roundProcessingError', { 
        message: 'Failed to process round results', 
        error: error.message 
      });
      
      if(cb) cb({ ok: false, reason: 'processing_error', error: error.message });
    } finally {
      // Always reset the processing flag
      drafts[code].draftState.isProcessingRound = false;
    }
  });

  // Member accepts round results
  socket.on('acceptRoundResults', (code, username, cb) => {
    try {
      const draft = drafts[code];
      if (!draft || !draft.draftState) {
        if (cb) cb({ ok: false, reason: 'draft_not_ready' });
        return;
      }

      const socketUser = String(socket.data.username || '').trim();
      const providedUser = String(username || '').trim();
      const resolvedUser = socketUser || providedUser;

      console.log(`[acceptRoundResults] ${resolvedUser} accepted results in ${code}`);

      if (!draft.draftState.acceptedMembers) {
        draft.draftState.acceptedMembers = [];
      }

      if (resolvedUser && !draft.draftState.acceptedMembers.includes(resolvedUser)) {
        draft.draftState.acceptedMembers.push(resolvedUser);
      }

      const humanMembers = Array.isArray(draft.members) ? draft.members : [];
      const acceptedCount = draft.draftState.acceptedMembers.length;
      const totalMembers = humanMembers.length;
      const allAccepted = totalMembers === 0 || acceptedCount >= totalMembers;

      console.log(`[acceptRoundResults] ${acceptedCount}/${totalMembers} human members have accepted`);

      const remaining = Math.max(0, totalMembers - acceptedCount);
      io.to(`draft_${code}`).emit('memberAcceptedResults', {
        username: resolvedUser,
        acceptedCount,
        totalMembers,
        message: remaining > 0 ? `Waiting for ${remaining} more member(s) to accept...` : 'All members accepted!'
      });

      if (allAccepted) {
        console.log(`[acceptRoundResults] All ${totalMembers} human members accepted - advancing to next round`);

        const lastResults = draft.draftState.lastRoundResults;
        console.log(`[acceptRoundResults] lastResults structure:`, JSON.stringify(lastResults, null, 2));

        io.to(`draft_${code}`).emit('allMembersAccepted');

        if (lastResults && lastResults.tiedBids && lastResults.tiedBids.length > 0) {
          console.log(`[acceptRoundResults] Found ${lastResults.tiedBids.length} tied bids, will start auctions automatically`);
          try {
            draft.draftState.pendingAuctions = [...lastResults.tiedBids];
            const firstTie = draft.draftState.pendingAuctions.shift();
            console.log(`[acceptRoundResults] Starting first auction for:`, firstTie);
            startServerLiveAuction(code, firstTie);
          } catch (err) {
            console.error(`[acceptRoundResults] ERROR starting auction:`, err);
            console.error(err.stack);
          }
        } else {
          console.log(`[acceptRoundResults] No tied bids detected, proceeding to next round`);
        }

        draft.draftState.acceptedMembers = [];
        draft.draftState.submittedMembers = [];
        draft.draftState.isProcessingRound = false;
      }

      if (cb) cb({ ok: true, acceptedCount, totalMembers, allAccepted });
    } catch (error) {
      console.error('[acceptRoundResults] Unexpected error:', error);
      if (cb) cb({ ok: false, reason: 'server_error' });
    }
  });

  // Start next round (host only)
  socket.on('startNextRound', (code, cb) => {
    const username = socket.data.username;
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === username){
      const roundTimerMinutes = Number.isFinite(Number.parseInt(drafts[code].roundTimerMinutes, 10))
        ? Math.max(3, Math.min(Number.parseInt(drafts[code].roundTimerMinutes, 10), 10))
        : 10;
      drafts[code].draftState.currentRound++;
      drafts[code].draftState.roundTimer = roundTimerMinutes * 60;
      drafts[code].draftState.roundTimerMinutes = roundTimerMinutes;
      drafts[code].draftState.bids = {};
      drafts[code].draftState.recentAcquisitions = {}; // Clear recent acquisitions for new round
      
      console.log(`[startNextRound] Round ${drafts[code].draftState.currentRound} started by ${username}`);
      
      // Broadcast new round to all members
      io.to(`draft_${code}`).emit('roundStarted', drafts[code].draftState);
      
      if(cb) cb({ ok: true });
    } else {
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // ==================== LIVE AUCTION FOR TIES ====================

  function isCpuControlledTeam(code, teamName) {
    if (/^Team \d+$/.test(teamName)) {
      return true;
    }
    const autoDraftStatus = drafts[code]?.draftState?.autoDraftStatus || {};
    return !!autoDraftStatus[teamName];
  }
  
  // Server function to automatically start live auction when ties are detected
  function startServerLiveAuction(code, tiedBid) {
    console.log(`[startServerLiveAuction] Starting auction for ${tiedBid.playerName} in ${code}`);
    
    if (!drafts[code].draftState.liveAuctions) {
      drafts[code].draftState.liveAuctions = {};
    }
    
    const { playerId, playerName, tiedTeams, bidAmount, position, avgValue, positionRank } = tiedBid;
    
    // Server generates the auctionId
    const auctionId = `${code}_${playerId}_${Date.now()}`;
    console.log(`[startServerLiveAuction] Server-generated auctionId: ${auctionId}`);
    
    drafts[code].draftState.liveAuctions[auctionId] = {
      playerId,
      playerName,
      playerPosition: position || 'UNK',
      playerAvgValue: avgValue || 1,
      playerPositionRank: positionRank,
      tiedTeams: [...tiedTeams],
      isTiedAuction: tiedTeams.length > 1,
      currentBid: bidAmount,
      currentWinner: null,
      bids: {},
      timer: 10,
      active: true,
      backedOutTeams: [],
      timerInterval: null
    };
    
    // Broadcast auction start
    console.log(`[startServerLiveAuction] Broadcasting liveAuctionStarted to draft_${code}`);
    io.to(`draft_${code}`).emit('liveAuctionStarted', {
      auctionId,
      playerId,
      playerName,
      tiedTeams,
      startBid: bidAmount
    });
    console.log(`[startServerLiveAuction] Broadcast complete`);
    
    // Start timer (code continues below in existing timer interval logic)
    startAuctionTimer(code, auctionId);
  }
  
  // Start auction timer (extracted from old socket handler)
  function startAuctionTimer(code, auctionId) {
    const configuredRosterSize = Math.max(1, Number(drafts[code]?.draftState?.rosterSize || 0));

    // Start timer
    const timerInterval = setInterval(() => {
      if (!drafts[code]) {
        console.log(`[timerInterval] Draft ${code} missing entirely, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      if (!drafts[code].draftState) {
        console.log(`[timerInterval] Draft state for ${code} is undefined, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      const auction = drafts[code].draftState.liveAuctions[auctionId];
      if (!auction || !auction.active) {
        console.log(`[timerInterval] Auction inactive or missing, clearing interval`);
        clearInterval(timerInterval);
        return;
      }
      
      auction.timer--;
      console.log(`[timerInterval] ${auctionId} timer: ${auction.timer}s`);
      
      // Broadcast timer update
      io.to(`draft_${code}`).emit('liveAuctionTimerUpdate', {
        auctionId,
        timer: auction.timer
      });
      
      // TIE BREAKER PHASE: When timer hits 2 seconds and multiple CPUs are tied (only for tied auctions)
      if (auction.timer <= 2 && auction.isTiedAuction) {
        const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
        const cpuRemaining = remainingTeams.filter(t => isCpuControlledTeam(code, t));

        if (cpuRemaining.length > 1) {
          console.log(`[TIE BREAKER] ${auction.timer}s left, ${cpuRemaining.length} CPUs still tied: ${cpuRemaining.join(', ')}`);

          // Get player data
          const player = drafts[code].draftState.allPlayers?.find(p => p.id === auction.playerId);
          const position = player?.position || 'UNK';

          // Each CPU recalculates aggression with current context
          const remainingAfterBackout = [];

          for (const cpuName of cpuRemaining) {
            const cpuTeam = drafts[code].draftState.teams.find(t => t.name === cpuName);
            if (!cpuTeam) continue;

            if (auction.currentWinner === cpuName) {
              // Current leader cannot back out; they set the standing top bid.
              remainingAfterBackout.push(cpuName);
              continue;
            }

            // Calculate position need
            const rosterCounts = cpuTeam.roster.reduce((c, p) => {
              c[p.position] = (c[p.position] || 0) + 1;
              return c;
            }, {});

            const rosterLimits = drafts[code].draftState.rosterLimits || {};
            const currentCount = rosterCounts[position] || 0;
            const minNeeded = rosterLimits[position]?.min || 1;
            const positionNeed = Math.max(0, minNeeded - currentCount) / minNeeded;

            // Build context for tie breaker
            const context = {
              currentBid: auction.currentBid,
              playerAV: player?.avgValue || auction.playerAvgValue || 1,
              teamsRemaining: cpuRemaining.length,
              round: drafts[code].draftState.currentRound || 1,
              budgetRemaining: cpuTeam.budget,
              positionNeed: positionNeed,
              timeLeft: auction.timer
            };

            // Get aggression and decide
            const aggression = getAggression(cpuTeam, context);
            const action = decideAction(cpuTeam, context);

            console.log(`[TIE BREAKER] ${cpuName} - Aggression: ${aggression.toFixed(3)}, PositionNeed: ${positionNeed.toFixed(2)} → ${action.toUpperCase()}`);

            if (action === 'backout') {
              console.log(`[TIE BREAKER] ${cpuName} backed out at $${auction.currentBid}`);
              auction.backedOutTeams.push(cpuName);
              io.to(`draft_${code}`).emit('liveAuctionBackout', { auctionId, teamName: cpuName });
            } else {
              remainingAfterBackout.push(cpuName);
            }
          }

          // Case 1: one remains → wins
          if (remainingAfterBackout.length === 1) {
            console.log(`[TIE BREAKER] ${remainingAfterBackout[0]} wins by default at $${auction.currentBid}`);
            completeLiveAuction(code, auctionId);
            return;
          }

          // Case 2: multiple remain → force final bid
          if (remainingAfterBackout.length > 1) {
            console.log(`[TIE BREAKER] ${remainingAfterBackout.length} CPUs still tied, forcing a final bid`);
            const aggressor = pickRandomCPU(remainingAfterBackout);
            const forceStep = Math.max(1, (auction.playerAvgValue >= 15 || (drafts[code].draftState.currentRound || 1) <= 2) ? 2 : 1);
            const forcedBid = Math.min(999, auction.currentBid + forceStep + (Math.random() < 0.4 ? 1 : 0));
            placeForcedBid(code, auctionId, aggressor, forcedBid, drafts, io);
            return;
          }

          // Case 3: all backed out (rare) → randomly assign
          if (remainingAfterBackout.length === 0) {
            console.log(`[TIE BREAKER] All CPUs backed out, forcing one team to remain`);
            const randomWinner = pickRandomCPU(cpuRemaining);
            if (randomWinner) {
              auction.backedOutTeams = auction.backedOutTeams.filter(teamName => teamName !== randomWinner);
              auction.currentWinner = randomWinner;
            }
            completeLiveAuction(code, auctionId);
            return;
          }
        }
      }
      
      // CPU AI bidding - use clean tied auction module.
      // Wait until timer is under 5s so users can react before CPUs back out.
      if (auction.timer > 0 && auction.timer % 2 === 0 && auction.timer < 5) {
        try {
          // Safety checks
          if (!drafts[code] || !drafts[code].draftState || !drafts[code].draftState.teams) {
            console.log(`[CPU AI] Draft state missing, clearing interval`);
            clearInterval(timerInterval);
            return;
          }
        
          // Get CPU teams that are still active
          const cpuTeams = auction.tiedTeams.filter(t => {
            const team = drafts[code].draftState.teams.find(tm => tm.name === t);
            const isCPU = isCpuControlledTeam(code, t);
            const notBackedOut = !auction.backedOutTeams.includes(t);
            return team && isCPU && notBackedOut;
          });

          if (cpuTeams.length === 0) {
            console.log(`[CPU AI] No CPU teams in auction, skipping AI logic`);
            return;
          }
        
          // Get player data
          const player = drafts[code].draftState.allPlayers?.find(p => p.id === auction.playerId);
          const position = player?.position || 'UNK';

          // Prepare CPU objects for the module
          const cpus = cpuTeams.map(cpuName => {
            const cpuTeam = drafts[code].draftState.teams.find(t => t.name === cpuName);

            // Calculate position needs
            const rosterCounts = cpuTeam.roster.reduce((c, p) => {
              c[p.position] = (c[p.position] || 0) + 1;
              return c;
            }, {});

            const rosterLimits = drafts[code].draftState.rosterLimits || {};
            const currentCount = rosterCounts[position] || 0;
            const minNeeded = rosterLimits[position]?.min || 1;
            const positionNeed = Math.max(0, minNeeded - currentCount) / minNeeded;

            return {
              name: cpuName,
              budget: cpuTeam.budget,
              riskTolerance: cpuTeam.riskTolerance || 1.0,
              isIn: true,
              rosterSpotsLeft: Math.max(0, configuredRosterSize - (Array.isArray(cpuTeam.roster) ? cpuTeam.roster.length : 0)),
              needs: { [position]: positionNeed },
              aggression: 0 // Will be calculated by module
            };
          });

          // Run the clean auction round
          const result = runTiedAuctionRound({
            cpus,
            currentBid: auction.currentBid,
            playerAV: player?.avgValue || auction.playerAvgValue || 1,
            playerPrerank: Number(player?.prerank || player?.positionRank || 999),
            position,
            round: drafts[code].draftState.currentRound || 1,
            timeLeft: auction.timer
          });

          // Handle the result
          if (result.type === 'win') {
            console.log(`[CPU AI] ${result.winner.name} wins at $${result.price}`);
            auction.currentWinner = result.winner.name;
            clearInterval(timerInterval);
            completeLiveAuction(code, auctionId);
            return;
          }

          if (result.type === 'bid') {
            console.log(`[CPU AI] ${result.bidder.name} bids $${result.newBid}`);
            auction.currentBid = result.newBid;
            auction.currentWinner = result.bidder.name;
            auction.bids[result.bidder.name] = result.newBid;
            auction.timer = 10; // Reset timer

            io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
              auctionId,
              bidder: result.bidder.name,
              amount: result.newBid
            });
          }

          // Update backed out teams
          cpus.filter(c => !c.isIn).forEach(cpu => {
            if (auction.currentWinner === cpu.name) {
              return;
            }
            if (!auction.backedOutTeams.includes(cpu.name)) {
              auction.backedOutTeams.push(cpu.name);
              io.to(`draft_${code}`).emit('liveAuctionBackout', { auctionId, teamName: cpu.name });
              console.log(`[CPU AI] ${cpu.name} backed out`);
            }
          });

          // Check if only 1 team remains
          const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
          if (remainingTeams.length <= 1) {
            console.log(`[CPU AI] Only ${remainingTeams.length} team(s) remain, ending auction early`);
            clearInterval(timerInterval);
            completeLiveAuction(code, auctionId);
            return;
          }

          

          

          

          

          



        

        } catch (aiError) {
          console.error(`[CPU AI] Error in AI bidding logic:`, aiError);
          console.error(aiError.stack);
        }
      }
      
      // Timer expired
      if (auction.timer <= 0) {
        console.log(`[timerInterval] Timer expired for ${auctionId}`);
        clearInterval(timerInterval);
        try {
          completeLiveAuction(code, auctionId);
        } catch (completeError) {
          console.error(`[timerInterval] Error completing auction ${auctionId}:`, completeError);
          console.error(completeError.stack);
        }
      }
    }, 1000);
    
    // Store the interval reference
    const auction = drafts[code].draftState.liveAuctions[auctionId];
    if (auction) {
      auction.timerInterval = timerInterval;
    }
  }
  
  // Function to complete a live auction
  function completeLiveAuction(code, auctionId) {
    try {
      console.log(`[completeLiveAuction] Starting completion for ${auctionId}`);
      
      if (!drafts[code] || !drafts[code].draftState || !drafts[code].draftState.liveAuctions) {
        console.error(`[completeLiveAuction] Draft state missing for ${code}`);
        return;
      }
      
      const auction = drafts[code].draftState.liveAuctions[auctionId];
      if (!auction) {
        console.error(`[completeLiveAuction] Auction ${auctionId} not found`);
        return;
      }
      
      auction.active = false;
      
      // Determine winner strictly from active teams (teams that did not back out).
      let remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
      let winner = null;
      let winningBid = auction.currentBid;

      const activeBidEntries = Object.entries(auction.bids || {})
        .filter(([teamName]) => remainingTeams.includes(teamName));

      if (activeBidEntries.length > 0) {
        activeBidEntries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
        winner = activeBidEntries[0][0];
        winningBid = Math.max(auction.startBid || 0, activeBidEntries[0][1] || 0);
      } else if (remainingTeams.length === 1) {
        winner = remainingTeams[0];
        winningBid = Math.max(auction.startBid || 0, auction.currentBid || 0);
      } else if (remainingTeams.length > 1) {
        if (auction.currentWinner && remainingTeams.includes(auction.currentWinner)) {
          winner = auction.currentWinner;
        } else {
          winner = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
        }
        winningBid = Math.max(auction.startBid || 0, auction.currentBid || 0);
      } else {
        // Safety fallback: should be rare (e.g., synchronized all-backout race).
        // Force one original tied team back in rather than awarding to a backed-out team.
        winner = auction.tiedTeams[Math.floor(Math.random() * auction.tiedTeams.length)];
        auction.backedOutTeams = auction.backedOutTeams.filter(teamName => teamName !== winner);
        remainingTeams = [winner];
        winningBid = Math.max(auction.startBid || 0, auction.currentBid || 0);
        console.warn(`[completeLiveAuction] All teams backed out; forced fallback winner ${winner}`);
      }
      
      console.log(`[completeLiveAuction] Auction ended - Winner: ${winner}, Bid: $${winningBid}`);
      
      // Award player to winner
      const winnerTeam = drafts[code].draftState.teams.find(t => t.name === winner);
      const player = { id: auction.playerId, playerName: auction.playerName, position: auction.playerPosition || 'UNK', avgValue: auction.playerAvgValue || 1, bidAmount: winningBid, positionRank: auction.playerPositionRank };
      
      if (winnerTeam) {
        winnerTeam.budget -= winningBid;
        winnerTeam.roster.push({ id: player.id, name: player.playerName, position: player.position, bid: player.bidAmount, prerank: player.avgValue, positionRank: player.positionRank });
        
        // Reorder roster: sort by position, then by prerank (lower = better)
        winnerTeam.roster.sort((a, b) => {
          // Define position priority order for sorting
          const positionOrder = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6 };
          
          // First sort by position priority
          const posA = positionOrder[a.position] || 99;
          const posB = positionOrder[b.position] || 99;
          if (posA !== posB) {
            return posA - posB;
          }
          // Within same position, sort by prerank (lower = better player)
          return a.positionRank - b.positionRank;
        });
        
        // Track recent acquisitions for this round
        if (!drafts[code].draftState.recentAcquisitions) {
          drafts[code].draftState.recentAcquisitions = {};
        }
        if (!drafts[code].draftState.recentAcquisitions[winner]) {
          drafts[code].draftState.recentAcquisitions[winner] = [];
        }
        drafts[code].draftState.recentAcquisitions[winner].push(player);
        
        console.log(`[completeLiveAuction] Awarded ${auction.playerName} to ${winner} for $${winningBid}`);
      } else {
        console.error(`[completeLiveAuction] Winner team not found: ${winner}`);
      }
      
      console.log(`[completeLiveAuction] Emitting liveAuctionEnded to draft_${code}`);
      
      // Emit winner announcement for display
      io.to(`draft_${code}`).emit('liveAuctionWinnerAnnouncement', {
        auctionId,
        winner,
        finalBid: winningBid,
        playerId: auction.playerId,
        playerName: auction.playerName,
        playerPosition: auction.playerPosition || 'UNK'
      });
      
      io.to(`draft_${code}`).emit('liveAuctionEnded', {
        auctionId,
        winner,
        finalBid: winningBid,
        playerId: auction.playerId,
        playerName: auction.playerName
      });
      
        // Check if there are more pending auctions
      if (drafts[code] && drafts[code].draftState && drafts[code].draftState.pendingAuctions && drafts[code].draftState.pendingAuctions.length > 0) {
        const nextTiePreview = drafts[code].draftState.pendingAuctions[0];
        console.log(`[completeLiveAuction] ${drafts[code].draftState.pendingAuctions.length} more auctions pending, starting next after the summary/winner sequence completes...`);
        io.to(`draft_${code}`).emit('liveAuctionTransition', {
          auctionId,
          nextPlayerId: nextTiePreview ? nextTiePreview.playerId : null,
          nextPlayerName: nextTiePreview ? nextTiePreview.playerName : null,
          nextPlayerPosition: nextTiePreview ? nextTiePreview.playerPosition || 'UNK' : 'UNK',
          message: nextTiePreview
            ? `Preparing for next auction: ${nextTiePreview.playerName || 'Next player'}...`
            : 'Preparing for next auction...'
        });
        setTimeout(() => {
          try {
            if (drafts[code] && drafts[code].draftState && drafts[code].draftState.pendingAuctions && drafts[code].draftState.pendingAuctions.length > 0) {
              const nextTie = drafts[code].draftState.pendingAuctions.shift();
              if (nextTie) {
                startServerLiveAuction(code, nextTie);
              } else {
                console.error(`[completeLiveAuction] nextTie was undefined`);
              }
            }
          } catch (nextAuctionError) {
            console.error(`[completeLiveAuction] Error starting next auction:`, nextAuctionError);
            console.error(nextAuctionError.stack);
          }
        }, 7000);
      } else {
        console.log(`[completeLiveAuction] No more auctions, waiting 2 seconds then emitting allMembersAccepted to draft_${code}`);
        // Keep the completion flow tight so the PWA doesn't feel stalled.
        setTimeout(() => {
          try {
            if (drafts[code]) {
              io.to(`draft_${code}`).emit('allMembersAccepted');
              console.log(`[completeLiveAuction] allMembersAccepted emitted successfully`);
            }
          } catch (emitError) {
            console.error(`[completeLiveAuction] Error emitting allMembersAccepted:`, emitError);
            console.error(emitError.stack);
          }
        }, 6000);
      }
    } catch (err) {
      console.error(`[completeLiveAuction] ERROR:`, err);
      console.error(err.stack);
    }
  }
  
  // Place bid in live auction
  socket.on('placeLiveAuctionBid', (code, auctionId, bidAmount, cb) => {
    const username = socket.data.username;
    const normalizedUsername = String(username || '').trim().toLowerCase();
    console.log(`[placeLiveAuctionBid] ${username} bid $${bidAmount}`);

    const autoDraftStatus = drafts[code]?.draftState?.autoDraftStatus || {};
    if (autoDraftStatus[username]) {
      if (cb) cb({ ok: false, reason: 'auto_draft_enabled' });
      return;
    }
    
    const auction = drafts[code]?.draftState?.liveAuctions?.[auctionId];
    if (!auction || !auction.active) {
      if (cb) cb({ ok: false, reason: 'auction_not_found' });
      return;
    }

    const matchedTeamName = auction.tiedTeams.find((teamName) => (
      String(teamName || '').trim().toLowerCase() === normalizedUsername
    ));
    
    if (!matchedTeamName) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }
    
    if (auction.backedOutTeams.includes(matchedTeamName)) {
      if (cb) cb({ ok: false, reason: 'backed_out' });
      return;
    }
    
    if (bidAmount <= auction.currentBid) {
      if (cb) cb({ ok: false, reason: 'bid_too_low' });
      return;
    }
    
    // Check if team has enough budget
    const team = drafts[code].draftState.teams?.find(t => t.name === matchedTeamName);
    if (team && bidAmount > team.budget) {
      console.log(`[placeLiveAuctionBid] ${username} can't afford $${bidAmount} (budget: $${team.budget})`);
      if (cb) cb({ ok: false, reason: 'insufficient_budget' });
      return;
    }
    
    // Update auction
    auction.currentBid = bidAmount;
    auction.currentWinner = matchedTeamName;
    auction.bids[matchedTeamName] = bidAmount;
    auction.timer = 10; // Reset timer
    
    // Broadcast bid
    io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
      auctionId,
      bidder: matchedTeamName,
      amount: bidAmount
    });
    
    // CPU counter-bidding
    setTimeout(() => {
      if (!auction.active || !drafts[code]) return;
      
      // CPU teams are named "Team X" or "Team XX", human users have other names
      const cpuTeams = auction.tiedTeams.filter(t => {
        if (!drafts[code] || !drafts[code].draftState || !drafts[code].draftState.teams) return false;
        const team = drafts[code].draftState.teams.find(tm => tm.name === t);
        const isCPU = isCpuControlledTeam(code, t);
        const notBackedOut = !auction.backedOutTeams.includes(t);
        return team && isCPU && notBackedOut;
      });
      
      console.log(`[CPU Counter-bid] Auction ${auctionId}: ${cpuTeams.length} CPU teams found:`, cpuTeams);
      
      // Skip if no CPU teams in this auction
      if (cpuTeams.length === 0) {
        console.log(`[CPU Counter-bid] No CPU teams in auction, skipping counter-bid logic`);
        return;
      }
      
      cpuTeams.forEach(cpuName => {
        if (!drafts[code] || !drafts[code].draftState) return;
        const cpuTeam = drafts[code].draftState.teams.find(t => t.name === cpuName);
        if (!cpuTeam) return;
        
        // Calculate willingness to bid based on player value and team needs
        const avgValue = auction.playerAvgValue || 1;
        const isTopPlayer = avgValue >= 15;
        
        // Check recent acquisitions for position-based decision making
        const recentAcquisitions = drafts[code].draftState.recentAcquisitions?.[cpuName] || [];
        const samePositionRecent = recentAcquisitions.filter(p => p.position === auction.playerPosition);
        
        let bidProbability = isTopPlayer ? 0.7 : 0.4; // Base probability
        
        if (samePositionRecent.length > 0) {
          // CPU recently got a player at this position
          const recentPlayer = samePositionRecent[samePositionRecent.length - 1]; // Most recent
          const wasCheap = recentPlayer.bidAmount < (recentPlayer.avgValue * 0.7); // Less than 70% of AV
          
          if (wasCheap) {
            // Recent acquisition was a steal, so be more aggressive on this one
            bidProbability *= 1.5; // Increase probability
            console.log(`[CPU-${cpuName}] Recent ${recentPlayer.position} was cheap ($${recentPlayer.bidAmount} vs $${recentPlayer.avgValue} AV), being more aggressive on ${auction.playerName}`);
          } else {
            // Recent acquisition was fairly priced, more likely to back out
            bidProbability *= 0.3; // Decrease probability significantly
            console.log(`[CPU-${cpuName}] Recently got ${recentPlayer.position} for $${recentPlayer.bidAmount}, considering backing out of ${auction.playerName}`);
          }
        }
        
        // Position needs assessment
        const currentPositionCount = cpuTeam.roster.filter(p => p.position === auction.playerPosition).length;
        const maxForPosition = rosterLimits[auction.playerPosition] || 1;
        
        // Check if CPU already has elite players at this position
        const positionPlayers = cpuTeam.roster.filter(p => p.position === auction.playerPosition);
        const elitePlayersAtPosition = positionPlayers.filter(p => (p.prerank || 0) >= 20).length; // High-ranked players
        
        if (elitePlayersAtPosition >= 2) {
          // Already have 2+ elite players at this position, focus on other positions even if recent acquisition was cheap
          bidProbability *= 0.15; // Very low probability, overrides recent acquisition bonus
          console.log(`[CPU-${cpuName}] Already has ${elitePlayersAtPosition} elite ${auction.playerPosition} players (prerank >=20), focusing on other positions instead of ${auction.playerName} (overrides recent cheap acquisition)`);
        } else if (currentPositionCount >= maxForPosition) {
          // Already have max for this position, very unlikely to bid
          bidProbability *= 0.1;
          console.log(`[CPU-${cpuName}] Already has ${currentPositionCount}/${maxForPosition} ${auction.playerPosition}, unlikely to bid on ${auction.playerName}`);
        }
        
        // AV-aware bidding: be more conservative if current bid is already overvalued
        const currentBidVsAV = auction.currentBid / avgValue;
        if (currentBidVsAV > 1.5) {
          // Current bid is 50%+ above AV - very unlikely to bid further
          bidProbability *= 0.1;
          console.log(`[CPU-${cpuName}] Current bid $${auction.currentBid} is ${Math.round(currentBidVsAV * 100)}% of AV $${avgValue}, very unlikely to bid higher on ${auction.playerName}`);
        } else if (currentBidVsAV > 1.2) {
          // Current bid is 20%+ above AV - significantly reduce bid probability
          bidProbability *= 0.3;
          console.log(`[CPU-${cpuName}] Current bid $${auction.currentBid} is ${Math.round(currentBidVsAV * 100)}% of AV $${avgValue}, reducing bid probability on ${auction.playerName}`);
        } else if (currentBidVsAV < 0.8) {
          // Current bid is below 80% of AV - this is a potential bargain, increase bid probability
          bidProbability *= 1.3;
          console.log(`[CPU-${cpuName}] Current bid $${auction.currentBid} is only ${Math.round(currentBidVsAV * 100)}% of AV $${avgValue}, seeing as potential bargain for ${auction.playerName}`);
        }
        
        if (Math.random() < bidProbability) {
          // Calculate a reasonable counter-bid based on avgValue, but cap it appropriately
          let maxReasonableBid;
          if (avgValue >= 40) {
            // Elite players: willing to pay up to 1.2x AV max
            maxReasonableBid = Math.round(avgValue * 1.2);
          } else if (avgValue >= 20) {
            // High-value players: willing to pay up to 1.3x AV max
            maxReasonableBid = Math.round(avgValue * 1.3);
          } else {
            // Lower-value players: willing to pay up to 1.4x AV max
            maxReasonableBid = Math.round(avgValue * 1.4);
          }
          
          // Never bid more than the calculated maximum reasonable bid
          const absoluteMaxBid = Math.min(maxReasonableBid, cpuTeam.budget);
          
          // Calculate minimum bid needed to stay in auction
          const requiredMinBid = auction.currentBid + 1;
          
          if (requiredMinBid > absoluteMaxBid) {
            console.log(`[CPU-${cpuName}] Required minimum bid $${requiredMinBid} exceeds max reasonable bid $${absoluteMaxBid} for ${auction.playerName} (AV: $${avgValue})`);
            return; // Don't bid
          }
          
          // Calculate bid amount - aim for something between required minimum and reasonable maximum
          let targetBid;
          if (currentBidVsAV < 0.9) {
            // Bargain territory - bid more aggressively toward the higher end
            targetBid = Math.round(requiredMinBid + Math.random() * (absoluteMaxBid - requiredMinBid) * 0.8);
          } else {
            // Fair or overvalued - bid more conservatively
            targetBid = Math.round(requiredMinBid + Math.random() * Math.min(5, absoluteMaxBid - requiredMinBid));
          }
          
          const counterBid = Math.max(requiredMinBid, Math.min(targetBid, absoluteMaxBid));
          
          if (counterBid <= cpuTeam.budget && counterBid <= 999) {
            console.log(`[CPU-${cpuName}] Bidding $${counterBid} on ${auction.playerName} (AV: $${avgValue}, current: $${auction.currentBid}, max reasonable: $${absoluteMaxBid})`);
            auction.currentBid = counterBid;
            auction.currentWinner = cpuName;
            auction.bids[cpuName] = counterBid;
            auction.timer = 10;
            
            io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
              auctionId,
              bidder: cpuName,
              amount: counterBid
            });
          }
        }
      });
    }, 1500);
    
    if (cb) cb({ ok: true });
  });
  
  // Back out of auction
  socket.on('backoutLiveAuction', (code, auctionId, cb) => {
    const username = socket.data.username;
    const normalizedUsername = String(username || '').trim().toLowerCase();
    console.log(`[backoutLiveAuction] ${username} backing out`);

    const autoDraftStatus = drafts[code]?.draftState?.autoDraftStatus || {};
    if (autoDraftStatus[username]) {
      if (cb) cb({ ok: false, reason: 'auto_draft_enabled' });
      return;
    }
    
    const auction = drafts[code]?.draftState?.liveAuctions?.[auctionId];
    if (!auction || !auction.active) {
      if (cb) cb({ ok: false, reason: 'auction_not_found' });
      return;
    }

    const matchedTeamName = auction.tiedTeams.find((teamName) => (
      String(teamName || '').trim().toLowerCase() === normalizedUsername
    ));
    
    if (!matchedTeamName) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }

    if (auction.currentWinner === matchedTeamName) {
      if (cb) cb({ ok: false, reason: 'leading_bidder_cannot_backout' });
      return;
    }
    
    if (!auction.backedOutTeams.includes(matchedTeamName)) {
      auction.backedOutTeams.push(matchedTeamName);
    }
    
    // Broadcast backout
    io.to(`draft_${code}`).emit('liveAuctionBackout', {
      auctionId,
      teamName: matchedTeamName
    });
    
    // Check if only one team left
    const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
    if (remainingTeams.length === 1) {
      completeLiveAuction(code, auctionId);
    }
    
    if (cb) cb({ ok: true });
  });

  socket.on('pauseDraft', (code, _username, cb) => {
    const requester = socket.data.username;
    const draft = drafts[code];
    const host = draft && draft.members && draft.members[0];

    if (!draft) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    if (requester !== host) {
      console.warn(`[Pause] denied for ${requester} on ${code} (host: ${host})`);
      if (cb) cb({ ok: false, reason: 'not_host' });
      return;
    }

    console.log(`[Pause] ${requester} paused draft ${code}`);
    // Broadcast pause to all participants in this draft.
    io.to(`draft_${code}`).emit('draftPaused', { pausedBy: requester });
    if (cb) cb({ ok: true });
  });

  socket.on('resumeDraft', (code, _username, cb) => {
    const requester = socket.data.username;
    const draft = drafts[code];
    const host = draft && draft.members && draft.members[0];

    if (!draft) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    if (requester !== host) {
      console.warn(`[Resume] denied for ${requester} on ${code} (host: ${host})`);
      if (cb) cb({ ok: false, reason: 'not_host' });
      return;
    }

    console.log(`[Resume] ${requester} resumed draft ${code}`);
    // Broadcast resume to all participants in this draft.
    io.to(`draft_${code}`).emit('draftResumed', { resumedBy: requester });
    if (cb) cb({ ok: true });
  });

  socket.on('restartDraft', (code, username) => {
    console.log(`[Restart] ${username} restarted draft ${code}`);
    // Broadcast restart to all participants in this draft
    io.to(`draft_${code}`).emit('draftRestarted', { restartedBy: username });
  });

  // Handle bench cuts from draft summary page
  socket.on('cutPlayers', (data, cb) => {
    const { draftCode, teamName, cutIds, cutNames, cutSelections } = data || {};
    const draft = drafts[draftCode];

    if (!draft) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    const teams = draft.draftState && Array.isArray(draft.draftState.teams)
      ? draft.draftState.teams
      : (Array.isArray(draft.teams) ? draft.teams : null);

    if (!teams) {
      if (cb) cb({ ok: false, reason: 'teams_not_found' });
      return;
    }

    const team = teams.find(t => t.name === teamName);
    if (!team || !Array.isArray(team.roster)) {
      if (cb) cb({ ok: false, reason: 'team_not_found' });
      return;
    }

    const hasCutSelections = Array.isArray(cutSelections) && cutSelections.length > 0;
    const hasCutIds = Array.isArray(cutIds) && cutIds.length > 0;
    const hasCutNames = Array.isArray(cutNames) && cutNames.length > 0;
    if (!hasCutSelections && !hasCutIds && !hasCutNames) {
      if (cb) cb({ ok: false, reason: 'invalid_cut_ids' });
      return;
    }

    // Allow only the matching team owner to cut their roster.
    const requestUser = socket.data.username;
    if (requestUser && requestUser !== teamName) {
      if (cb) cb({ ok: false, reason: 'unauthorized' });
      return;
    }

    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 5 };
    const toRosterInt = (value, fallback, min, max) => {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    };
    const normalizeRosterSettings = (raw) => {
      const merged = Object.assign({}, DEFAULT_ROSTER_SETTINGS, raw || {});
      const normalized = {
        QB: toRosterInt(merged.QB, DEFAULT_ROSTER_SETTINGS.QB, 0, 8),
        WR: toRosterInt(merged.WR, DEFAULT_ROSTER_SETTINGS.WR, 0, 10),
        RB: toRosterInt(merged.RB, DEFAULT_ROSTER_SETTINGS.RB, 0, 10),
        TE: toRosterInt(merged.TE, DEFAULT_ROSTER_SETTINGS.TE, 0, 8),
        FLEX: toRosterInt(merged.FLEX, DEFAULT_ROSTER_SETTINGS.FLEX, 0, 5),
        K: toRosterInt(merged.K, DEFAULT_ROSTER_SETTINGS.K, 0, 5),
        DEF: toRosterInt(merged.DEF, DEFAULT_ROSTER_SETTINGS.DEF, 0, 5),
        BN: toRosterInt(merged.BN, DEFAULT_ROSTER_SETTINGS.BN, 0, 20)
      };
      const total = normalized.QB + normalized.WR + normalized.RB + normalized.TE + normalized.FLEX + normalized.K + normalized.DEF + normalized.BN;
      if (total < 8) normalized.BN += (8 - total);
      return normalized;
    };

    const rosterSettings = normalizeRosterSettings(
      draft.rosterSettings || (draft.draftState && draft.draftState.rosterSettings)
    );

    const slotBlueprint = [];
    const addSlots = (count, eligible) => {
      for (let i = 0; i < count; i++) slotBlueprint.push({ eligible });
    };
    addSlots(rosterSettings.QB || 0, ['QB']);
    addSlots(rosterSettings.WR || 0, ['WR']);
    addSlots(rosterSettings.RB || 0, ['RB']);
    addSlots(rosterSettings.TE || 0, ['TE']);
    addSlots(rosterSettings.FLEX || 0, ['RB', 'WR', 'TE']);
    addSlots(rosterSettings.K || 0, ['K']);
    addSlots(rosterSettings.DEF || 0, ['DEF']);

    // Build lineup to determine bench players using configured slot blueprint.
    const used = [];
    slotBlueprint.forEach((slot) => {
      const found = team.roster
        .filter(p => slot.eligible.includes(p.position) && !used.includes(p))
        .sort((a, b) => Number(a.prerank || 999) - Number(b.prerank || 999))[0] || null;
      if (found) used.push(found);
    });

    const bench = team.roster.filter(p => !used.includes(p));
    const rawCutTarget = Number.parseInt(draft.benchCutTarget, 10);
    const benchCutTarget = Number.isFinite(rawCutTarget) ? Math.max(0, Math.min(rawCutTarget, 13)) : 5;
    const maxTotalPlayers = slotBlueprint.length + benchCutTarget;
    const overTotal = Math.max(0, team.roster.length - maxTotalPlayers);
    const overBench = Math.max(0, bench.length - benchCutTarget);
    const requiredCuts = Math.max(overTotal, overBench);

    if (requiredCuts <= 0) {
      if (cb) cb({ ok: false, reason: 'no_cuts_required' });
      return;
    }

    const normalizeName = (name) => String(name || '').trim().toLowerCase();
    const rosterIds = new Set(
      team.roster
        .map(p => Number(p.id))
        .filter(id => Number.isFinite(id))
    );
    const rosterNames = new Set(
      team.roster
        .map(p => normalizeName(p.name))
        .filter(Boolean)
    );

    const normalizedSelections = hasCutSelections
      ? cutSelections.map(selection => ({
          id: Number(selection && selection.id),
          name: normalizeName(selection && selection.name)
        }))
      : [];

    const validSelectionKeys = hasCutSelections
      ? [...new Set(normalizedSelections
          .filter(selection => (Number.isFinite(selection.id) && rosterIds.has(selection.id)) || (selection.name && rosterNames.has(selection.name)))
          .map(selection => Number.isFinite(selection.id) && rosterIds.has(selection.id)
            ? `id:${selection.id}`
            : `name:${selection.name}`))]
      : [];
    const validCutIds = !hasCutSelections && hasCutIds
      ? [...new Set(cutIds.map(Number))].filter(id => Number.isFinite(id) && rosterIds.has(id))
      : [];
    const validCutNames = !hasCutSelections && hasCutNames
      ? [...new Set(cutNames.map(normalizeName))].filter(name => rosterNames.has(name))
      : [];

    // Count selected players by roster row. When structured selections are provided,
    // prefer id matches and use name fallback only for rows without a valid id.
    const validCutsCount = team.roster.filter(p => {
      const pid = Number(p.id);
      const pname = normalizeName(p.name);
      const cutByStructuredSelection = hasCutSelections
        ? ((Number.isFinite(pid) && validSelectionKeys.includes(`id:${pid}`)) || (!Number.isFinite(pid) && pname && validSelectionKeys.includes(`name:${pname}`)))
        : false;
      const cutById = !hasCutSelections && Number.isFinite(pid) && validCutIds.includes(pid);
      const cutByName = !hasCutSelections && pname && validCutNames.includes(pname);
      const matched = cutByStructuredSelection || cutById || cutByName;
      return matched;
    }).length;

    const debugPayload = {
      teamName,
      requiredCuts,
      requestedSelectionCount: hasCutSelections ? cutSelections.length : Math.max(validCutIds.length, validCutNames.length),
      matchedSelectionCount: validCutsCount,
      rosterSize: team.roster.length,
      benchSize: bench.length,
      benchCutTarget,
      maxTotalPlayers,
      overTotal,
      overBench,
      validSelectionKeys,
      validCutIds,
      validCutNames,
      rosterPlayers: team.roster.map(p => ({ id: p.id, name: p.name, position: p.position }))
    };

    console.log('[cutPlayers] validation debug', JSON.stringify(debugPayload, null, 2));

    if (validCutsCount !== requiredCuts) {
      if (cb) cb({ ok: false, reason: `must_cut_exactly_${requiredCuts}_players`, debug: debugPayload });
      return;
    }

    const removedPlayers = [];
    team.roster = team.roster.filter(p => {
      const pid = Number(p.id);
      const pname = normalizeName(p.name);
      const cutByStructuredSelection = hasCutSelections
        ? ((Number.isFinite(pid) && validSelectionKeys.includes(`id:${pid}`)) || (!Number.isFinite(pid) && pname && validSelectionKeys.includes(`name:${pname}`)))
        : false;
      const cutById = !hasCutSelections && Number.isFinite(pid) && validCutIds.includes(pid);
      const cutByName = !hasCutSelections && pname && validCutNames.includes(pname);
      const shouldCut = cutByStructuredSelection || cutById || cutByName;
      if (shouldCut) removedPlayers.push(p);
      return !shouldCut;
    });

    const allPlayers = draft.draftState && Array.isArray(draft.draftState.allPlayers)
      ? draft.draftState.allPlayers
      : [];

    removedPlayers.forEach((player) => {
      const removedId = Number(player && player.id);
      const removedName = normalizeName(player && player.name);
      const match = allPlayers.find((candidate) => {
        const candidateId = Number(candidate && candidate.id);
        if (Number.isFinite(removedId) && Number.isFinite(candidateId)) {
          return candidateId === removedId;
        }
        return normalizeName(candidate && candidate.name) === removedName;
      });

      if (match) {
        match.owner = null;
        match.shown = false;
        match.bid = 0;
      }
    });

    if (draft.draftState && Array.isArray(draft.draftState.teams)) {
      draft.draftState.teams = teams;
    }
    if (Array.isArray(draft.teams)) {
      draft.teams = teams;
    }

    if (draft.waiverState && draft.waiverState.active) {
      draft.waiverState.pool = buildWaiverPoolFromDraft(draft);
      draft.waiverState.updatedAt = Date.now();
    }

    // Auto-cut CPU teams that still require cuts by removing their lowest-ranked players.
    const autoCutResult = autoCutCpuTeamsForSummary(draft);

    io.to(draftCode).emit('benchUpdated', {
      teamName,
      newRoster: team.roster
    });

    autoCutResult.changedTeamNames
      .filter(name => String(name || '').trim() !== String(teamName || '').trim())
      .forEach((cpuTeamName) => {
        const cpuTeam = autoCutResult.teams.find(t => String(t && t.name || '').trim() === cpuTeamName);
        if (cpuTeam) {
          io.to(draftCode).emit('benchUpdated', {
            teamName: cpuTeamName,
            newRoster: cpuTeam.roster
          });
        }
      });

    if (draft.waiverState) {
      io.to(draftCode).emit('waiverStateUpdated', {
        draftCode,
        waiverState: draft.waiverState,
        teams,
        allPlayersSnapshot: allPlayers
      });
    }

    if (cb) cb({ ok: true, newRoster: team.roster });
  });

  socket.on('startWaivers', (data, cb) => {
    const draftCode = String(data && data.draftCode || '').trim();
    const mode = normalizeWaiverMode(data && data.mode);
    const draft = drafts[draftCode];

    if (!draft) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    const requestUser = socket.data.username;
    const host = String(draft.host || (Array.isArray(draft.members) ? draft.members[0] : '') || '').trim();
    if (host && requestUser !== host) {
      if (cb) cb({ ok: false, reason: 'not_host' });
      return;
    }

    const teams = draft.draftState && Array.isArray(draft.draftState.teams)
      ? draft.draftState.teams
      : (Array.isArray(draft.teams) ? draft.teams : []);

    if (!Array.isArray(teams) || teams.length === 0) {
      if (cb) cb({ ok: false, reason: 'teams_not_found' });
      return;
    }

    logDraftCutDebug(draft, draftCode, 'startWaivers.beforeAutoCut');

    // Ensure CPU teams finish mandatory cuts before waivers can start.
    autoCutCpuTeamsForSummary(draft);

    logDraftCutDebug(draft, draftCode, 'startWaivers.afterAutoCut');

    let order = teams.map(team => String(team && team.name || '').trim()).filter(Boolean);
    if (mode === 'skill') {
      order = teams
        .map(team => ({
          name: String(team && team.name || '').trim(),
          score: getTeamTotalAvScore(team, draft)
        }))
        .sort((a, b) => {
          if (a.score !== b.score) return a.score - b.score;
          return a.name.localeCompare(b.name);
        })
        .map(entry => entry.name)
        .filter(Boolean);
    } else {
      order = shuffleList(order);
    }

    draft.waiverState = {
      active: true,
      completed: false,
      mode,
      order,
      turnIndex: 0,
      turnDurationMs: WAIVER_PICK_TIMER_MS,
      turnStartedAt: Date.now(),
      turnEndsAt: Date.now() + WAIVER_PICK_TIMER_MS,
      pool: buildWaiverPoolFromDraft(draft),
      passesInRow: 0,
      actedTeams: [],
      updatedAt: Date.now(),
      teamActivity: [],
      lastAction: {
        type: 'start',
        by: requestUser || null,
        at: Date.now()
      }
    };

    processCpuWaiverTurns(draftCode, draft);

    const payload = {
      draftCode,
      waiverState: draft.waiverState,
      teams,
      allPlayersSnapshot: (draft.draftState && Array.isArray(draft.draftState.allPlayers)) ? draft.draftState.allPlayers : []
    };

    io.to(draftCode).emit('waiversStarted', payload);
    io.to(draftCode).emit('waiverStateUpdated', payload);
    if (cb) cb({ ok: true, waiverState: draft.waiverState });
  });

  socket.on('submitWaiverMove', (data, cb) => {
    const draftCode = String(data && data.draftCode || '').trim();
    const draft = drafts[draftCode];
    const requestUser = socket.data.username;
    const action = String(data && data.action || '').trim().toLowerCase();

    if (!draft || !draft.waiverState) {
      if (cb) cb({ ok: false, reason: 'waiver_not_available' });
      return;
    }

    const waiverState = draft.waiverState;
    if (!waiverState.active || waiverState.completed) {
      if (cb) cb({ ok: false, reason: 'waiver_not_active' });
      return;
    }

    const teams = draft.draftState && Array.isArray(draft.draftState.teams)
      ? draft.draftState.teams
      : (Array.isArray(draft.teams) ? draft.teams : []);

    if (!Array.isArray(teams) || teams.length === 0) {
      if (cb) cb({ ok: false, reason: 'teams_not_found' });
      return;
    }

    const normalizedRequestUser = String(requestUser || '').trim().toLowerCase();
    const normalizedExpectedTeamName = String(waiverState.order[Math.max(0, Math.min(Number(waiverState.turnIndex || 0), waiverState.order.length - 1))] || '').trim().toLowerCase();
    const expectedTeamName = waiverState.order[Math.max(0, Math.min(Number(waiverState.turnIndex || 0), waiverState.order.length - 1))];
    const requestMatchesTurn = normalizedRequestUser && normalizedExpectedTeamName && normalizedRequestUser === normalizedExpectedTeamName;

    if (!expectedTeamName || !requestMatchesTurn) {
      if (cb) cb({ ok: false, reason: 'not_your_turn' });
      return;
    }

    const team = teams.find(t => String(t && t.name || '').trim() === expectedTeamName);
    if (!team || !Array.isArray(team.roster)) {
      if (cb) cb({ ok: false, reason: 'team_not_found' });
      return;
    }

    if (action === 'pass') {
      markWaiverTeamActed(waiverState, expectedTeamName);
      markWaiverTeamActed(waiverState, expectedTeamName);
      waiverState.passesInRow = Number(waiverState.passesInRow || 0) + 1;
      waiverState.lastAction = {
        type: 'pass',
        by: expectedTeamName,
        at: Date.now()
      };
      recordWaiverTeamActivity(waiverState, expectedTeamName, {
        type: 'pass',
        at: Date.now()
      });
      advanceWaiverTurn(waiverState, draft);
    } else if (action === 'adddrop') {
      const addPlayerId = Number(data && data.addPlayerId);
      const dropPlayerId = Number(data && data.dropPlayerId);
      if (!Number.isFinite(addPlayerId) || !Number.isFinite(dropPlayerId)) {
        if (cb) cb({ ok: false, reason: 'invalid_player_selection' });
        return;
      }

      const applied = applyWaiverAddDropForTeam(draft, team, expectedTeamName, addPlayerId, dropPlayerId);
      if (!applied.ok) {
        if (cb) cb({ ok: false, reason: applied.reason || 'unable_to_apply_move' });
        return;
      }

      markWaiverTeamActed(waiverState, expectedTeamName);
      waiverState.passesInRow = 0;
      waiverState.lastAction = {
        type: 'addDrop',
        by: expectedTeamName,
        addPlayerId,
        dropPlayerId,
        addPlayerName: String(applied.addPlayerName || '').trim(),
        addPlayerPosition: String(applied.addPlayerPosition || '').trim().toUpperCase(),
        dropPlayerName: String(applied.dropPlayerName || '').trim(),
        dropPlayerPosition: String(applied.dropPlayerPosition || '').trim().toUpperCase(),
        at: Date.now()
      };
      recordWaiverTeamActivity(waiverState, expectedTeamName, {
        type: 'addDrop',
        addPlayerName: String(applied.addPlayerName || '').trim(),
        addPlayerPosition: String(applied.addPlayerPosition || '').trim().toUpperCase(),
        dropPlayerName: String(applied.dropPlayerName || '').trim(),
        dropPlayerPosition: String(applied.dropPlayerPosition || '').trim().toUpperCase(),
        at: Date.now()
      });
      advanceWaiverTurn(waiverState, draft);
    } else {
      if (cb) cb({ ok: false, reason: 'invalid_action' });
      return;
    }

    finalizeWaiverStateProgress(draft, waiverState);
    processCpuWaiverTurns(draftCode, draft);

    if (draft.draftState && Array.isArray(draft.draftState.teams)) {
      draft.draftState.teams = teams;
    }
    if (Array.isArray(draft.teams)) {
      draft.teams = teams;
    }

    const payload = {
      draftCode,
      waiverState,
      teams,
      allPlayersSnapshot: (draft.draftState && Array.isArray(draft.draftState.allPlayers)) ? draft.draftState.allPlayers : []
    };

    io.to(draftCode).emit('waiverStateUpdated', payload);
    if (cb) cb({ ok: true, waiverState });
  });

  // handle socket disconnect: don't remove from members or close draft
  // (user might just be refreshing or having connection issues)
  socket.on('disconnect', () => {
    // Just log the disconnect, don't modify draft state
    const username = socket.data.username;
    const code = socket.data.currentDraft;
    if(username && code){
      console.log(`[disconnect] ${username} disconnected from ${code}`);
    }

    // Clear auto-draft status on disconnect for active draft room participants.
    const activeCode = socket.data.activeDraftCode;
    if (username && activeCode && drafts[activeCode] && drafts[activeCode].draftState) {
      if (!drafts[activeCode].draftState.autoDraftStatus) {
        drafts[activeCode].draftState.autoDraftStatus = {};
      }
      drafts[activeCode].draftState.autoDraftStatus[username] = false;
      io.to(`draft_${activeCode}`).emit('autoDraftStatusChanged', {
        username,
        enabled: false,
        statuses: drafts[activeCode].draftState.autoDraftStatus
      });
    }
  });
});

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
