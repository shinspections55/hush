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
const { logAuctionResult, logIndividualBid, bulkLogIndividualBids, getPlayerAV, getPlayerAuctionCount, closeDatabase } = require('./database');

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
  }).map(({ _sourceIndex, _positionRank, rank, draftChance, img, ...player }) => player);

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
    res.status(502).json({
      ok: false,
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
  }
});

// In-memory map of drafts for real-time sync. This mirrors client localStorage but is ephemeral.
const drafts = {};

// Current draft ID for database logging
let currentDraftId = null;

// ==================== AUCTION LOGIC FUNCTIONS ====================

// Helper function: Check if player can be added to roster
function isValidRosterAddition(team, player, rosterLimits) {
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
    const results = [];
    const tiedBids = [];
    const allIndividualBids = []; // Collect all bids for bulk database operations

    console.log(`[processAuctions] Processing ${roundPlayers.length} players`);
    console.log(`[processAuctions] User bids:`, JSON.stringify(userBids));
    console.log(`[processAuctions] CPU teams with bids:`, Object.keys(cpuBids));
    
    // Log which players have user bids
    const playersWithUserBids = Object.keys(userBids).filter(playerId => 
      Object.keys(userBids[playerId]).length > 0
    );
    console.log(`[processAuctions] Players with user bids: ${playersWithUserBids.length} out of ${roundPlayers.length}`);
    playersWithUserBids.forEach(playerId => {
      const player = roundPlayers.find(p => p.id == playerId);
      const bidTeams = Object.keys(userBids[playerId]);
      console.log(`[processAuctions] ${player ? player.name : 'Unknown player'} (${playerId}): bids from ${bidTeams.join(', ')}`);
    });

  roundPlayers.forEach(player => {
    const bids = [];
    
    // Collect user bids from draftState.bids
    Object.keys(userBids[player.id] || {}).forEach(teamName => {
      const team = teams.find(t => t.name === teamName);
      const bidAmount = userBids[player.id][teamName];
      if (team && bidAmount > 0 && bidAmount <= team.budget) {
        bids.push({ team, amount: bidAmount });
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
      if (cpuBidObj && cpuTeam && cpuBidObj.cpuBid <= cpuTeam.budget) {
        bids.push({ team: cpuTeam, amount: cpuBidObj.cpuBid });
        // Collect for bulk logging instead of individual logging
        allIndividualBids.push({
          draftId: currentDraftId || 'default_draft',
          roundNumber,
          player,
          bidderTeam: cpuName,
          bidAmount: cpuBidObj.cpuBid,
          isWinning: false,
          isSecondHighest: false
        });
        console.log(`[processAuctions] ${player.name}: CPU bid from ${cpuName} = $${cpuBidObj.cpuBid}`);
      }
    });

    console.log(`[processAuctions] ${player.name}: Total bids = ${bids.length}`);

    // Create allBids array with ALL teams (including those who bid $0)
    const allTeamsBids = teams.map(team => {
      // Check if this team bid on this player
      const bidEntry = bids.find(b => b.team.name === team.name);
      return {
        teamName: team.name,
        amount: bidEntry ? bidEntry.amount : 0
      };
    });

    const maxBid = Math.max(...bids.map(b => b.amount), 0);
    const topBidders = bids.filter(b => b.amount === maxBid);

    if (topBidders.length === 1 && maxBid > 0) {
      const winner = topBidders[0].team;
      const secondHighestBid = bids.length > 1 ? Math.max(...bids.filter(b => b.amount < maxBid).map(b => b.amount), 0) : 0;
      const secondHighestBidder = bids.length > 1 ? bids.filter(b => b.amount === secondHighestBid)[0]?.team.name : null;
      const pricePaid = Math.max(secondHighestBid + 1, 1);
      
      // Ensure winner can afford the price (prevent negative budget)
      const finalPrice = Math.min(pricePaid, winner.budget);
      
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
      const player = roundPlayers.find(p => p.id === result.playerId);
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

  console.log(`[processAuctions] Completed processing ${results.length} results, ${tiedBids.length} tied bids`);
  return { results, tiedBids };
  } catch (error) {
    console.error('[processAuctions] CRITICAL ERROR processing auctions:', error);
    console.error(error.stack);
    
    // Return empty results on error to prevent server crash
    return { results: [], tiedBids: [] };
  }
}

// ==================== SOCKET.IO HANDLERS ====================

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
    // merge only non-members fields (type, capacity, public, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder)
    drafts[code] = drafts[code] || { members: [], type: null, capacity: null, public: false };
    const allowed = (({ type, capacity, public: pub, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder }) => ({ type, capacity, public: pub, draftOrder, draftOrderAssignments, customBudgets, rosterSettings, benchCutTarget, roundTimerMinutes, ajDraftMode, ajRoundOrder }))(state || {});
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
    // Verify the requester is the host (first member)
    if(drafts[code] && drafts[code].members && drafts[code].members[0] === socket.data.username){
      if (typeof roundTimerMinutes !== 'undefined') {
        drafts[code].roundTimerMinutes = roundTimerMinutes;
      }
      console.log(`[startDraft] ${code} resolved roundTimerMinutes=${drafts[code].roundTimerMinutes}`);
      // Mark draft as started and store the draft type
      drafts[code].started = true;
      drafts[code].type = draftType;
      drafts[code].startedAt = Date.now();
      
      // Get all sockets in this room
      const roomSockets = io.sockets.adapter.rooms.get(code);
      console.log(`[startDraft] Broadcasting to ${roomSockets ? roomSockets.size : 0} sockets in room ${code}`);
      console.log(`[startDraft] Members in draft: ${drafts[code].members.join(', ')}`);
      
      // Broadcast to all members in the room (including host)
      io.to(code).emit('draftStarted', draftType);
      console.log(`[startDraft] Broadcast sent`);
      if(cb) cb({ ok: true });
    } else {
      console.log(`[startDraft] denied - ${socket.data.username} is not the host`);
      if(cb) cb({ ok: false, reason: 'not_host' });
    }
  });

  // Get current draft state from server (for draft page to load)
  socket.on('getDraftState', (code, cb) => {
    console.log(`[getDraftState] ${code} requested by ${socket.data.username}`);
    if(drafts[code]){
      if (!drafts[code].host && drafts[code].members && drafts[code].members.length > 0) {
        drafts[code].host = drafts[code].members[0];
      }
      console.log(`[getDraftState] ${code} host=${drafts[code].host || drafts[code].members?.[0] || 'unknown'} members=${(drafts[code].members || []).join(', ')}`);
      if(cb) cb({ ok: true, draft: drafts[code] });
    } else {
      if(cb) cb({ ok: false, reason: 'not_found' });
    }
  });

  // Join the active draft room for real-time bidding
  socket.on('joinActiveDraft', (code, username) => {
    socket.join(`draft_${code}`);
    socket.data.activeDraftCode = code;
    socket.data.username = username;
    console.log(`[joinActiveDraft] ${username} joined active draft ${code}`);
    
    const roundTimerMinutes = Number.isFinite(Number.parseInt(drafts[code] && drafts[code].roundTimerMinutes, 10))
      ? Math.max(3, Math.min(Number.parseInt(drafts[code].roundTimerMinutes, 10), 10))
      : 10;

    // Initialize draft state if not exists
    if(!drafts[code].draftState) {
      drafts[code].draftState = {
        currentRound: 1,
        roundTimer: roundTimerMinutes * 60,
        roundTimerMinutes,
        currentPlayers: [], // The 10 players for the current round
        completedRounds: [],
        bids: {}, // playerId: { teamName: bidAmount }
        autoDraftStatus: {}, // teamName: boolean
        chatMessages: []
      };
    } else {
      drafts[code].draftState.roundTimer = roundTimerMinutes * 60;
      drafts[code].draftState.roundTimerMinutes = roundTimerMinutes;
    }

    if (!drafts[code].draftState.autoDraftStatus) {
      drafts[code].draftState.autoDraftStatus = {};
    }

    if (!Array.isArray(drafts[code].draftState.chatMessages)) {
      drafts[code].draftState.chatMessages = [];
    }

    // Default each joining user to OFF until they explicitly toggle ON.
    if (typeof drafts[code].draftState.autoDraftStatus[username] === 'undefined') {
      drafts[code].draftState.autoDraftStatus[username] = false;
    }
    
    // Send current draft state to the joining player
    socket.emit('draftStateSync', drafts[code].draftState);

    // Also sync current auto-draft statuses for UI badges.
    socket.emit('autoDraftStatusSync', drafts[code].draftState.autoDraftStatus);
  });

  // Update and broadcast auto-draft toggle status for a team/user.
  socket.on('setAutoDraftStatus', (code, username, enabled, cb) => {
    if (!drafts[code] || !drafts[code].draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    if (!drafts[code].draftState.autoDraftStatus) {
      drafts[code].draftState.autoDraftStatus = {};
    }

    const requestUser = socket.data.username;
    if (!requestUser || requestUser !== username) {
      if (cb) cb({ ok: false, reason: 'unauthorized' });
      return;
    }

    drafts[code].draftState.autoDraftStatus[username] = !!enabled;

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

  socket.on('sendDraftChatMessage', (code, text, cb) => {
    const draft = drafts[code];
    const username = socket.data.username;

    if (!draft || !draft.draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_found' });
      return;
    }

    if (!username || !Array.isArray(draft.members) || !draft.members.includes(username)) {
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
      username,
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

  // Place a bid on a player
  socket.on('placeBid', (code, playerId, bidAmount, cb) => {
    const username = socket.data.username;
    const draft = drafts[code];
    if (!draft || !draft.draftState || !draft.draftState.bids) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    const safePlayerId = Number(playerId);
    const numericBid = Number(bidAmount);
    const safeBid = Number.isFinite(numericBid) && numericBid > 0 ? Math.floor(numericBid) : 0;

    console.log(`[placeBid] ${username} bid $${safeBid} on player ${safePlayerId} in draft ${code}`);

    if (!draft.draftState.bids[safePlayerId]) {
      draft.draftState.bids[safePlayerId] = {};
    }

    if (safeBid > 0) {
      draft.draftState.bids[safePlayerId][username] = safeBid;
    } else {
      // Clearing a bid must remove old server-side values to avoid phantom bids.
      delete draft.draftState.bids[safePlayerId][username];
      if (Object.keys(draft.draftState.bids[safePlayerId]).length === 0) {
        delete draft.draftState.bids[safePlayerId];
      }
    }
    
    // Broadcast bid to all members in the draft
    io.to(`draft_${code}`).emit('bidUpdate', { playerId: safePlayerId, username, bidAmount: safeBid });
    
    if(cb) cb({ ok: true });
  });

  // User has submitted their bids for the round
  socket.on('submitBids', (code, username, autoDraftEnabledOrCb, cbMaybe) => {
    const autoDraftEnabled = typeof autoDraftEnabledOrCb === 'boolean' ? autoDraftEnabledOrCb : undefined;
    const cb = typeof autoDraftEnabledOrCb === 'function' ? autoDraftEnabledOrCb : cbMaybe;
    console.log(`[submitBids] ${username} submitted bids in ${code}`);

    if (!drafts[code] || !drafts[code].draftState) {
      if (cb) cb({ ok: false, reason: 'draft_not_ready' });
      return;
    }

    if (!drafts[code].draftState.autoDraftStatus) {
      drafts[code].draftState.autoDraftStatus = {};
    }

    // Keep server authority aligned with the client's current toggle at submit time.
    if (typeof autoDraftEnabled === 'boolean') {
      drafts[code].draftState.autoDraftStatus[username] = autoDraftEnabled;
    }
    
    if(!drafts[code].draftState.submittedMembers) {
      drafts[code].draftState.submittedMembers = [];
    }
    
    // Track this member's submission
    if(!drafts[code].draftState.submittedMembers.includes(username)) {
      drafts[code].draftState.submittedMembers.push(username);
    }
    
    // Broadcast to all other members in the draft room (not the sender)
    socket.to(`draft_${code}`).emit('bidsSubmitted', { username });
    
    // Only members with auto-draft OFF are required to submit manually.
    const allMembers = drafts[code].members || [];
    const autoDraftStatus = drafts[code].draftState.autoDraftStatus || {};
    const requiredManualMembers = allMembers.filter(member => !autoDraftStatus[member]);
    const submittedCount = drafts[code].draftState.submittedMembers.filter(member => requiredManualMembers.includes(member)).length;
    console.log('[submitBids][debug] submittedMembers:', drafts[code].draftState.submittedMembers);
    console.log('[submitBids][debug] requiredManualMembers:', requiredManualMembers);
    console.log('[submitBids][debug] current bids snapshot:', JSON.stringify(drafts[code].draftState.bids || {}, null, 2));
    
    console.log(`[submitBids] ${submittedCount}/${requiredManualMembers.length} manual members have submitted`);
    
    if(submittedCount >= requiredManualMembers.length) {
      console.log(`[submitBids] All members submitted - triggering round processing`);
      // All members have submitted, trigger round processing
      io.to(`draft_${code}`).emit('allBidsSubmitted');
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

    const { roundPlayers, teams, rosterSize, rosterLimits, flexPositions, allPlayers } = roundData;
    const draftState = drafts[code].draftState;
    
    // Store teams, allPlayers and rosterLimits for live auction use
    draftState.teams = teams;
    draftState.allPlayers = allPlayers;
    draftState.rosterLimits = rosterLimits;
    
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

    // Remove stale manual bids for teams currently controlled by auto-draft.
    const autoDraftMembers = allMembers.filter(member => autoDraftStatus[member]);
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
    const cpuBidsPromise = generateServerCPUBids(teams, roundPlayers, allPlayers, rosterSize, rosterLimits, humanMembers, draftState.currentRound);
    
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
    
    console.log(`[processRound] Processing round ${draftState.currentRound} with:`);
    console.log(`[processRound] - ${roundPlayers.length} players in round`);
    console.log(`[processRound] - ${humanMembers.length} human members: ${humanMembers.join(', ')}`);
    console.log(`[processRound] - CPU bids generated for ${Object.keys(cpuBids).length} teams`);
    console.log(`[processRound] - User bids available:`, JSON.stringify(sanitizedUserBids, null, 2));
    
    try {
      // Process each player's auction
      const auctionResults = await processAuctions(roundPlayers, teams, cpuBids, sanitizedUserBids, rosterLimits, flexPositions, rosterSize, draftState.currentRound);
      
      // Store complete results (including tiedBids) for auction processing
      draftState.lastRoundResults = auctionResults;
      
      // Broadcast results array to all members (they expect the results array)
      io.to(`draft_${code}`).emit('roundResults', auctionResults.results);
      console.log(`[processRound] Emitted roundResults to room draft_${code}:`, auctionResults.results.length, 'results');
      
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
    console.log(`[acceptRoundResults] ${username} accepted results in ${code}`);
    
    if(!drafts[code].draftState.acceptedMembers) {
      drafts[code].draftState.acceptedMembers = [];
    }
    
    // Track this member's acceptance
    if(!drafts[code].draftState.acceptedMembers.includes(username)) {
      drafts[code].draftState.acceptedMembers.push(username);
    }
    
    // Only count human members (non-CPU) for acceptance tracking
    const humanMembers = drafts[code].members || [];
    const acceptedCount = drafts[code].draftState.acceptedMembers.length;
    
    console.log(`[acceptRoundResults] ${acceptedCount}/${humanMembers.length} human members have accepted`);
    
    // Broadcast acceptance status
    const remaining = humanMembers.length - acceptedCount;
    io.to(`draft_${code}`).emit('memberAcceptedResults', {
      username,
      acceptedCount,
      totalMembers: humanMembers.length,
      message: remaining > 0 ? `Waiting for ${remaining} more member(s) to accept...` : 'All members accepted!'
    });
    
    // Check if all human members have accepted (CPU teams don't need to accept)
    if(acceptedCount >= humanMembers.length) {
      console.log(`[acceptRoundResults] All ${humanMembers.length} human members accepted - advancing to next round`);
      
      // Store tied bids from last round results for automatic auction processing
      const lastResults = drafts[code].draftState.lastRoundResults;
      console.log(`[acceptRoundResults] lastResults structure:`, JSON.stringify(lastResults, null, 2));
      
      // Always emit allMembersAccepted to close the results modal
      // (auctions will be handled separately via liveAuctionStarted event)
      io.to(`draft_${code}`).emit('allMembersAccepted');
      
      if (lastResults && lastResults.tiedBids && lastResults.tiedBids.length > 0) {
        console.log(`[acceptRoundResults] Found ${lastResults.tiedBids.length} tied bids, will start auctions automatically`);
        try {
          drafts[code].draftState.pendingAuctions = [...lastResults.tiedBids];
          
          // Start the first auction immediately
          const firstTie = drafts[code].draftState.pendingAuctions.shift();
          console.log(`[acceptRoundResults] Starting first auction for:`, firstTie);
          startServerLiveAuction(code, firstTie);
        } catch (err) {
          console.error(`[acceptRoundResults] ERROR starting auction:`, err);
          console.error(err.stack);
        }
      } else {
        console.log(`[acceptRoundResults] No tied bids detected, proceeding to next round`);
      }
      
      // Reset tracking for next round
      drafts[code].draftState.acceptedMembers = [];
      drafts[code].draftState.submittedMembers = [];
      drafts[code].draftState.isProcessingRound = false; // Reset round processing flag
    }
    
    if(cb) cb({ ok: true });
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
            console.log(`[TIE BREAKER] ${remainingAfterBackout.length} CPUs still tied, forcing +$1 bid`);
            const aggressor = pickRandomCPU(remainingAfterBackout);
            placeForcedBid(code, auctionId, aggressor, auction.currentBid + 1, drafts, io);
            return;
          }

          // Case 3: all backed out (rare) → randomly assign
          if (remainingAfterBackout.length === 0) {
            console.log(`[TIE BREAKER] All CPUs backed out, randomly assigning`);
            const randomWinner = pickRandomCPU(cpuRemaining);
            completeLiveAuction(code, auctionId);
            return;
          }
        }
      }
      
      // CPU AI bidding - use clean tied auction module
      if (auction.timer > 0 && auction.timer % 2 === 0) {
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
              needs: { [position]: positionNeed },
              aggression: 0 // Will be calculated by module
            };
          });

          // Run the clean auction round
          const result = runTiedAuctionRound({
            cpus,
            currentBid: auction.currentBid,
            playerAV: player?.avgValue || auction.playerAvgValue || 1,
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
      
      // Determine winner
      const remainingTeams = auction.tiedTeams.filter(t => !auction.backedOutTeams.includes(t));
      let winner = auction.currentWinner;
      let winningBid = auction.currentBid;
      
      if (remainingTeams.length === 0) {
        // Everyone backed out - pick random from original
        winner = auction.tiedTeams[Math.floor(Math.random() * auction.tiedTeams.length)];
        winningBid = auction.startBid || auction.currentBid;
      } else if (!winner || auction.backedOutTeams.includes(winner)) {
        // Winner backed out or no one raised bid - pick random from remaining
        winner = remainingTeams[Math.floor(Math.random() * remainingTeams.length)];
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
      io.to(`draft_${code}`).emit('liveAuctionEnded', {
        auctionId,
        winner,
        finalBid: winningBid,
        playerId: auction.playerId,
        playerName: auction.playerName
      });
      
        // Check if there are more pending auctions
      if (drafts[code] && drafts[code].draftState && drafts[code].draftState.pendingAuctions && drafts[code].draftState.pendingAuctions.length > 0) {
        console.log(`[completeLiveAuction] ${drafts[code].draftState.pendingAuctions.length} more auctions pending, starting next in 2 seconds...`);
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
        }, 2000);
      } else {
        console.log(`[completeLiveAuction] No more auctions, waiting 6 seconds then emitting allMembersAccepted to draft_${code}`);
        // Wait for winner display to show (5 seconds) plus 1 second buffer before starting next round
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
    
    if (!auction.tiedTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }
    
    if (auction.backedOutTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'backed_out' });
      return;
    }
    
    if (bidAmount <= auction.currentBid) {
      if (cb) cb({ ok: false, reason: 'bid_too_low' });
      return;
    }
    
    // Check if team has enough budget
    const team = drafts[code].draftState.teams?.find(t => t.name === username);
    if (team && bidAmount > team.budget) {
      console.log(`[placeLiveAuctionBid] ${username} can't afford $${bidAmount} (budget: $${team.budget})`);
      if (cb) cb({ ok: false, reason: 'insufficient_budget' });
      return;
    }
    
    // Update auction
    auction.currentBid = bidAmount;
    auction.currentWinner = username;
    auction.bids[username] = bidAmount;
    auction.timer = 10; // Reset timer
    
    // Broadcast bid
    io.to(`draft_${code}`).emit('liveAuctionBidPlaced', {
      auctionId,
      bidder: username,
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
    
    if (!auction.tiedTeams.includes(username)) {
      if (cb) cb({ ok: false, reason: 'not_in_auction' });
      return;
    }
    
    auction.backedOutTeams.push(username);
    
    // Broadcast backout
    io.to(`draft_${code}`).emit('liveAuctionBackout', {
      auctionId,
      teamName: username
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

    const DEFAULT_ROSTER_SETTINGS = { QB: 1, WR: 2, RB: 2, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 13 };
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

    team.roster = team.roster.filter(p => {
      const pid = Number(p.id);
      const pname = normalizeName(p.name);
      const cutByStructuredSelection = hasCutSelections
        ? ((Number.isFinite(pid) && validSelectionKeys.includes(`id:${pid}`)) || (!Number.isFinite(pid) && pname && validSelectionKeys.includes(`name:${pname}`)))
        : false;
      const cutById = !hasCutSelections && Number.isFinite(pid) && validCutIds.includes(pid);
      const cutByName = !hasCutSelections && pname && validCutNames.includes(pname);
      return !(cutByStructuredSelection || cutById || cutByName);
    });

    if (draft.draftState && Array.isArray(draft.draftState.teams)) {
      draft.draftState.teams = teams;
    }
    if (Array.isArray(draft.teams)) {
      draft.teams = teams;
    }

    io.to(draftCode).emit('benchUpdated', {
      teamName,
      newRoster: team.roster
    });

    if (cb) cb({ ok: true, newRoster: team.roster });
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
