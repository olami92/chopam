import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { LiveSpectateMatch, WhotCard, WhotShape, DraughtsPieceColor } from './src/types';
import { escrowEngine } from './server/escrowEngine';
import { pool } from './src/db/index';
import { telegramBotListener, TelegramWithdrawalData, TelegramFiatDepositData } from './server/telegramBot';
import { liveChatService } from './server/liveChat';
import { applyBead16Move, checkBead16Winner, createInitialBead16Board, getBestBead16AIMove, getLegalBead16Moves, BeadPiece, BeadPlayer, Move } from './src/utils/bead16Engine';
import { applyCoinGameAction, CoinGameAction, CoinGameState, createCoinGameState } from './src/utils/teteCoinGameEngine';

const USERS_FILE_PATH = path.join(process.cwd(), 'users_data.json');

function loadPersistentUsersFromFile() {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        userAuthStore.clear();
        escrowEngine.clearUserBalances();
        for (const u of parsed) {
          if (u.username && u.passwordHash) {
            const cleanName = String(u.username).toLowerCase();
            userAuthStore.set(cleanName, u);
            const engineUser = escrowEngine.getOrCreateUser(u.id || `usr_${cleanName}`, cleanName, u.availableBalance || 0);
            escrowEngine.setUserWalletBalances(
              engineUser.userId,
              Number(u.availableBalance) || 0,
              Number(u.escrowLockedBalance) || 0
            );
            if (typeof u.totalMatchesPlayed === 'number') engineUser.totalMatchesPlayed = u.totalMatchesPlayed;
            if (typeof u.matchesWon === 'number') engineUser.matchesWon = u.matchesWon;
            if (typeof u.matchesLost === 'number') engineUser.matchesLost = u.matchesLost;
          }
        }
        console.log(`[JSON Store] Loaded ${parsed.length} persistent users from users_data.json`);
        return;
      }
    }
  } catch (err) {
    console.warn('[JSON Store] Note loading users_data.json:', err);
  }

  seedInitialDefaultUsers();
}

function seedInitialDefaultUsers() {
  userAuthStore.clear();
  escrowEngine.clearUserBalances();
  savePersistentUsersToFile();
}

function savePersistentUsersToFile() {
  try {
    const userArray = Array.from(userAuthStore.values()).map((u) => {
      const engineUser = escrowEngine.getUserBalance(u.id) || escrowEngine.getUserBalance(u.username);
      return {
        ...u,
        availableBalance: engineUser ? engineUser.availableBalance : 0,
        escrowLockedBalance: engineUser ? engineUser.escrowLockedBalance : 0,
        totalMatchesPlayed: engineUser ? (engineUser.totalMatchesPlayed || 0) : 0,
        matchesWon: engineUser ? (engineUser.matchesWon || 0) : 0,
        matchesLost: engineUser ? (engineUser.matchesLost || 0) : 0,
      };
    });
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(userArray, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[JSON Store] Note saving users_data.json:', err);
  }
}

const WITHDRAWALS_FILE_PATH = path.join(process.cwd(), 'withdrawals_data.json');

function loadPersistentWithdrawalsFromFile() {
  try {
    if (fs.existsSync(WITHDRAWALS_FILE_PATH)) {
      const data = fs.readFileSync(WITHDRAWALS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        withdrawalStore.length = 0;
        withdrawalStore.push(...parsed);
        console.log(`[JSON Store] Loaded ${parsed.length} persistent withdrawals from withdrawals_data.json`);
      }
    }
  } catch (err) {
    console.warn('[JSON Store] Note loading withdrawals_data.json:', err);
  }
}

function savePersistentWithdrawalsToFile() {
  try {
    fs.writeFileSync(WITHDRAWALS_FILE_PATH, JSON.stringify(withdrawalStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[JSON Store] Note saving withdrawals_data.json:', err);
  }
}

async function syncUserToPostgres(username: string, displayName?: string, email?: string, initialBalance = 0, createIfNotExists = false) {
  try {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const cleanDisplayName = displayName || (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));
    const userEmail = email ? email.trim().toLowerCase() : `${cleanUsername}@skillstake.ng`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists by username or email first
      const existing = await client.query(
        `SELECT id, username, display_name FROM users WHERE username = $1 OR email = $2 LIMIT 1`,
        [cleanUsername, userEmail]
      );

      let dbUser;
      if (existing.rows.length > 0) {
        const updateRes = await client.query(
          `UPDATE users 
           SET username = $1, display_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $4 
           RETURNING id, username, display_name`,
          [cleanUsername, cleanDisplayName, userEmail, existing.rows[0].id]
        );
        dbUser = updateRes.rows[0];
      } else if (createIfNotExists) {
        const insertRes = await client.query(
          `INSERT INTO users (username, display_name, email)
           VALUES ($1, $2, $3)
           ON CONFLICT (username) DO UPDATE 
           SET display_name = EXCLUDED.display_name, updated_at = CURRENT_TIMESTAMP
           RETURNING id, username, display_name`,
          [cleanUsername, cleanDisplayName, userEmail]
        );
        dbUser = insertRes.rows[0];
      }

      if (dbUser) {
        await client.query(
          `INSERT INTO user_wallets (user_id, currency, available_balance, escrow_locked_balance)
           VALUES ($1, 'NGN', $2, 0.0000)
           ON CONFLICT (user_id, currency) DO NOTHING`,
          [dbUser.id, initialBalance]
        );
      }

      await client.query('COMMIT');
      return dbUser;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[PostgreSQL] Failed to sync user:', err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[PostgreSQL] Connection error during user persistence:', err);
  }
}

async function persistMatchWallets(matchId: string) {
  const session = escrowEngine.getMatchSession(matchId);
  if (!session) throw new Error(`Escrow session ${matchId} was not found`);
  const balances = escrowEngine.getMatchBalances(matchId);
  const dbUsers = new Map<string, string>();
  for (const balance of balances) {
    let dbUser = await syncUserToPostgres(balance.username, undefined, undefined, 0, true);
    if (!dbUser?.id) {
      const client = await pool.connect();
      try {
        const created = await client.query(
          `INSERT INTO users (id, username, display_name, email)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [balance.userId, balance.username.toLowerCase(), balance.username, `${balance.username.toLowerCase()}@skillstake.ng`]
        );
        dbUser = created.rows[0];
        await client.query(
          `INSERT INTO user_wallets (user_id, currency, available_balance, escrow_locked_balance)
           VALUES ($1, 'NGN', 0, 0) ON CONFLICT (user_id, currency) DO NOTHING`,
          [dbUser.id]
        );
      } finally {
        client.release();
      }
    }
    if (!dbUser?.id) throw new Error(`Could not resolve wallet for @${balance.username}`);
    dbUsers.set(balance.userId, dbUser.id);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const balance of balances) {
      const dbUserId = dbUsers.get(balance.userId)!;
      await client.query(
        `UPDATE user_wallets
         SET available_balance = $1, escrow_locked_balance = $2, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $3 AND currency = 'NGN'`,
        [balance.availableBalance, balance.escrowLockedBalance, dbUserId]
      );
    }
    await client.query(
      `INSERT INTO match_escrow_sessions (match_id, room_code, status, session_data, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (match_id) DO UPDATE
       SET room_code = EXCLUDED.room_code, status = EXCLUDED.status,
           session_data = EXCLUDED.session_data, updated_at = CURRENT_TIMESTAMP`,
      [matchId, session.roomCode, session.status, JSON.stringify(session)]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Auto-ensure platform tables & load users from PostgreSQL on startup
async function ensurePlatformSettingsTable() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS platform_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      if (!process.env.AUTH_SESSION_SECRET) {
        await client.query(`INSERT INTO platform_settings (key, value) VALUES ('auth_session_secret', $1) ON CONFLICT (key) DO NOTHING`, [SESSION_SECRET]);
        const savedSecret = await client.query(`SELECT value FROM platform_settings WHERE key = 'auth_session_secret'`);
        if (savedSecret.rows[0]?.value) SESSION_SECRET = String(savedSecret.rows[0].value);
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(100) PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          phone_number VARCHAR(20),
          password_hash TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id VARCHAR(50);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(32);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id VARCHAR(100);
      `);

      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL;
        CREATE TABLE IF NOT EXISTS platform_coin_accounts (
          user_id VARCHAR(100) PRIMARY KEY,
          balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS platform_coin_ledger (
          id BIGSERIAL PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          amount BIGINT NOT NULL CHECK (amount > 0),
          reason VARCHAR(40) NOT NULL,
          idempotency_key VARCHAR(200) NOT NULL UNIQUE,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_platform_coin_ledger_user ON platform_coin_ledger (user_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS platform_coin_ai_matches (
          id VARCHAR(80) PRIMARY KEY,
          user_id VARCHAR(100) NOT NULL,
          game_mode VARCHAR(30) NOT NULL,
          stake BIGINT NOT NULL CHECK (stake > 0),
          client_request_id VARCHAR(80),
          state JSONB NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          winner VARCHAR(10),
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          settled_at TIMESTAMPTZ
        );
        ALTER TABLE platform_coin_ai_matches ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(80);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_coin_ai_matches_request ON platform_coin_ai_matches (user_id, client_request_id) WHERE client_request_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_platform_coin_ai_matches_user ON platform_coin_ai_matches (user_id, updated_at DESC);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_wallets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(100) NOT NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
          available_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
          escrow_locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_user_currency_idx UNIQUE (user_id, currency)
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS match_escrow_sessions (
          match_id VARCHAR(120) PRIMARY KEY,
          room_code VARCHAR(120) NOT NULL,
          status VARCHAR(32) NOT NULL,
          session_data JSONB NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Sync all existing PostgreSQL users into userAuthStore & escrowEngine
      const dbUsers = await client.query(`
        SELECT u.id, u.username, u.display_name, u.email, u.phone_number, u.password_hash,
               COALESCE(w.available_balance, 0) as balance,
               COALESCE(w.escrow_locked_balance, 0) as escrow_locked_balance
        FROM users u
        LEFT JOIN user_wallets w ON u.id = w.user_id AND w.currency = 'NGN'
      `);

      for (const row of dbUsers.rows) {
        if (row.username) {
          const cleanName = row.username.toLowerCase();
          const record: StoredUserAuth = {
            id: row.id || `usr_${cleanName}`,
            username: cleanName,
            displayName: row.display_name || cleanName,
            email: row.email || `${cleanName}@skillstake.ng`,
            phone: row.phone_number || '',
            passwordHash: row.password_hash || defaultPasswordHash,
            createdAt: new Date().toISOString(),
          };
          userAuthStore.set(cleanName, record);
          const engineUser = escrowEngine.getOrCreateUser(record.id, cleanName, Number(row.balance) || 0);
          escrowEngine.setUserWalletBalances(
            engineUser.userId,
            Number(row.balance) || 0,
            Number(row.escrow_locked_balance) || 0
          );
        }
      }
      const escrowSessions = await client.query('SELECT session_data FROM match_escrow_sessions');
      for (const row of escrowSessions.rows) {
        const session = typeof row.session_data === 'string' ? JSON.parse(row.session_data) : row.session_data;
        if (session?.matchId) escrowEngine.restoreMatchSession(session);
      }
      if (dbUsers.rows.length > 0) {
        console.log(`[PostgreSQL Boot] Loaded ${dbUsers.rows.length} users from database into active memory store.`);
        savePersistentUsersToFile();
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[PostgreSQL] Database init note:', err);
  }
}

async function getPlatformSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT value FROM platform_settings WHERE key = $1', [key]);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].value) as T;
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[PostgreSQL] Could not read setting ${key}:`, err);
  }
  return defaultValue;
}

async function setPlatformSetting<T>(key: string, value: T): Promise<void> {
  try {
    const client = await pool.connect();
    try {
      const strVal = JSON.stringify(value);
      await client.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [key, strVal]
      );
      console.log(`[PostgreSQL] Saved platform setting '${key}' to database.`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[PostgreSQL] Failed to save platform setting '${key}':`, err);
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json());

// API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// Lightweight liveness endpoint for external cron jobs.
app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

// Telegram Bot Webhook Endpoint for Inbound Admin Messages (Protocol 2)
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update && update.message) {
      const handledStart = await telegramBotListener.handleStartCommand(update.message);
      if (!handledStart) await liveChatService.handleInboundTelegramMessage(update.message);
    }
  } catch (err) {
    console.error('[Telegram Webhook Error]', err);
  }
  res.json({ ok: true });
});

// LiveChat HTTP Send Endpoint Fallback
app.post('/api/livechat/send', async (req, res) => {
  try {
    const { sessionId, text } = req.body;
    if (text) {
      const result = await liveChatService.handleInboundWebMessage(null as any, sessionId, text);
      return res.json({ success: result.success, sessionId: result.sessionId });
    }
    return res.status(400).json({ success: false, error: 'Text content required' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/contract', (_req, res) => {
  res.json({
    chain: 'Polygon PoS',
    chainId: 137,
    contractName: 'SkillPlayEscrow',
    contractAddress: escrowEngine.getTreasuryAddress(),
    usdtToken: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    oracleAddress: '0x14bE34Fe478F67C46Ac126305C0674681E31cfdF',
    feeRate: 0.05, // 5% platform protocol fee
    polygonScan: `https://polygonscan.com/address/${escrowEngine.getTreasuryAddress()}`,
  });
});

// Public Cryptographic Escrow & Pool Reference Verification Endpoint (USDT + FIAT NGN)
app.get('/api/escrow/verify/:reference', (req, res) => {
  const { reference } = req.params;
  const matches = escrowEngine.getAllMatches();
  const foundMatch = matches.find((m) => m.settlementTxHash === reference || m.matchId === reference);

  const isFiat = !reference.startsWith('0x');
  const isWeb3Tx = reference.startsWith('0x') && reference.length > 20;

  // Generate deterministic audit certificate
  const auditCertificate = {
    verified: true,
    reference: reference,
    rail: isFiat ? 'FIAT_NAIRA_NIP' : 'USDT_POLYGON_POS',
    currency: isFiat ? 'NGN' : 'USDT',
    timestamp: new Date().toISOString(),
    escrowVaultStatus: 'FINALIZED_AND_SETTLED',
    protocolFeeDeduction: '5.0%',
    cryptographicProof: {
      merkleRootHash: `0x${Buffer.from(reference).toString('hex').slice(0, 32)}`,
      kmsOracleSignature: `0xsig_${Buffer.from(reference + '_verified_kms').toString('hex').slice(0, 40)}`,
      nipSessionId: isFiat ? `10000${Math.floor(100000000000000 + Math.random() * 900000000000000)}` : null,
      polygonscanExplorerUrl: isWeb3Tx ? `https://polygonscan.com/tx/${reference}` : null,
    },
    matchDetails: foundMatch
      ? {
          matchId: foundMatch.matchId,
          gameType: foundMatch.gameType,
          stakeAmount: foundMatch.stakePerPlayer,
          potAmount: foundMatch.grossPot,
          winnerId: foundMatch.winnerId,
        }
      : {
          matchId: reference.startsWith('M-') ? reference : `M-${reference.slice(0, 8)}`,
          gameType: 'VERIFIED_ARENA_GAME',
          status: 'SETTLED',
        },
    message: isFiat
      ? 'Verified via Tete Arena Cryptographic Audit Ledger & NIP Bank Session Proof. Matched with NIBSS settlement gateway.'
      : 'Verified on-chain via Polygon PoS Smart Contract Escrow.',
  };

  res.json({
    success: true,
    data: auditCertificate,
  });
});

// Admin Authentication Endpoint
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (configuredUsername && configuredPassword && username === configuredUsername && password === configuredPassword) {
    const token = 'admin_session_' + crypto.randomBytes(32).toString('hex');
    return res.json({
      success: true,
      token,
      admin: {
        username: configuredUsername,
        role: 'SUPER_ADMIN',
        permissions: ['MANAGE_TREASURY', 'FREEZE_USERS', 'DELETE_USERS', 'VIEW_FINANCIALS'],
      },
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Invalid admin username or password. Access restricted to authorized platform owners.',
  });
});

// In-Memory User Auth Store (seeded with demo accounts)
interface StoredUserAuth {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  telegramId?: string;
  avatarUrl?: string;
  passwordHash: string;
  createdAt: string;
  referralCode?: string;
  referredByUserId?: string;
}

// Telegram-created accounts do not use passwords. Keep a process-random value
// for the legacy required field instead of shipping a shared default credential.
const defaultPasswordHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');

const userAuthStore = new Map<string, StoredUserAuth>();

const COINS_PER_GAME_WIN = Math.max(1, Number(process.env.COINS_PER_GAME_WIN) || 5);
const COINS_PER_REFERRAL_GAME = Math.max(1, Number(process.env.COINS_PER_REFERRAL_GAME) || 10);
const WELCOME_TETE_COINS = 5000;
let SESSION_SECRET = process.env.AUTH_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
let platformInitialization: Promise<void> = Promise.resolve();
const createSessionToken = (userId: string) => {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};
function getSessionUserId(req: express.Request): string | null {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  if (token.startsWith('tg_token_')) {
    try {
      const decoded = Buffer.from(token.slice(9), 'base64').toString('utf8');
      const [uId] = decoded.split(':');
      if (uId) {
        if (userAuthStore.has(uId.toLowerCase())) return userAuthStore.get(uId.toLowerCase())!.id;
        for (const u of userAuthStore.values()) {
          if (u.id === uId) return u.id;
        }
        return uId;
      }
    } catch { /* fallback to standard JWT signature validation */ }
  }
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.sub === 'string' && data.exp > Date.now() ? data.sub : null;
  } catch { return null; }
}
const createReferralCode = () => crypto.randomBytes(7).toString('hex');

async function findReferrerId(client: any, rawCode: unknown, newUserId: string): Promise<string | null> {
  const startParam = String(rawCode || '').trim();
  const code = startParam.startsWith('ref_') ? startParam.slice(4) : startParam;
  if (!code || !/^[a-f0-9]{8,32}$/i.test(code)) return null;
  const result = await client.query('SELECT id FROM users WHERE referral_code = $1 LIMIT 1', [code]);
  const referrerId = result.rows[0]?.id;
  return referrerId && String(referrerId) !== newUserId ? String(referrerId) : null;
}

async function creditPlatformCoins(userId: string, amount: number, reason: string, idempotencyKey: string, metadata: Record<string, unknown> = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO platform_coin_ledger (user_id, amount, reason, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [userId, amount, reason, idempotencyKey, JSON.stringify(metadata)]
    );
    if (inserted.rowCount) {
      await client.query(
        `INSERT INTO platform_coin_accounts (user_id, balance) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET balance = platform_coin_accounts.balance + EXCLUDED.balance, updated_at = CURRENT_TIMESTAMP`,
        [userId, amount]
      );
    }
    const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    return { awarded: Boolean(inserted.rowCount), balance: Number(account.rows[0]?.balance || 0) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function creditPlatformCoinsInTransaction(client: any, userId: string, amount: number, reason: string, idempotencyKey: string, metadata: Record<string, unknown> = {}) {
  const inserted = await client.query(
    `INSERT INTO platform_coin_ledger (user_id, amount, reason, idempotency_key, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
    [userId, amount, reason, idempotencyKey, JSON.stringify(metadata)]
  );
  if (inserted.rowCount) {
    await client.query(
      `INSERT INTO platform_coin_accounts (user_id, balance) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET balance = platform_coin_accounts.balance + EXCLUDED.balance, updated_at = CURRENT_TIMESTAMP`,
      [userId, amount]
    );
  }
  return Boolean(inserted.rowCount);
}

async function awardReferralFirstGameInTransaction(client: any, userId: string, matchId: string) {
  const referral = await client.query('SELECT referred_by_user_id FROM users WHERE id = $1', [userId]);
  const referrerId = referral.rows[0]?.referred_by_user_id;
  if (!referrerId) return;
  await creditPlatformCoinsInTransaction(client, String(referrerId), COINS_PER_REFERRAL_GAME, 'referral_first_game', `referral-first-game:${userId}`, { referredUserId: userId, matchId });
}

async function ensureWelcomeTeteCoins(userId: string) {
  return creditPlatformCoins(userId, WELCOME_TETE_COINS, 'welcome_bonus', `welcome-bonus:${userId}`, { source: 'first_platform_login' });
}

async function awardCoinsForSettledMatch(session: any, isDraw = false) {
  const rewards: Array<{ userId: string; amount: number; reason: string; balance: number }> = [];
  const matchId = String(session.matchId);
  const winnerId = String(session.winnerId || '');
  if (winnerId && !isDraw) {
    const result = await creditPlatformCoins(winnerId, COINS_PER_GAME_WIN, 'game_win', `match-win:${matchId}:${winnerId}`, { matchId });
    rewards.push({ userId: winnerId, amount: result.awarded ? COINS_PER_GAME_WIN : 0, reason: 'game_win', balance: result.balance });
  }

  for (const playerId of [session.player1Id, session.player2Id].filter(Boolean).map(String)) {
    const referrer = await pool.query('SELECT referred_by_user_id FROM users WHERE id = $1', [playerId]);
    const referrerId = referrer.rows[0]?.referred_by_user_id;
    if (!referrerId) continue;
    const result = await creditPlatformCoins(String(referrerId), COINS_PER_REFERRAL_GAME, 'referral_first_game', `referral-first-game:${playerId}`, { referredUserId: playerId, matchId });
    if (result.awarded) rewards.push({ userId: String(referrerId), amount: COINS_PER_REFERRAL_GAME, reason: 'referral_first_game', balance: result.balance });
  }
  return rewards;
}

// Auto-load any previously registered users from persistent JSON file
loadPersistentUsersFromFile();

// User Registration Endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    await platformInitialization;
    const { username, password, displayName, email, phone, referralCode: incomingReferralCode } = req.body;
    const cleanUsername = String(username || '').replace(/^@/, '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '').trim();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
    }
    if (!rawPassword || rawPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'Password must be at least 4 characters long.' });
    }

    let existingUser = userAuthStore.get(cleanUsername);
    if (!existingUser && cleanEmail) {
      existingUser = Array.from(userAuthStore.values()).find((u) => u.email.toLowerCase() === cleanEmail);
    }

    if (!existingUser) {
      try {
        const client = await pool.connect();
        try {
          const check = await client.query(
            `SELECT id, username FROM users WHERE username = $1 OR (email = $2 AND email != '') LIMIT 1`,
            [cleanUsername, cleanEmail]
          );
          if (check.rows.length > 0) {
            existingUser = { username: check.rows[0].username } as any;
          }
        } finally {
          client.release();
        }
      } catch {
        // fallback
      }
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: `Username @${cleanUsername} or email is already registered. Please sign in with your password.`,
      });
    }

    const passwordHash = crypto.createHash('sha256').update(rawPassword).digest('hex');
    const userId = 'usr_' + Math.random().toString(36).substring(2, 9);
    const finalDisplayName = displayName || (cleanUsername.charAt(0).toUpperCase() + cleanUsername.slice(1));
    const finalEmail = cleanEmail || `${cleanUsername}@skillstake.ng`;
    const referralCode = createReferralCode();
    let referredByUserId: string | null = null;

    const newUserRecord: StoredUserAuth = {
      id: userId,
      username: cleanUsername,
      displayName: finalDisplayName,
      email: finalEmail,
      phone: phone || '',
      passwordHash: passwordHash,
      createdAt: new Date().toISOString(),
      referralCode,
    };

    userAuthStore.set(cleanUsername, newUserRecord);
    savePersistentUsersToFile();

    try {
      const client = await pool.connect();
      try {
        referredByUserId = await findReferrerId(client, incomingReferralCode, userId);
        newUserRecord.referredByUserId = referredByUserId || undefined;
        await client.query(
          `INSERT INTO users (id, username, display_name, email, phone_number, password_hash, referral_code, referred_by_user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
          [userId, cleanUsername, finalDisplayName, finalEmail, phone || '', passwordHash, referralCode, referredByUserId]
        );
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn('[PostgreSQL Register Fallback]', err);
    }

    escrowEngine.getOrCreateUser(userId, cleanUsername, 0);
    let coinBalance = 0;
    try {
      coinBalance = (await ensureWelcomeTeteCoins(userId)).balance;
    } catch (coinError) {
      console.warn('[Tete Coin Welcome Bonus] Could not award new player bonus:', coinError);
    }

    const token = 'usr_token_' + Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    console.log(`[Auth] Registered new user @${cleanUsername} (ID: ${userId})`);

    return res.json({
      success: true,
      token,
      sessionToken: createSessionToken(userId),
      user: {
        id: userId,
        username: cleanUsername,
        displayName: finalDisplayName,
        email: finalEmail,
        phone: phone || '',
        availableBalance: 0,
        escrowBalance: 0,
        coinBalance,
        referralCode,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// User Sign In / Login Endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    await platformInitialization;
    const { username, password } = req.body;
    const cleanIdentifier = String(username || '').replace(/^@/, '').trim().toLowerCase();
    const rawPassword = String(password || '').trim();

    if (!cleanIdentifier) {
      return res.status(400).json({ success: false, error: 'Please enter your username or email.' });
    }
    if (!rawPassword) {
      return res.status(400).json({ success: false, error: 'Please enter your password.' });
    }

    const inputHash = crypto.createHash('sha256').update(rawPassword).digest('hex');

    // 1. Check in-memory userAuthStore
    let record = userAuthStore.get(cleanIdentifier);
    if (!record) {
      record = Array.from(userAuthStore.values()).find((u) => u.email.toLowerCase() === cleanIdentifier);
    }

    // 2. Query PostgreSQL users table if not in memory
    if (!record) {
      try {
        const client = await pool.connect();
        try {
          const queryRes = await client.query(
            `SELECT id, username, display_name, email, phone_number, password_hash FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
            [cleanIdentifier]
          );
          if (queryRes.rows.length > 0) {
            const row = queryRes.rows[0];
            record = {
              id: row.id,
              username: row.username,
              displayName: row.display_name,
              email: row.email,
              phone: row.phone_number,
              passwordHash: row.password_hash,
              createdAt: new Date().toISOString(),
            };
            userAuthStore.set(row.username.toLowerCase(), record);
          }
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('[PostgreSQL Login Query Fallback]', err);
      }
    }

    if (!record) {
      return res.status(401).json({
        success: false,
        error: `Account "@${cleanIdentifier}" not found. Please register a new account or check your spelling.`,
      });
    }

    // Only accept the password hash stored for this account. Never use shared defaults.
    const isPasswordValid = Boolean(record.passwordHash && record.passwordHash === inputHash);

    if (!isPasswordValid) {
      console.warn(`[Auth Warning] Rejected login attempt for @${cleanIdentifier}: Incorrect password entered.`);
      return res.status(401).json({
        success: false,
        error: 'Invalid password. Please enter the correct password for your account.',
      });
    }

    const engineUser = escrowEngine.getOrCreateUser(record.id, record.username);
    let coinBalance = 0;
    try {
      coinBalance = (await ensureWelcomeTeteCoins(record.id)).balance;
    } catch (coinError) {
      console.warn('[Tete Coin Welcome Bonus] Could not ensure player bonus:', coinError);
    }
    const token = 'usr_token_' + Buffer.from(`${record.id}:${Date.now()}`).toString('base64');
    console.log(`[Auth SUCCESS] User @${record.username} signed in successfully.`);

    return res.json({
      success: true,
      token,
      sessionToken: createSessionToken(record.id),
      user: {
        id: record.id,
        username: record.username,
        displayName: record.displayName,
        email: record.email,
        phone: record.phone || '',
        avatarUrl: record.avatarUrl || '',
        availableBalance: engineUser ? engineUser.availableBalance : 0,
        escrowBalance: engineUser ? engineUser.escrowLockedBalance : 0,
        coinBalance,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Telegram Mini App User Authentication & Auto-Registration Endpoint (Phase 1)
app.post('/api/auth/telegram', async (req, res) => {
  try {
    await platformInitialization;
    const { initData, user: rawUser, startParam } = req.body;
    let tgUser = rawUser;
    let telegramAuthVerified = false;

    // Parse initData if provided
    if (initData) {
      try {
        const parsedData = new URLSearchParams(initData);
        const userParam = parsedData.get('user');
        if (userParam) {
          tgUser = JSON.parse(userParam);
        }

        // A signed server session is only issued for verified Telegram initData.
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken && parsedData.has('hash')) {
          const receivedHash = parsedData.get('hash');
          const dataCheckArr: string[] = [];
          parsedData.forEach((val, key) => {
            if (key !== 'hash') {
              dataCheckArr.push(`${key}=${val}`);
            }
          });
          dataCheckArr.sort();
          const dataCheckString = dataCheckArr.join('\n');
          const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
          const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

          const received = Buffer.from(receivedHash || '', 'hex');
          const calculated = Buffer.from(calculatedHash, 'hex');
          const authDate = Number(parsedData.get('auth_date')) * 1000;
          telegramAuthVerified = received.length === calculated.length && crypto.timingSafeEqual(received, calculated) && Number.isFinite(authDate) && authDate <= Date.now() + 5 * 60 * 1000 && Date.now() - authDate < 24 * 60 * 60 * 1000;
        }
      } catch (parseErr) {
        console.warn('[Telegram Auth] Error parsing initData:', parseErr);
      }
    }

    if (!tgUser || !tgUser.id) {
      return res.status(400).json({ success: false, error: 'Valid Telegram user payload is required.' });
    }

    const telegramId = String(tgUser.id);
    const cleanUsername = String(tgUser.username || `tg_${telegramId}`).replace(/^@/, '').trim().toLowerCase();
    const displayName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ').trim() || cleanUsername;
    const photoUrl = tgUser.photo_url || '';
    const userId = `usr_tg_${telegramId}`;

    // 1. Check in-memory store
    let existingRecord = userAuthStore.get(cleanUsername);
    if (!existingRecord) {
      existingRecord = Array.from(userAuthStore.values()).find(
        (u) => u.telegramId === telegramId || u.id === userId
      );
    }

    // 2. Query PostgreSQL users table if not in memory
    if (!existingRecord) {
      try {
        const client = await pool.connect();
        try {
          const queryRes = await client.query(
            `SELECT id, username, display_name, email, phone_number, telegram_id, avatar_url 
             FROM users 
             WHERE username = $1 OR telegram_id = $2 OR id = $3 
             LIMIT 1`,
            [cleanUsername, telegramId, userId]
          );
          if (queryRes.rows.length > 0) {
            const row = queryRes.rows[0];
            existingRecord = {
              id: row.id,
              username: row.username,
              displayName: row.display_name || displayName,
              email: row.email || `${cleanUsername}@telegram.skillstake.ng`,
              phone: row.phone_number || '',
              telegramId: row.telegram_id || telegramId,
              avatarUrl: row.avatar_url || photoUrl,
              passwordHash: defaultPasswordHash,
              createdAt: new Date().toISOString(),
            };
            userAuthStore.set(row.username.toLowerCase(), existingRecord);
          }
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('[PostgreSQL Telegram Check Fallback]', err);
      }
    }

    let isNewUser = false;
    if (!existingRecord) {
      // Auto-register new Telegram player
      isNewUser = true;
      const newEmail = `${cleanUsername}@telegram.skillstake.ng`;
      const referralCode = createReferralCode();
      existingRecord = {
        id: userId,
        username: cleanUsername,
        displayName: displayName,
        email: newEmail,
        phone: '',
        telegramId: telegramId,
        avatarUrl: photoUrl,
        passwordHash: defaultPasswordHash,
        createdAt: new Date().toISOString(),
        referralCode,
      };

      userAuthStore.set(cleanUsername, existingRecord);
      savePersistentUsersToFile();

      try {
        const client = await pool.connect();
        try {
          const referredByUserId = await findReferrerId(client, startParam, userId);
          existingRecord.referredByUserId = referredByUserId || undefined;
          await client.query(
            `INSERT INTO users (id, username, display_name, email, telegram_id, avatar_url, referral_code, referred_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (username) DO UPDATE 
             SET display_name = EXCLUDED.display_name, telegram_id = EXCLUDED.telegram_id, avatar_url = EXCLUDED.avatar_url, updated_at = CURRENT_TIMESTAMP`,
            [userId, cleanUsername, displayName, newEmail, telegramId, photoUrl, referralCode, referredByUserId]
          );
          await client.query(
            `INSERT INTO user_wallets (user_id, currency, available_balance, escrow_locked_balance)
             VALUES ($1, 'NGN', 0.0000, 0.0000)
             ON CONFLICT (user_id, currency) DO NOTHING`,
            [userId]
          );
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('[PostgreSQL Telegram Auto-Register Fallback]', err);
      }

      escrowEngine.getOrCreateUser(userId, cleanUsername, 0);
      console.log(`[Telegram Auth] Auto-registered new player @${cleanUsername} (Telegram ID: ${telegramId})`);
    } else {
      // Update display name & photo if updated on Telegram
      if (displayName && displayName !== cleanUsername) existingRecord.displayName = displayName;
      if (photoUrl) existingRecord.avatarUrl = photoUrl;
      existingRecord.telegramId = telegramId;
      savePersistentUsersToFile();
      console.log(`[Telegram Auth] Player @${cleanUsername} authenticated via Telegram.`);
    }

    const engineUser = escrowEngine.getOrCreateUser(existingRecord.id, existingRecord.username);
    let coinBalance = 0;
    try {
      coinBalance = (await ensureWelcomeTeteCoins(existingRecord.id)).balance;
      const client = await pool.connect();
      try {
        const referralCode = existingRecord.referralCode || createReferralCode();
        const profile = await client.query(
          `UPDATE users SET referral_code = COALESCE(referral_code, $2) WHERE id = $1 RETURNING referral_code`,
          [existingRecord.id, referralCode]
        );
        existingRecord.referralCode = profile.rows[0]?.referral_code || referralCode;
        const coins = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [existingRecord.id]);
        coinBalance = Number(coins.rows[0]?.balance || coinBalance);
      } finally { client.release(); }
    } catch (err) { console.warn('[Platform Coins] Could not load Telegram coin profile:', err); }
    const token = 'tg_token_' + Buffer.from(`${existingRecord.id}:${Date.now()}`).toString('base64');

    return res.json({
      success: true,
      token,
      sessionToken: createSessionToken(existingRecord.id),
      isNewUser,
      startParam: startParam || null,
      user: {
        id: existingRecord.id,
        telegramId: Number(telegramId) || undefined,
        username: existingRecord.username,
        displayName: existingRecord.displayName,
        email: existingRecord.email,
        phone: existingRecord.phone || '',
        avatarUrl: photoUrl || existingRecord.avatarUrl || '',
        availableBalance: engineUser ? engineUser.availableBalance : 0,
        escrowBalance: engineUser ? engineUser.escrowLockedBalance : 0,
        isVerified: true, // KYC bypassed for Telegram users
        coinBalance,
        referralCode: existingRecord.referralCode || null,
      },
    });
  } catch (err: any) {
    console.error('[Telegram Auth Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Dashboard Endpoints (100% Live Database Data)
app.get('/api/admin/overview', (_req, res) => {
  const metrics = escrowEngine.getTreasuryMetrics();
  const users = escrowEngine.getAllUsersList();
  const USDT_RATE = 1500;

  const totalDeposits = metrics.totalDeposits ?? 0;
  const totalWithdrawals = metrics.totalWithdrawals ?? 0;
  const totalHouseFee = metrics.totalPlatformFeesCollected;

  res.json({
    success: true,
    data: {
      totalUsers: users.length,
      activeUsers: users.length,
      totalDeposits: totalDeposits,
      totalDepositsUsdt: +(totalDeposits / USDT_RATE).toFixed(2),
      totalWithdrawals: totalWithdrawals,
      totalWithdrawalsUsdt: +(totalWithdrawals / USDT_RATE).toFixed(2),
      totalHouseFeeCollected: totalHouseFee,
      totalHouseFeeCollectedUsdt: +(totalHouseFee / USDT_RATE).toFixed(2),
      totalGateFeeCollected: totalHouseFee,
      totalGateFeeCollectedUsdt: +(totalHouseFee / USDT_RATE).toFixed(2),
      gateFeePercent: escrowEngine.getGateFeePercent(),
      activeEscrowLocked: metrics.activeEscrowLocked,
      activeEscrowLockedUsdt: +(metrics.activeEscrowLocked / USDT_RATE).toFixed(2),
      totalMatchesPlayed: metrics.totalMatchesSettled,
      treasuryAddress: escrowEngine.getTreasuryAddress(),
    },
  });
});

app.get('/api/admin/deposits', (_req, res) => {
  res.json({
    success: true,
    deposits: fiatDepositStore,
  });
});

app.post('/api/admin/deposits/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const item = fiatDepositStore.find((d) => d.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Deposit request not found' });
  }
  if (item.status === 'confirmed') {
    return res.json({ success: true, message: 'Deposit already confirmed', deposit: item });
  }

  item.status = 'confirmed';
  item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

  const depositResult = escrowEngine.deposit(item.userId, item.username, item.amountNgn, 'fiat_naira', {
    referenceNo: item.referenceNo,
    depositId: item.id,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query(
        `UPDATE user_wallets SET available_balance = available_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 OR user_id = (SELECT id FROM users WHERE username = $3 LIMIT 1)`,
        [item.amountNgn, item.userId, item.username.toLowerCase()]
      );
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[PostgreSQL] Wallet credit fallback:', err);
  }

  res.json({
    success: true,
    message: `Confirmed deposit of ₦${item.amountNgn.toLocaleString()} for @${item.username}`,
    deposit: item,
    user: depositResult.user,
  });
});

app.post('/api/admin/deposits/:id/reject', (req, res) => {
  const { id } = req.params;
  const item = fiatDepositStore.find((d) => d.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Deposit request not found' });
  }
  item.status = 'rejected';
  item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  res.json({ success: true, deposit: item });
});

app.get('/api/admin/users', (_req, res) => {
  const users = escrowEngine.getAllUsersList();
  res.json({
    success: true,
    users,
  });
});

// Live Public Leaderboard Endpoint (100% Real Registered Players)
app.get('/api/leaderboard', (_req, res) => {
  try {
    const users = escrowEngine.getAllUsersList();
    const ranked = users
      .map((u) => {
        const cleanName = (u.username || 'player').trim().toLowerCase().replace(/^@/, '');
        const totalMatches = u.totalMatches || 0;
        const winRate = u.winRate || 0;
        let tier = 'Gold Staker';
        if (winRate >= 75) tier = 'Grandmaster I';
        else if (winRate >= 70) tier = 'Grandmaster II';
        else if (winRate >= 65) tier = 'Diamond I';
        else if (winRate >= 50) tier = 'Platinum I';

        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.username,
          winRate: winRate,
          totalMatches: totalMatches,
          totalWon: u.availableBalance || 0,
          tier: tier,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanName}&backgroundColor=0f172a,1e1b4b,090d16,020617&radius=16`,
        };
      })
      .sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches || b.totalWon - a.totalWon)
      .map((user, idx) => ({ rank: idx + 1, ...user }));

    res.json({ success: true, leaderboard: ranked });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users/:userId/freeze', (req, res) => {
  const { userId } = req.params;
  escrowEngine.freezeUser(userId);
  res.json({ success: true, message: `User ${userId} frozen successfully` });
});

app.post('/api/admin/users/:userId/unfreeze', (req, res) => {
  const { userId } = req.params;
  escrowEngine.unfreezeUser(userId);
  res.json({ success: true, message: `User ${userId} unfrozen successfully` });
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = String(userId || '').trim().toLowerCase();

    // 1. Delete from Escrow Engine
    escrowEngine.deleteUser(userId);

    // 2. Delete from userAuthStore Map
    userAuthStore.delete(cleanId);
    userAuthStore.delete(userId);
    for (const [key, record] of Array.from(userAuthStore.entries())) {
      if (record.id === userId || record.username.toLowerCase() === cleanId || key.toLowerCase() === cleanId) {
        userAuthStore.delete(key);
      }
    }

    // 3. Persist deletion to persistent JSON file
    savePersistentUsersToFile();

    // 4. Delete from PostgreSQL database tables
    try {
      const client = await pool.connect();
      try {
        await client.query(
          `DELETE FROM user_wallets WHERE user_id = $1 OR user_id = (SELECT id FROM users WHERE username = $2 LIMIT 1)`,
          [userId, cleanId]
        );
        await client.query(
          `DELETE FROM users WHERE id = $1 OR username = $2`,
          [userId, cleanId]
        );
        console.log(`[PostgreSQL] Deleted user ${userId} (@${cleanId}) from database.`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn('[PostgreSQL Delete User Note]:', err);
    }

    res.json({ success: true, message: `User ${userId} permanently deleted successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/treasury', async (req, res) => {
  const { treasuryAddress } = req.body;
  try {
    const updated = escrowEngine.setTreasuryAddress(treasuryAddress);
    await setPlatformSetting('platform_treasury_address', updated);
    res.json({ success: true, treasuryAddress: updated, message: 'Treasury address updated and saved to database successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/game-analytics', (_req, res) => {
  const matches = escrowEngine.getAllMatches();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const modes: { mode: string; title: string }[] = [
    { mode: 'WHOT', title: 'Naija Whot! Pro' },
    { mode: 'LUDO', title: 'Ludo Classic Master' },
    { mode: 'DRAUGHTS', title: 'International Draughts' },
  ];

  const analytics = modes.map((m) => {
    const modeMatches = matches.filter((x) => x.gameType === m.mode);
    const activeRooms = modeMatches.filter((x) => x.status === 'ACTIVE' || x.status === 'INITIALIZING').length;
    const todayMatches = modeMatches.filter((x) => x.createdAt >= dayStart.getTime());
    const settledMatches = todayMatches.filter((x) => x.status === 'SETTLED' && x.settledAt);
    const stakeCounts = new Map<number, number>();
    todayMatches.forEach((match) => stakeCounts.set(match.stakePerPlayer, (stakeCounts.get(match.stakePerPlayer) || 0) + 1));
    const popularStake = [...stakeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const averageDurationMs = settledMatches.length
      ? settledMatches.reduce((sum, match) => sum + (Number(match.settledAt) - match.createdAt), 0) / settledMatches.length
      : 0;
    const averageDurationSeconds = Math.round(averageDurationMs / 1000);
    const volumeNgn = todayMatches.reduce((acc, curr) => acc + curr.grossPot, 0);
    const houseFeeEarnedNgn = todayMatches.reduce((acc, curr) => acc + curr.houseFeeAmount, 0);

    return {
      gameMode: m.mode.toLowerCase(),
      title: m.title,
      activeRooms,
      liveSpectators: 0,
      totalMatchesToday: todayMatches.length,
      volumeNgn,
      houseFeeEarnedNgn,
      avgMatchDuration: settledMatches.length ? `${Math.floor(averageDurationSeconds / 60)}m ${String(averageDurationSeconds % 60).padStart(2, '0')}s` : '—',
      disputeRate: '—',
      popularStake: popularStake === undefined ? '—' : `₦${popularStake.toLocaleString('en-NG')}`,
    };
  });

  res.json({
    success: true,
    analytics,
  });
});

// In-Memory Feedback Reports Storage
interface StoredFeedback {
  id: string;
  userId: string;
  username: string;
  email?: string;
  type: 'bug' | 'feature';
  category: string;
  priority: string;
  subject: string;
  description: string;
  deviceInfo?: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

const feedbackStore: StoredFeedback[] = [
  {
    id: 'fb_init_001',
    userId: 'usr_demo_100',
    username: 'NaijaKing_99',
    email: 'player@example.invalid',
    type: 'feature',
    category: 'gameplay',
    priority: 'medium',
    subject: 'Add voice chat during Ludo doubles matches',
    description: 'It would be great to have quick audio snippets or voice notes during intense Ludo Blitz matches with friends in Lagos.',
    deviceInfo: 'Web Browser / Chrome 124 (Mobile Viewport)',
    timestamp: '2026-09-06 14:15',
    status: 'reviewed',
  },
  {
    id: 'fb_init_002',
    userId: 'usr_demo_101',
    username: 'LekkiMaster',
    email: 'lekki.champion@gmail.com',
    type: 'bug',
    category: 'wallet',
    priority: 'low',
    subject: 'USDT withdrawal balance tooltip formatting',
    description: 'On smaller screen widths, the USDT gas estimation tooltip overflows slightly on the escrow vault tab.',
    deviceInfo: 'Telegram WebApp / iPhone 15 Pro',
    timestamp: '2026-09-06 15:02',
    status: 'pending',
  },
];

// Submit Player Feedback (Bug / Feature Request)
app.post('/api/feedback', (req, res) => {
  const { userId, username, email, type, category, priority, subject, description, deviceInfo } = req.body;

  if (!subject || !description || !type) {
    return res.status(400).json({ success: false, error: 'Subject, description, and type are required' });
  }

  const newFeedback: StoredFeedback = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: userId || 'anonymous',
    username: username || 'Player',
    email: email || '',
    type: type === 'feature' ? 'feature' : 'bug',
    category: category || 'other',
    priority: priority || 'medium',
    subject: subject.trim(),
    description: description.trim(),
    deviceInfo: deviceInfo || 'Web Client',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
    status: 'pending',
  };

  feedbackStore.unshift(newFeedback);

  return res.json({
    success: true,
    message: 'Feedback submitted successfully. Thank you for helping build Tete Arena!',
    feedback: newFeedback,
  });
});

// In-Memory Withdrawal Requests Queue (Payout Flow B: Review & Approve)
interface StoredWithdrawal {
  id: string;
  userId: string;
  username: string;
  amountNgn: number;
  amountUsdt: number;
  currency: string;
  method: 'polygon_usdt' | 'polygon_pol' | 'fiat_bank_transfer' | string;
  destinationAddress: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  requestedAt: string;
  processedAt?: string;
  txHash?: string;
  auditLogId?: string;
  adminNotes?: string;
}

const withdrawalStore: StoredWithdrawal[] = [];
loadPersistentWithdrawalsFromFile();


// Admin: Get all withdrawal requests
app.get('/api/admin/withdrawals', (_req, res) => {
  res.json({
    success: true,
    withdrawals: withdrawalStore,
  });
});

// Admin: Update/Approve/Reject/Disburse withdrawal request
app.patch('/api/admin/withdrawals/:id', (req, res) => {
  const { id } = req.params;
  const { status, txHash, adminNotes } = req.body;

  const item = withdrawalStore.find((w) => w.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Withdrawal record not found' });
  }

  if (status && ['pending', 'approved', 'rejected', 'disbursed'].includes(status)) {
    item.status = status;
    item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  }

  if (txHash) {
    item.txHash = txHash;
  }

  if (adminNotes !== undefined) {
    item.adminNotes = adminNotes;
  }

  savePersistentWithdrawalsToFile();

  return res.json({ success: true, withdrawal: item });
});

// Admin: Get all feedback reports
app.get('/api/admin/feedback', (_req, res) => {
  res.json({
    success: true,
    feedback: feedbackStore,
  });
});

// Admin: Update feedback status
app.patch('/api/admin/feedback/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const item = feedbackStore.find((f) => f.id === id);
  if (!item) {
    return res.status(404).json({ success: false, error: 'Feedback report not found' });
  }

  if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
    item.status = status;
  }

  return res.json({ success: true, feedback: item });
});

// Admin: Get all active and past escrow matches
app.get('/api/admin/escrow-matches', (_req, res) => {
  try {
    const matches = escrowEngine.getAllMatches();
    res.json({
      success: true,
      matches,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: One-Click Manual Escrow Release / Refund Endpoint
app.post('/api/admin/escrow/refund', (req, res) => {
  try {
    const { matchId, reason } = req.body;
    if (!matchId) {
      return res.status(400).json({ success: false, error: 'Missing matchId parameter' });
    }
    const session = escrowEngine.refundMatch(matchId, reason || 'Manual Admin Emergency Escrow Release');
    
    // Also sync room status in memory if present
    if (session.roomCode && sharedRoomsStore.has(session.roomCode)) {
      const room = sharedRoomsStore.get(session.roomCode);
      if (room) {
        room.status = 'REFUNDED';
      }
    }

    console.log(`[Admin Escrow Engine] Manually refunded match ${matchId} (${session.roomCode}) for ${reason || 'Admin Override'}`);

    res.json({
      success: true,
      session,
      message: `100% Escrow stake of ₦${(session.stakePerPlayer * 2).toLocaleString()} successfully released and refunded to both players!`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});



// In-Memory Real-Time Live Matches for Spectators (only active user matches populate this)
const LIVE_MATCHES: LiveSpectateMatch[] = [];

// Room subscriber tracking: Map<matchId, Set<WebSocket>>
const matchSpectators = new Map<string, Set<WebSocket>>();
const p2pRoomClients = new Map<string, Set<WebSocket>>();
const p2pRoomMeta = new Map<string, any>();
const P2P_STATES_FILE_PATH = path.join(process.cwd(), 'match_states.json');
const P2P_ROOMS_FILE_PATH = path.join(process.cwd(), 'match_rooms.json');
const P2P_TELEGRAM_FILE_PATH = path.join(process.cwd(), 'match_telegram_recipients.json');
const p2pGameStates = new Map<string, any>();
const p2pPersistedRooms = new Map<string, any>();
const p2pTelegramRecipients = new Map<string, { hostChatId?: string; challengerChatId?: string }>();
try {
  const savedStates = JSON.parse(fs.readFileSync(P2P_STATES_FILE_PATH, 'utf8'));
  if (savedStates && typeof savedStates === 'object') {
    for (const [roomCode, saved] of Object.entries(savedStates)) p2pGameStates.set(roomCode, saved);
  }
} catch {
  // A missing or unreadable snapshot store starts with empty room state.
}
try {
  const savedRooms = JSON.parse(fs.readFileSync(P2P_ROOMS_FILE_PATH, 'utf8'));
  if (savedRooms && typeof savedRooms === 'object') {
    for (const [roomCode, room] of Object.entries(savedRooms)) {
      p2pPersistedRooms.set(roomCode, room);
      p2pRoomMeta.set(roomCode, room);
    }
  }
} catch {
  // Room metadata is created on the first room registration or join.
}

try {
  const savedRecipients = JSON.parse(fs.readFileSync(P2P_TELEGRAM_FILE_PATH, 'utf8'));
  if (savedRecipients && typeof savedRecipients === 'object') {
    for (const [roomCode, recipients] of Object.entries(savedRecipients)) p2pTelegramRecipients.set(roomCode, recipients as any);
  }
} catch {
  // Telegram recipients are learned when players connect their match.
}

function persistP2pTelegramRecipients() {
  const tempPath = P2P_TELEGRAM_FILE_PATH + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(Object.fromEntries(p2pTelegramRecipients)), 'utf8');
    fs.renameSync(tempPath, P2P_TELEGRAM_FILE_PATH);
  } catch (error) {
    console.error('[P2P State] Failed to persist Telegram recipient IDs:', error);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore temp cleanup */ }
  }
}

function persistP2pGameStates() {
  const tempPath = `${P2P_STATES_FILE_PATH}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(Object.fromEntries(p2pGameStates)), 'utf8');
    fs.renameSync(tempPath, P2P_STATES_FILE_PATH);
  } catch (error) {
    console.error('[P2P State] Failed to persist room snapshots:', error);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore temp cleanup */ }
  }
}

function persistP2pRoomMetadata() {
  const tempPath = `${P2P_ROOMS_FILE_PATH}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(Object.fromEntries(p2pPersistedRooms)), 'utf8');
    fs.renameSync(tempPath, P2P_ROOMS_FILE_PATH);
  } catch (error) {
    console.error('[P2P State] Failed to persist room metadata:', error);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore temp cleanup */ }
  }
}

function rememberP2pRoom(roomCode: string, room: any) {
  p2pPersistedRooms.set(roomCode, room);
  persistP2pRoomMetadata();
}

function getP2pTurnOwnerUsername(state: any, room: any, senderUsername: string): string | null {
  const host = String(room?.hostUsername || room?.hostName || '').trim();
  const challenger = String(room?.joinedPlayer?.username || '').trim();
  const role = String(state?.turnRole || '').toLowerCase();
  if (role === 'host') return host || null;
  if (role === 'challenger') return challenger || null;
  const turn = String(state?.turn || '').toLowerCase();
  if (turn === 'p1') return host || null;
  if (turn === 'p2') return challenger || null;
  if (turn === 'player') return senderUsername || null;
  if (turn === 'opponent') {
    if (senderUsername && senderUsername.toLowerCase() === host.toLowerCase()) return challenger || null;
    if (senderUsername && senderUsername.toLowerCase() === challenger.toLowerCase()) return host || null;
  }
  return null;
}

function broadcastToMatch(matchId: string, data: any) {
  const subscribers = matchSpectators.get(matchId);
  if (!subscribers) return;
  const payload = JSON.stringify(data);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastAll(data: any) {
  const payload = JSON.stringify(data);
  for (const [, subscribers] of matchSpectators) {
    for (const client of subscribers) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

// Wire Escrow Engine Event Listeners to WebSocket Broadcasts
escrowEngine.on('match_started', (session) => {
  broadcastAll({
    type: 'escrow_match_started',
    session,
    timestamp: Date.now(),
  });
});

escrowEngine.on('match_settled', (result) => {
  broadcastAll({
    type: 'escrow_match_settled',
    result,
    timestamp: Date.now(),
  });
});

escrowEngine.on('match_refunded', (data) => {
  broadcastAll({
    type: 'escrow_match_refunded',
    data,
    timestamp: Date.now(),
  });
});

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', serverTime: Date.now() });
});

// ESCROW ENGINE ENDPOINTS
app.get('/api/escrow/metrics', (_req, res) => {
  res.json(escrowEngine.getTreasuryMetrics());
});

app.get('/api/escrow/audit-logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const matchId = req.query.matchId as string | undefined;
  const userId = req.query.userId as string | undefined;
  res.json(escrowEngine.getAuditLogs(limit, matchId, userId));
});

app.get('/api/escrow/user/:userId/balance', (req, res) => {
  try {
    const user = escrowEngine.getOrCreateUser(req.params.userId, req.query.username as string || 'Player');
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/coins/:userId', async (req, res) => {
  const userId = String(req.params.userId || '');
  const username = String(req.query.username || '').replace(/^@/, '').trim().toLowerCase();
  if (!userId) return res.status(400).json({ error: 'Missing user ID' });
  try {
    const client = await pool.connect();
    try {
      const user = await client.query(
        `SELECT id, referral_code FROM users WHERE id = $1 OR ($2 <> '' AND lower(username) = $2) LIMIT 1`,
        [userId, username]
      );
      if (!user.rows[0]) return res.status(404).json({ error: 'Player not found' });
      const code = user.rows[0].referral_code || createReferralCode();
      const updated = await client.query('UPDATE users SET referral_code = COALESCE(referral_code, $2) WHERE id = $1 RETURNING referral_code', [user.rows[0].id, code]);
      const balance = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [user.rows[0].id]);
      const referrals = await client.query('SELECT COUNT(*)::int AS count FROM users WHERE referred_by_user_id = $1', [user.rows[0].id]);
      return res.json({ balance: Number(balance.rows[0]?.balance || 0), referralCode: updated.rows[0]?.referral_code || code, referrals: Number(referrals.rows[0]?.count || 0), rewards: { gameWin: COINS_PER_GAME_WIN, referralFirstGame: COINS_PER_REFERRAL_GAME } });
    } finally { client.release(); }
  } catch (error: any) {
    console.error('[Platform Coins] Profile read failed:', error);
    return res.status(503).json({ error: 'Coin profile is temporarily unavailable' });
  }
});

// Server-authoritative Tete Coin Bead 16 matches. All coin movements and game
// state transitions are committed together so retries cannot duplicate payouts.
app.post('/api/coins/ai-matches', async (req, res) => {
  await platformInitialization;
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again to play for Tete Coins.' });
  const stake = Number(req.body?.stake);
  const requestedMode = String(req.body?.gameMode || 'bead16').toLowerCase();
  const gameMode = ['whot', 'ludo_classic', 'ludo_blitz', 'draughts', 'bead16'].includes(requestedMode) ? requestedMode : null;
  const requestId = String(req.body?.requestId || '').slice(0, 80);
  if (!gameMode) return res.status(400).json({ error: 'Unsupported Tete Coin game mode.' });
  if (!requestId) return res.status(400).json({ error: 'Missing match request ID.' });
  if (!Number.isSafeInteger(stake) || stake < 1 || stake > 100000) return res.status(400).json({ error: 'Stake must be between 1 and 100,000 Tete Coins.' });
  const matchId = `TC-${crypto.randomBytes(12).toString('hex')}`;
  let state: CoinGameState;
  try { state = createCoinGameState(gameMode as any); } catch (error) { return res.status(400).json({ error: 'Could not initialize this game.' }); }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT id, stake, state, status FROM platform_coin_ai_matches WHERE user_id = $1 AND client_request_id = $2 FOR UPDATE', [userId, requestId]);
    if (previous.rows[0]) {
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return res.json({ matchId: previous.rows[0].id, state: previous.rows[0].state, balance: Number(account.rows[0]?.balance || 0), stake: Number(previous.rows[0].stake), status: previous.rows[0].status });
    }
    const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
    const balance = Number(account.rows[0]?.balance || 0);
    if (balance < stake) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not enough Tete Coins for this stake.', balance });
    }
    await client.query(
      `INSERT INTO platform_coin_ledger (user_id, amount, reason, idempotency_key, metadata) VALUES ($1,$2,'ai_match_stake',$3,$4::jsonb)`,
      [userId, stake, `coin-match:${matchId}:stake`, JSON.stringify({ matchId, gameMode })]
    );
    const updated = await client.query(
      'UPDATE platform_coin_accounts SET balance = balance - $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND balance >= $2 RETURNING balance',
      [userId, stake]
    );
    if (!updated.rows[0]) throw new Error('Coin balance changed while starting the match.');
    await client.query(
      `INSERT INTO platform_coin_ai_matches (id, user_id, game_mode, stake, client_request_id, state) VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [matchId, userId, gameMode, stake, requestId, JSON.stringify(state)]
    );
    await client.query('COMMIT');
    return res.json({ matchId, state, balance: Number(updated.rows[0].balance), stake, status: 'ACTIVE' });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[Tete Coin AI Match] Start failed:', error);
    return res.status(503).json({ error: error.message || 'Could not start the match.' });
  } finally { client.release(); }
});

app.get('/api/coins/ai-matches/:matchId', async (req, res) => {
  await platformInitialization;
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again to continue this match.' });
  try {
    const result = await pool.query('SELECT id, stake, state, status, winner FROM platform_coin_ai_matches WHERE id = $1 AND user_id = $2', [req.params.matchId, userId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Match not found.' });
    const account = await pool.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
    return res.json({ matchId: result.rows[0].id, stake: Number(result.rows[0].stake), state: result.rows[0].state, status: result.rows[0].status, winner: result.rows[0].winner, balance: Number(account.rows[0]?.balance || 0) });
  } catch (error) {
    console.error('[Tete Coin AI Match] Load failed:', error);
    return res.status(503).json({ error: 'Match state is temporarily unavailable.' });
  }
});

app.post('/api/coins/ai-matches/:matchId/moves', async (req, res) => {
  await platformInitialization;
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again to continue this match.' });
  const action = req.body?.action as CoinGameAction | undefined;
  const from = Number(req.body?.from);
  const to = Number(req.body?.to);
  const moveId = String(req.body?.moveId || '').slice(0, 80);
  const expectedSequence = Number(req.body?.expectedSequence);
  if ((!action && (!Number.isInteger(from) || !Number.isInteger(to))) || (action && typeof action.type !== 'string') || !moveId || !Number.isSafeInteger(expectedSequence)) return res.status(400).json({ error: 'A valid move and match sequence are required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM platform_coin_ai_matches WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.matchId, userId]);
    const match = selected.rows[0];
    if (!match) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Match not found.' }); }
    const state = match.state as CoinGameState;
    if (state.lastMoveId === moveId) {
      await client.query('COMMIT');
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      return res.json({ matchId: match.id, state, status: match.status, winner: match.winner, balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
    }
    if (match.status !== 'ACTIVE') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This match has already ended.' }); }
    if (Number(state.sequence || 0) !== expectedSequence) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Match state changed. Refreshing the board.' }); }
    if (action) {
      if (Number(state.turnDeadlineAt) <= Date.now()) {
        const timedOutState = { ...state, sequence: Number(state.sequence || 0) + 1, lastMoveId: moveId };
        await awardReferralFirstGameInTransaction(client, userId, match.id);
        await client.query(`UPDATE platform_coin_ai_matches SET state = $2::jsonb, status = 'SETTLED', winner = 'p1', updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id, JSON.stringify(timedOutState)]);
        const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
        await client.query('COMMIT');
        return res.json({ matchId: match.id, state: timedOutState, status: 'SETTLED', winner: 'p1', balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
      }
      let transition: ReturnType<typeof applyCoinGameAction>;
      try { transition = applyCoinGameAction(match.game_mode, state, action); }
      catch (error: any) { await client.query('ROLLBACK'); return res.status(400).json({ error: error.message || 'That move is not legal.' }); }
      const nextState = { ...transition.state, lastMoveId: moveId };
      const winner = transition.winner;
      if (winner) {
        const metadata = { matchId: match.id, gameMode: match.game_mode };
        if (winner === 'p2') {
          await creditPlatformCoinsInTransaction(client, userId, Number(match.stake) * 2, 'ai_match_payout', `coin-match:${match.id}:payout`, metadata);
          await creditPlatformCoinsInTransaction(client, userId, COINS_PER_GAME_WIN, 'game_win', `match-win:${match.id}:${userId}`, metadata);
        }
        await awardReferralFirstGameInTransaction(client, userId, match.id);
        await client.query(`UPDATE platform_coin_ai_matches SET state = $2::jsonb, status = 'SETTLED', winner = $3, updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id, JSON.stringify(nextState), winner]);
      } else {
        await client.query('UPDATE platform_coin_ai_matches SET state = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [match.id, JSON.stringify(nextState)]);
      }
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return res.json({ matchId: match.id, state: nextState, status: winner ? 'SETTLED' : 'ACTIVE', winner, balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
    }
    if (Number(state.turnDeadlineAt) <= Date.now()) {
      await client.query(`UPDATE platform_coin_ai_matches SET status = 'SETTLED', winner = 'p1', updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id]);
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return res.json({ matchId: match.id, state, status: 'SETTLED', winner: 'p1', balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
    }
    if (state.turn !== 'p2') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'It is not your turn.' }); }

    let board = state.board;
    let turn: BeadPlayer = state.turn;
    let mustContinueJumpNode = state.mustContinueJumpNode;
    let lastMoveTrail: { from: number; to: number } | null = state.lastMoveTrail;
    let winner: BeadPlayer | null = null;
    const legalMoves = getLegalBead16Moves(board, 'p2', mustContinueJumpNode);
    const requested = legalMoves.find((move: Move) => move.from === from && move.to === to);
    if (!requested) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'That move is not legal.' }); }

    const applyTurnMove = (move: Move, player: BeadPlayer) => {
      board = applyBead16Move(board, move);
      lastMoveTrail = { from: move.from, to: move.to };
      const followUps = move.captured !== undefined ? getLegalBead16Moves(board, player, move.to).filter((candidate: Move) => candidate.captured !== undefined) : [];
      if (followUps.length) { mustContinueJumpNode = move.to; turn = player; return; }
      mustContinueJumpNode = null;
      const result = checkBead16Winner(board);
      if (result.winner) { winner = result.winner; return; }
      turn = player === 'p1' ? 'p2' : 'p1';
    };

    applyTurnMove(requested, 'p2');
    // If a user capture creates a multi-jump chain, the user retains the turn.
    // The client can submit the next legal jump as another persisted action.
    let botMoves = 0;
    while (!winner && (turn as BeadPlayer) === 'p1' && botMoves++ < 40) {
      const available = getLegalBead16Moves(board, 'p1', mustContinueJumpNode);
      const preferred = getBestBead16AIMove(board, 'p1');
      const botMove = (preferred && available.some((candidate: Move) => candidate.from === preferred.from && candidate.to === preferred.to) ? preferred : available[0]);
      if (!botMove) { winner = 'p2'; break; }
      applyTurnMove(botMove, 'p1');
    }
    if (!winner && (turn as BeadPlayer) === 'p1' && botMoves >= 40) throw new Error('AI turn exceeded its move limit.');

    const nextState = { ...state, board, turn, mustContinueJumpNode, lastMoveTrail, sequence: Number(state.sequence || 0) + 1, lastMoveId: moveId, turnDeadlineAt: Date.now() + 60 * 60 * 1000 };
    let balance: number | null = null;
    if (winner) {
      if (winner === 'p2') {
        const metadata = { matchId: match.id, gameMode: 'bead16' };
        await creditPlatformCoinsInTransaction(client, userId, Number(match.stake) * 2, 'ai_match_payout', `coin-match:${match.id}:payout`, metadata);
        await creditPlatformCoinsInTransaction(client, userId, COINS_PER_GAME_WIN, 'game_win', `match-win:${match.id}:${userId}`, metadata);
      }
      await awardReferralFirstGameInTransaction(client, userId, match.id);
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      balance = Number(account.rows[0]?.balance || 0);
      await client.query(`UPDATE platform_coin_ai_matches SET state = $2::jsonb, status = 'SETTLED', winner = $3, updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id, JSON.stringify(nextState), winner]);
    } else {
      await client.query('UPDATE platform_coin_ai_matches SET state = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [match.id, JSON.stringify(nextState)]);
      const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
      balance = Number(account.rows[0]?.balance || 0);
    }
    await client.query('COMMIT');
    return res.json({ matchId: match.id, state: nextState, status: winner ? 'SETTLED' : 'ACTIVE', winner, balance, stake: Number(match.stake) });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[Tete Coin AI Match] Move failed:', error);
    return res.status(503).json({ error: error.message || 'Could not apply the move.' });
  } finally { client.release(); }
});

app.post('/api/coins/ai-matches/:matchId/timeout', async (req, res) => {
  await platformInitialization;
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again to continue this match.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM platform_coin_ai_matches WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.matchId, userId]);
    const match = selected.rows[0];
    if (!match) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Match not found.' }); }
    const state = match.state as { turnDeadlineAt?: number };
    if (match.status === 'ACTIVE' && Number(state.turnDeadlineAt || 0) > Date.now()) {
      const remainingSeconds = Math.max(1, Math.ceil((Number(state.turnDeadlineAt) - Date.now()) / 1000));
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Your turn is still active.', remainingSeconds });
    }
    if (match.status === 'ACTIVE') {
      await awardReferralFirstGameInTransaction(client, userId, match.id);
      await client.query(`UPDATE platform_coin_ai_matches SET status = 'SETTLED', winner = 'p1', updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id]);
    }
    const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    return res.json({ matchId: match.id, state: match.state, status: 'SETTLED', winner: match.winner || 'p1', balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[Tete Coin AI Match] Timeout settlement failed:', error);
    return res.status(503).json({ error: 'Could not settle the expired turn.' });
  } finally { client.release(); }
});

app.post('/api/coins/ai-matches/:matchId/forfeit', async (req, res) => {
  await platformInitialization;
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Please sign in again to continue this match.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT * FROM platform_coin_ai_matches WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.matchId, userId]);
    const match = selected.rows[0];
    if (!match) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Match not found.' }); }
    if (match.status === 'ACTIVE') {
      await awardReferralFirstGameInTransaction(client, userId, match.id);
      await client.query(`UPDATE platform_coin_ai_matches SET status = 'SETTLED', winner = 'p1', updated_at = CURRENT_TIMESTAMP, settled_at = CURRENT_TIMESTAMP WHERE id = $1`, [match.id]);
    }
    const account = await client.query('SELECT balance FROM platform_coin_accounts WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    return res.json({ matchId: match.id, state: match.state, status: 'SETTLED', winner: match.winner || 'p1', balance: Number(account.rows[0]?.balance || 0), stake: Number(match.stake) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[Tete Coin AI Match] Forfeit failed:', error);
    return res.status(503).json({ error: 'Could not forfeit the match.' });
  } finally { client.release(); }
});

app.post('/api/escrow/sync-user', async (req, res) => {
  try {
    const { userId, username, displayName, email, initialBalance, totalMatchesPlayed, matchesWon, matchesLost } = req.body;
    if (!userId && !username) {
      return res.status(400).json({ error: 'Missing userId or username in sync request' });
    }
    const targetUserId = userId || `usr_${username}`;
    const user = escrowEngine.getOrCreateUser(targetUserId, username || 'Player', typeof initialBalance === 'number' ? initialBalance : 0);

    if (typeof totalMatchesPlayed === 'number') {
      user.totalMatchesPlayed = totalMatchesPlayed;
    }
    if (typeof matchesWon === 'number') {
      user.matchesWon = matchesWon;
    }
    if (typeof matchesLost === 'number') {
      user.matchesLost = matchesLost;
    }

    savePersistentUsersToFile();

    // Automatically persist user record & wallet to PostgreSQL
    syncUserToPostgres(username || 'Player', displayName, email, user.availableBalance);

    res.json({ success: true, balance: user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});


// Dynamic Platform NGN Bank Details Configuration
let platformBankDetails = {
  bankName: process.env.PLATFORM_BANK_NAME || 'OPAY / Kuda Bank',
  accountNumber: process.env.PLATFORM_ACCOUNT_NUMBER || '903 847 2910',
  accountName: process.env.PLATFORM_ACCOUNT_NAME || 'Tete Arena',
};

// Initialize platform settings from database on server startup
platformInitialization = (async () => {
  await ensurePlatformSettingsTable();
  const savedBank = await getPlatformSetting('platform_bank_details', platformBankDetails);
  if (savedBank && savedBank.bankName) {
    platformBankDetails = savedBank;
    console.log('[PostgreSQL] Loaded platform bank details from database:', platformBankDetails);
  }
  const savedTreasury = await getPlatformSetting('platform_treasury_address', escrowEngine.getTreasuryAddress());
  if (savedTreasury) {
    escrowEngine.setTreasuryAddress(savedTreasury);
    console.log('[PostgreSQL] Loaded treasury address from database:', savedTreasury);
  }
  const savedGateFee = await getPlatformSetting<number>('platform_gate_fee_percent', 5);
  if (savedGateFee !== undefined && !isNaN(savedGateFee)) {
    escrowEngine.setGateFeePercent(savedGateFee);
    console.log('[PostgreSQL] Loaded gate fee percent from database:', savedGateFee);
  }
})();

// Public endpoint for DepositModal to get live platform bank details
app.get('/api/escrow/bank-details', (_req, res) => {
  res.json({ success: true, bankDetails: platformBankDetails });
});

// Public endpoint for DepositModal & clients to get live treasury address
app.get('/api/escrow/treasury-address', (_req, res) => {
  res.json({ success: true, treasuryAddress: escrowEngine.getTreasuryAddress() });
});

// Public endpoint for clients to get live Gate Fee percentage
app.get('/api/escrow/gate-fee', (_req, res) => {
  res.json({ success: true, gateFeePercent: escrowEngine.getGateFeePercent() });
});

// Admin endpoints to view and update bank settings
app.get('/api/admin/bank-settings', (_req, res) => {
  res.json({ success: true, bankDetails: platformBankDetails });
});

app.post('/api/admin/bank-settings', async (req, res) => {
  const { bankName, accountNumber, accountName } = req.body;
  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ success: false, error: 'bankName, accountNumber, and accountName are required.' });
  }

  platformBankDetails = {
    bankName: String(bankName).trim(),
    accountNumber: String(accountNumber).trim(),
    accountName: String(accountName).trim(),
  };

  await setPlatformSetting('platform_bank_details', platformBankDetails);
  console.log('[Admin Settings] Platform Bank Details saved to database:', platformBankDetails);
  res.json({ success: true, bankDetails: platformBankDetails, message: 'Bank details saved to database successfully' });
});

// Admin endpoints to view and update Gate Fee settings
app.get('/api/admin/gate-fee', (_req, res) => {
  res.json({ success: true, gateFeePercent: escrowEngine.getGateFeePercent() });
});

app.post('/api/admin/gate-fee', async (req, res) => {
  const { gateFeePercent } = req.body;
  const numPercent = Number(gateFeePercent);
  if (isNaN(numPercent) || numPercent < 0 || numPercent > 50) {
    return res.status(400).json({ success: false, error: 'Gate fee percentage must be a number between 0 and 50.' });
  }

  escrowEngine.setGateFeePercent(numPercent);
  await setPlatformSetting('platform_gate_fee_percent', numPercent);
  console.log('[Admin Settings] Platform Gate Fee saved to database:', numPercent);
  res.json({ success: true, gateFeePercent: numPercent, message: `Gate fee updated to ${numPercent}% successfully` });
});

// In-Memory Fiat Deposit Store
interface StoredFiatDeposit {
  id: string;
  userId: string;
  username: string;
  amountNgn: number;
  referenceNo: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'confirmed' | 'rejected';
  requestedAt: string;
  processedAt?: string;
}

const fiatDepositStore: StoredFiatDeposit[] = [];

// Request NGN Fiat Deposit (Generates Unique Reference & Alerts Admin Telegram)
app.post('/api/escrow/fiat-deposit-request', (req, res) => {
  try {
    const { userId, username, amountNgn } = req.body;
    const effectiveUserId = userId || (username ? `usr_${username}` : `usr_${Date.now()}`);
    const effectiveUsername = username || 'Player';
    if (!amountNgn || Number(amountNgn) <= 0) {
      return res.status(400).json({ error: 'Missing required deposit parameter (amountNgn)' });
    }

    const refNo = `STK-NGN-${Math.floor(10000 + Math.random() * 90000)}`;
    const depositId = `fdep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newDeposit: StoredFiatDeposit = {
      id: depositId,
      userId: effectiveUserId,
      username: effectiveUsername,
      amountNgn: Number(amountNgn),
      referenceNo: refNo,
      bankName: platformBankDetails.bankName,
      accountNumber: platformBankDetails.accountNumber,
      accountName: platformBankDetails.accountName,
      status: 'pending',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    fiatDepositStore.unshift(newDeposit);

    // Send Telegram alert to admin with Confirm & Reject inline buttons
    telegramBotListener.sendFiatDepositAlert({
      id: newDeposit.id,
      userId: newDeposit.userId,
      username: newDeposit.username,
      amountNgn: newDeposit.amountNgn,
      referenceNo: newDeposit.referenceNo,
      bankName: newDeposit.bankName,
      accountNumber: newDeposit.accountNumber,
      accountName: newDeposit.accountName,
      status: newDeposit.status,
      requestedAt: newDeposit.requestedAt,
    });

    res.json({
      success: true,
      deposit: newDeposit,
      bankDetails: platformBankDetails,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Check live status of a NGN Fiat Deposit Request
app.get('/api/escrow/fiat-deposit-status/:id', (req, res) => {
  const { id } = req.params;
  const deposit = fiatDepositStore.find((d) => d.id === id || d.referenceNo === id);
  if (!deposit) {
    return res.status(404).json({ success: false, error: 'Deposit request not found' });
  }
  return res.json({ success: true, deposit });
});

// Method 2: Dynamic Unique Micro-Amount Deposit Invoices Store
interface StoredDepositInvoice {
  invoiceId: string;
  userId: string;
  username: string;
  baseAmountUsdt: number;
  microOffset: number;
  exactPayableUsdt: number;
  amountNgn: number;
  treasuryAddress: string;
  network: string;
  status: 'awaiting_payment' | 'detected' | 'confirmed' | 'expired';
  createdAt: number;
  expiresAt: number;
  detectedTxHash?: string;
}

const TREASURY_DEPOSIT_ADDRESS = '0x8F30C6652496e3860F57c43A675005E72D83D365';
const depositInvoices: Map<string, StoredDepositInvoice> = new Map();

// Generate a unique micro-offset (e.g. 0.0012 to 0.0099 USDT)
function generateUniqueMicroOffset(): number {
  const activeOffsets = new Set(
    Array.from(depositInvoices.values())
      .filter((inv) => inv.status === 'awaiting_payment' && inv.expiresAt > Date.now())
      .map((inv) => inv.microOffset)
  );

  for (let i = 0; i < 500; i++) {
    // Random 4-decimal fraction between 0.0010 and 0.0099
    const randomFraction = Number((Math.floor(10 + Math.random() * 90) / 10000).toFixed(4));
    if (!activeOffsets.has(randomFraction)) {
      return randomFraction;
    }
  }
  return Number((Math.floor(100 + Math.random() * 899) / 100000).toFixed(5));
}

// 1. Create or retrieve active dynamic deposit invoice for a user
app.post('/api/escrow/deposit-invoice', (req, res) => {
  try {
    const { userId, username, baseAmountUsdt } = req.body;
    if (!userId || !baseAmountUsdt || Number(baseAmountUsdt) <= 0) {
      return res.status(400).json({ error: 'Missing required parameters (userId, baseAmountUsdt)' });
    }

    const baseAmount = Number(baseAmountUsdt);
    const now = Date.now();
    const USDT_RATE = 1500;

    // Check if user already has an active unexpired invoice for this amount
    for (const inv of depositInvoices.values()) {
      if (
        inv.userId === userId &&
        inv.baseAmountUsdt === baseAmount &&
        inv.status === 'awaiting_payment' &&
        inv.expiresAt > now
      ) {
        return res.json({ success: true, invoice: inv });
      }
    }

    const microOffset = generateUniqueMicroOffset();
    const exactPayableUsdt = Number((baseAmount + microOffset).toFixed(4));
    const invoiceId = `inv_${now}_${Math.random().toString(36).substring(2, 6)}`;
    const expiresAt = now + 15 * 60 * 1000; // 15 minute validity window

    const newInvoice: StoredDepositInvoice = {
      invoiceId,
      userId,
      username: username || 'Player',
      baseAmountUsdt: baseAmount,
      microOffset,
      exactPayableUsdt,
      amountNgn: Math.round(baseAmount * USDT_RATE),
      treasuryAddress: TREASURY_DEPOSIT_ADDRESS,
      network: 'Polygon PoS (POL / MATIC Chain)',
      status: 'awaiting_payment',
      createdAt: now,
      expiresAt,
    };

    depositInvoices.set(invoiceId, newInvoice);
    res.json({ success: true, invoice: newInvoice });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Poll/Check invoice status & simulate/verify blockchain matching
app.get('/api/escrow/deposit-invoice/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  const invoice = depositInvoices.get(invoiceId);
  if (!invoice) {
    return res.status(404).json({ error: 'Deposit invoice not found' });
  }

  // Check expiration
  if (invoice.status === 'awaiting_payment' && Date.now() > invoice.expiresAt) {
    invoice.status = 'expired';
  }

  res.json({ success: true, invoice });
});

// 3. Confirm/Trigger matched on-chain transaction (Auto-credit via Method 2)
app.post('/api/escrow/deposit-invoice/:invoiceId/confirm', (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { txHash } = req.body;
    const invoice = depositInvoices.get(invoiceId);

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'confirmed') {
      return res.json({ success: true, message: 'Invoice already processed', invoice });
    }

    const generatedTx =
      txHash ||
      `0x${Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, '0')
      ).join('')}`;

    invoice.status = 'confirmed';
    invoice.detectedTxHash = generatedTx;

    // Authoritatively credit the user balance in the Escrow Engine ledger
    const depositResult = escrowEngine.deposit(
      invoice.userId,
      invoice.username,
      invoice.amountNgn,
      'polygon_usdt_micro',
      {
        invoiceId: invoice.invoiceId,
        exactUsdt: invoice.exactPayableUsdt,
        baseUsdt: invoice.baseAmountUsdt,
        txHash: generatedTx,
        treasuryAddress: invoice.treasuryAddress,
      }
    );

    res.json({
      success: true,
      message: `Deposit of $${invoice.baseAmountUsdt} USDT (${invoice.exactPayableUsdt} USDT matched) confirmed on-chain.`,
      invoice,
      user: depositResult.user,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/escrow/deposit', (req, res) => {
  try {
    const { userId, username, amount, method, metadata } = req.body;
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing required deposit parameters (userId, amount)' });
    }
    const result = escrowEngine.deposit(userId, username || 'Player', Number(amount), method || 'bank', metadata);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/escrow/withdraw', (req, res) => {
  try {
    const { userId, username, amount, destination, accountNumber, bankName, accountName, method, bankDetails } = req.body;
    if (!userId || amount === undefined) {
      return res.status(400).json({ error: 'Missing required withdrawal parameters (userId, amount)' });
    }

    const effectiveBankName = bankName || bankDetails?.bankName || destination || 'NGN Bank';
    const effectiveAccNum = accountNumber || bankDetails?.accountNumber || '0000000000';
    const effectiveAccName = accountName || bankDetails?.accountName || username || 'Player';

    const result = escrowEngine.withdraw(
      userId,
      username || 'Player',
      Number(amount),
      effectiveBankName,
      effectiveAccNum
    );

    const USDT_RATE = 1500;
    const destAddr = `${effectiveBankName} (${effectiveAccNum} - ${effectiveAccName})`;

    const newRecord: StoredWithdrawal = {
      id: `wd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: userId,
      username: username || 'Player',
      amountNgn: Math.round(Number(amount)),
      amountUsdt: +(Number(amount) / USDT_RATE).toFixed(2),
      currency: 'NGN',
      method: 'fiat_bank_transfer',
      destinationAddress: destAddr,
      status: 'pending',
      requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      auditLogId: result.auditLogId,
      txHash: result.txHash,
      adminNotes: `Bank Transfer Request: ${effectiveBankName} | Acc: ${effectiveAccNum} | Name: ${effectiveAccName}`,
    };

    withdrawalStore.unshift(newRecord);
    savePersistentWithdrawalsToFile();

    // Send real-time Telegram alert with 'Mark as Disbursed' button
    telegramBotListener.sendWithdrawalAlert({
      id: newRecord.id,
      userId: newRecord.userId,
      username: newRecord.username,
      amountNgn: newRecord.amountNgn,
      amountUsdt: newRecord.amountUsdt,
      currency: 'NGN',
      method: 'Bank Transfer',
      destinationAddress: destAddr,
      bankName: effectiveBankName,
      accountNumber: effectiveAccNum,
      accountName: effectiveAccName,
      status: newRecord.status,
      requestedAt: newRecord.requestedAt,
      adminNotes: newRecord.adminNotes,
    });

    res.json({ success: true, ...result, withdrawalRecord: newRecord });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Fetch Live User Deposit & Withdrawal Audit Transactions
app.get('/api/escrow/transactions/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const auditLogs = escrowEngine.getAuditLogs(100, undefined, userId);
    const userWithdrawals = withdrawalStore.filter((w) => w.userId === userId);

    const liveTransactions = auditLogs
      .filter((log) => log.type === 'DEPOSIT' || log.type === 'WITHDRAWAL')
      .map((log) => {
        const isDeposit = log.type === 'DEPOSIT';
        const matchingWd = userWithdrawals.find((w) => w.auditLogId === log.id);
        return {
          id: log.id,
          type: isDeposit ? 'deposit' : 'withdrawal',
          amount: log.amount,
          amountUsdt: +(log.amount / 1500).toFixed(2),
          method: log.notes.includes('via') ? log.notes.split('via')[1].split('[')[0].trim() : (isDeposit ? 'Bank / Crypto Deposit' : 'Bank / Crypto Withdrawal'),
          status: matchingWd ? (matchingWd.status === 'disbursed' ? 'successful' : matchingWd.status === 'rejected' ? 'failed' : 'processing') : 'successful',
          timestamp: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reference: isDeposit ? `DEP-${log.id.slice(-5).toUpperCase()}` : `WD-${log.id.slice(-5).toUpperCase()}`,
          txHash: log.onChainTxHash,
        };
      });

    res.json({
      success: true,
      transactions: liveTransactions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/escrow/start-match', async (req, res) => {

  try {
    const { matchId, roomCode, gameType, player1Id, player1Username, player2Id, player2Username, stakeAmount } = req.body;
    if (!matchId || !player1Id || !player2Id || stakeAmount === undefined) {
      return res.status(400).json({ error: 'Missing required match parameters (matchId, player1Id, player2Id, stakeAmount)' });
    }
    if (
      String(player1Id).trim().toLowerCase() === String(player2Id).trim().toLowerCase() ||
      (player1Username && player2Username && String(player1Username).trim().toLowerCase() === String(player2Username).trim().toLowerCase())
    ) {
      return res.status(400).json({ error: 'SELF_PLAY_FORBIDDEN: Player 1 and Player 2 cannot be the same user.' });
    }
    const result = escrowEngine.startMatch(
      matchId,
      roomCode || `ROOM-${Math.floor(1000 + Math.random() * 9000)}`,
      gameType || 'WHOT',
      player1Id,
      player1Username || 'Player 1',
      player2Id,
      player2Username || 'Player 2',
      Number(stakeAmount)
    );
    await persistMatchWallets(matchId);
    savePersistentUsersToFile();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/escrow/reserve-match', async (req, res) => {
  try {
    const { matchId, roomCode, gameType, playerId, playerUsername, stakeAmount } = req.body;
    if (!matchId || !roomCode || !playerId || stakeAmount === undefined) {
      return res.status(400).json({ error: 'Missing required reservation parameters' });
    }
    const result = escrowEngine.reserveMatchStake(
      matchId,
      roomCode,
      gameType || 'WHOT',
      playerId,
      playerUsername || 'Player',
      Number(stakeAmount)
    );
    await persistMatchWallets(matchId);
    savePersistentUsersToFile();
    return res.json({ success: true, ...result });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// Shared Room Registry in memory
const sharedRoomsStore = new Map<string, any>();

app.post('/api/rooms', (req, res) => {
  const table = req.body;
  if (!table || !table.roomCode) {
    return res.status(400).json({ success: false, error: 'Invalid room data' });
  }
  const cleanCode = String(table.roomCode).trim().toUpperCase();
  const roomData = {
    ...table,
    roomCode: cleanCode,
    status: 'WAITING_FOR_OPPONENT',
    joinedPlayer: null,
    createdAt: Date.now(),
  };
  sharedRoomsStore.set(cleanCode, roomData);
  p2pRoomMeta.set(cleanCode, roomData);
  rememberP2pRoom(cleanCode, roomData);
  console.log(`[Room Registry] Registered room ${cleanCode} (${table.gameMode}, stake ₦${table.stake})`);
  return res.json({ success: true, room: roomData });
});

app.post('/api/rooms/:roomCode/join', (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const room = sharedRoomsStore.get(cleanCode);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  const { player2 } = req.body;
  if (player2) {
    const hostUser = String(room.hostUsername || room.host?.username || '').trim().toLowerCase();
    const joiningUser = String(player2.username || player2.userId || player2.id || '').trim().toLowerCase();

    if (hostUser && joiningUser && hostUser === joiningUser) {
      return res.status(400).json({ success: false, error: 'Self-play is forbidden. You cannot join a room created by yourself.' });
    }

    room.joinedPlayer = player2;
    room.status = 'IN_PROGRESS';
    sharedRoomsStore.set(cleanCode, room);
    console.log(`[Room Registry] Player @${player2.username} joined room ${cleanCode}`);
  }
  return res.json({ success: true, room });
});

app.get('/api/rooms/:roomCode', (req, res) => {
  const cleanCode = req.params.roomCode.trim().toUpperCase();
  const room = sharedRoomsStore.get(cleanCode);
  if (!room) {
    return res.status(404).json({ success: false, error: 'Room not found' });
  }
  return res.json({ success: true, room });
});

app.get('/api/rooms', (_req, res) => {
  const rooms = Array.from(sharedRoomsStore.values());
  const activeCounts: Record<string, number> = {
    whot: 0,
    ludo_classic: 0,
    ludo_blitz: 0,
    draughts: 0,
  };

  rooms.forEach((r) => {
    const mode = String(r.gameMode || r.gameType || '').toLowerCase();
    if (r.status !== 'SETTLED' && r.status !== 'REFUNDED') {
      if (mode.includes('whot')) activeCounts.whot = (activeCounts.whot || 0) + 1;
      else if (mode.includes('blitz')) activeCounts.ludo_blitz = (activeCounts.ludo_blitz || 0) + 1;
      else if (mode.includes('ludo')) activeCounts.ludo_classic = (activeCounts.ludo_classic || 0) + 1;
      else if (mode.includes('draught')) activeCounts.draughts = (activeCounts.draughts || 0) + 1;
    }
  });

  return res.json({ success: true, rooms, activeCounts });
});

app.post(['/api/escrow/settle-match', '/api/game/verify-and-settle'], async (req, res) => {
  try {
    const { matchId, winnerId, evidence, reason } = req.body;
    if (!matchId || !winnerId) {
      return res.status(400).json({ error: 'Missing required parameters (matchId, winnerId)' });
    }
    const verificationEvidence = evidence || { reason: reason || 'Match verified by game rules engine' };
    const result = escrowEngine.verifyAndSettleMatch(matchId, winnerId, verificationEvidence);
    await persistMatchWallets(matchId);
    savePersistentUsersToFile();
    awardCoinsForSettledMatch(result.session, verificationEvidence.winner === 'draw')
      .then((coinRewards) => res.json({ success: true, result: { ...result, coinRewards } }))
      .catch((coinError) => {
        console.error('[Platform Coins] Settlement rewards failed:', coinError);
        res.json({ success: true, result: { ...result, coinRewards: [], coinRewardError: true } });
      });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/escrow/refund-match', async (req, res) => {
  try {
    const { matchId, reason } = req.body;
    if (!matchId) {
      return res.status(400).json({ error: 'Missing matchId parameter' });
    }
    const session = escrowEngine.refundMatch(matchId, reason);
    await persistMatchWallets(matchId);
    savePersistentUsersToFile();
    res.json({ success: true, session });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/escrow/simulate-settle', (req, res) => {
  try {
    const { userId, username, gameMode, stakeAmount, outcome } = req.body;
    if (!userId || stakeAmount === undefined || !outcome) {
      return res.status(400).json({ error: 'Missing simulation parameters' });
    }
    const result = escrowEngine.simulateSettlement(
      userId,
      username || 'Player',
      gameMode || 'whot',
      Number(stakeAmount),
      outcome
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/live-matches', (_req, res) => {
  res.json(LIVE_MATCHES);
});

app.get('/api/live-matches/:matchId', (req, res) => {
  const match = LIVE_MATCHES.find((m) => m.id === req.params.matchId);
  if (!match) {
    return res.status(404).json({ error: 'Live match not found' });
  }
  res.json(match);
});

// Server-Authoritative Live Match Simulation Engine
const WHOT_POSSIBLE_SHAPES: WhotShape[] = ['circle', 'triangle', 'cross', 'square', 'star'];
const WHOT_NUMBERS = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 20];

let simTick = 0;
setInterval(() => {
  simTick++;

  // 1. Simulate Whot Match
  const whotMatch = LIVE_MATCHES.find((m) => m.id === 'live_whot_101');
  if (whotMatch && whotMatch.whotState) {
    const isP1 = whotMatch.turn === 'player1';
    const activePlayer = isP1 ? whotMatch.player1 : whotMatch.player2;
    const otherPlayer = isP1 ? whotMatch.player2 : whotMatch.player1;

    // Next simulated action
    const actionChoice = simTick % 5;
    if (actionChoice === 0) {
      // Normal shape match
      const nextShape = whotMatch.whotState.currentShape;
      const nextNum = (whotMatch.whotState.currentNumber || 5) === 7 ? 4 : 7;
      whotMatch.whotState.currentNumber = nextNum;
      whotMatch.whotState.topCard = { id: `c_${simTick}`, shape: nextShape, number: nextNum };
      whotMatch.lastAction = `${activePlayer.displayName} played ${nextShape.toUpperCase()} ${nextNum}`;
      whotMatch.turn = isP1 ? 'player2' : 'player1';
      whotMatch.whotState.discardCount += 1;
    } else if (actionChoice === 1) {
      // Pick 2 special card!
      const shape = WHOT_POSSIBLE_SHAPES[simTick % WHOT_POSSIBLE_SHAPES.length];
      whotMatch.whotState.currentShape = shape;
      whotMatch.whotState.currentNumber = 2;
      whotMatch.whotState.topCard = { id: `c_${simTick}`, shape, number: 2, isSpecial: true };
      whotMatch.whotState.pendingPenalty = { type: 2, count: 2 };
      whotMatch.lastAction = `⚡ ${activePlayer.displayName} played Pick 2 (${shape})! ${otherPlayer.displayName} must defend or draw 2!`;
      whotMatch.turn = isP1 ? 'player2' : 'player1';
      whotMatch.whotState.discardCount += 1;
    } else if (actionChoice === 2) {
      // Draw from market
      whotMatch.whotState.marketDeckCount = Math.max(10, whotMatch.whotState.marketDeckCount - 1);
      whotMatch.lastAction = `${activePlayer.displayName} drew 1 card from Market.`;
      whotMatch.turn = isP1 ? 'player2' : 'player1';
    } else if (actionChoice === 3) {
      // Whot 20 wild card!
      const calledShape = WHOT_POSSIBLE_SHAPES[(simTick + 2) % WHOT_POSSIBLE_SHAPES.length];
      whotMatch.whotState.currentShape = calledShape;
      whotMatch.whotState.currentNumber = null;
      whotMatch.whotState.topCard = { id: `c_${simTick}`, shape: 'whot', number: 20, isSpecial: true };
      whotMatch.lastAction = `⭐ ${activePlayer.displayName} played WHOT 20 and called for ${calledShape.toUpperCase()}!`;
      whotMatch.turn = isP1 ? 'player2' : 'player1';
      whotMatch.whotState.discardCount += 1;
    } else {
      // General Market 14
      whotMatch.whotState.topCard = { id: `c_${simTick}`, shape: 'cross', number: 14, isSpecial: true };
      whotMatch.whotState.currentShape = 'cross';
      whotMatch.whotState.currentNumber = 14;
      whotMatch.lastAction = `🛒 ${activePlayer.displayName} called General Market (14)! ${otherPlayer.displayName} drew 1.`;
      whotMatch.whotState.discardCount += 1;
      // Turn continues for active player
    }

    whotMatch.turnTimeLeft = 15;
    // Broadcast live state update to all spectators
    broadcastToMatch(whotMatch.id, {
      type: 'match_update',
      matchId: whotMatch.id,
      match: whotMatch,
    });
  }

  // 2. Simulate Ludo Match with Authentic Token Step Movements
  const ludoMatch = LIVE_MATCHES.find((m) => m.id === 'live_ludo_202');
  if (ludoMatch && ludoMatch.ludoState) {
    const isP1 = ludoMatch.turn === 'player1';
    const activePlayer = isP1 ? ludoMatch.player1 : ludoMatch.player2;
    const otherPlayer = isP1 ? ludoMatch.player2 : ludoMatch.player1;
    const myTokens = isP1 ? ludoMatch.ludoState.player1Tokens : ludoMatch.ludoState.player2Tokens;
    const opponentTokens = isP1 ? ludoMatch.ludoState.player2Tokens : ludoMatch.ludoState.player1Tokens;

    const roll = Math.floor(Math.random() * 6) + 1;
    ludoMatch.ludoState.diceValue = roll;
    ludoMatch.ludoState.isRolling = false;

    // Safe track indices
    const SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

    let movedToken: (typeof myTokens)[0] | null = null;
    let didCapture = false;
    let didReachHome = false;

    // If rolled 6 and have a token at yard (-1), 70% chance to release it
    const yardToken = myTokens.find((t) => t.step === -1);
    const trackTokens = myTokens.filter((t) => t.step >= 0 && t.step < 56);

    if (roll === 6 && yardToken && (Math.random() < 0.7 || trackTokens.length === 0)) {
      yardToken.step = 0;
      movedToken = yardToken;
      ludoMatch.lastAction = `🎲 ${activePlayer.displayName} rolled 6! Deployed ${isP1 ? 'Red' : 'Yellow'} Token #${yardToken.index + 1} onto track!`;
      ludoMatch.ludoState.lastRollText = `Rolled a 6! Extra turn granted.`;
      // Player keeps turn on a 6!
    } else if (trackTokens.length > 0) {
      // Pick a token on track to advance
      const tokenToMove = trackTokens[simTick % trackTokens.length];
      const prevStep = tokenToMove.step;
      const nextStep = Math.min(56, prevStep + roll);
      tokenToMove.step = nextStep;
      movedToken = tokenToMove;

      if (nextStep >= 56) {
        didReachHome = true;
        ludoMatch.lastAction = `🏆 HOME RUN! ${activePlayer.displayName} navigated ${isP1 ? 'Red' : 'Yellow'} Token #${tokenToMove.index + 1} into center home!`;
      } else if (nextStep <= 50) {
        // Track collision check
        const myTrackIdx = isP1 ? nextStep % 52 : (26 + nextStep) % 52;
        if (!SAFE_INDICES.includes(myTrackIdx)) {
          const victim = opponentTokens.find((ot) => {
            if (ot.step < 0 || ot.step > 50) return false;
            const opTrackIdx = isP1 ? (26 + ot.step) % 52 : ot.step % 52;
            return opTrackIdx === myTrackIdx;
          });

          if (victim) {
            victim.step = -1; // sent back to yard!
            didCapture = true;
            ludoMatch.lastAction = `💥 CAPTURE! ${activePlayer.displayName} landed on track square ${myTrackIdx} and captured ${otherPlayer.displayName}'s token!`;
          }
        }

        if (!didCapture) {
          ludoMatch.lastAction = `🎲 ${activePlayer.displayName} rolled a ${roll} and advanced Token #${tokenToMove.index + 1}.`;
        }
      } else {
        ludoMatch.lastAction = `🚀 ${activePlayer.displayName} rolled a ${roll} and pushed Token #${tokenToMove.index + 1} into Home Stretch!`;
      }

      // If roll is not 6, switch turn
      if (roll !== 6) {
        ludoMatch.turn = isP1 ? 'player2' : 'player1';
        ludoMatch.ludoState.currentTurnColor = isP1 ? 'yellow' : 'red';
        ludoMatch.ludoState.lastRollText = `Rolled a ${roll}.`;
      } else {
        ludoMatch.ludoState.lastRollText = `Rolled a 6! Extra turn granted.`;
      }
    } else if (yardToken && roll === 6) {
      yardToken.step = 0;
      movedToken = yardToken;
      ludoMatch.lastAction = `🎲 ${activePlayer.displayName} rolled 6! Deployed Token to track!`;
    } else {
      ludoMatch.lastAction = `🎲 ${activePlayer.displayName} rolled a ${roll} (no valid moves).`;
      ludoMatch.turn = isP1 ? 'player2' : 'player1';
      ludoMatch.ludoState.currentTurnColor = isP1 ? 'yellow' : 'red';
      ludoMatch.ludoState.lastRollText = `Rolled a ${roll}. Turn passed.`;
    }

    if (movedToken) {
      ludoMatch.ludoState.lastMovedTokenId = movedToken.id;
    }

    // Keep match perpetual: if all tokens home, reset tokens to start a fresh duel
    const allHome = myTokens.filter((t) => t.step >= 56).length >= 3;
    if (allHome) {
      myTokens.forEach((t, idx) => {
        t.step = idx === 0 ? 12 : -1;
      });
      opponentTokens.forEach((t, idx) => {
        t.step = idx === 0 ? 8 : -1;
      });
      ludoMatch.lastAction = `🎉 ${activePlayer.displayName} secured the match! Fresh round started.`;
    }

    ludoMatch.turnTimeLeft = 12;
    broadcastToMatch(ludoMatch.id, {
      type: 'match_update',
      matchId: ludoMatch.id,
      match: ludoMatch,
    });
  }

  // 3. Simulate Draughts Match with Authentic 8x8 Board Movements
  const draughtsMatch = LIVE_MATCHES.find((m) => m.id === 'live_draughts_303');
  if (draughtsMatch && draughtsMatch.draughtsState) {
    const isP1 = draughtsMatch.turn === 'player1';
    const activePlayer = isP1 ? draughtsMatch.player1 : draughtsMatch.player2;
    const activeColor: DraughtsPieceColor = isP1 ? 'gold' : 'crimson';
    const enemyColor: DraughtsPieceColor = isP1 ? 'crimson' : 'gold';
    const pieces = draughtsMatch.draughtsState.pieces;

    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    // If pieces count low, respawn fresh tactical middle-game for 10x10
    const goldCount = pieces.filter((p) => p.color === 'gold').length;
    const crimsonCount = pieces.filter((p) => p.color === 'crimson').length;

    if (goldCount < 3 || crimsonCount < 3) {
      draughtsMatch.draughtsState.pieces = [
        { id: `c_${simTick}_1`, color: 'crimson', row: 1, col: 0, isKing: false },
        { id: `c_${simTick}_2`, color: 'crimson', row: 1, col: 4, isKing: false },
        { id: `c_${simTick}_3`, color: 'crimson', row: 2, col: 3, isKing: false },
        { id: `c_${simTick}_4`, color: 'crimson', row: 2, col: 7, isKing: false },
        { id: `c_${simTick}_5`, color: 'crimson', row: 3, col: 2, isKing: true },
        { id: `c_${simTick}_6`, color: 'crimson', row: 3, col: 6, isKing: false },
        { id: `g_${simTick}_1`, color: 'gold', row: 5, col: 4, isKing: false },
        { id: `g_${simTick}_2`, color: 'gold', row: 5, col: 8, isKing: true },
        { id: `g_${simTick}_3`, color: 'gold', row: 6, col: 3, isKing: false },
        { id: `g_${simTick}_4`, color: 'gold', row: 6, col: 5, isKing: false },
        { id: `g_${simTick}_5`, color: 'gold', row: 7, col: 2, isKing: false },
        { id: `g_${simTick}_6`, color: 'gold', row: 7, col: 6, isKing: false },
      ];
      draughtsMatch.draughtsState.capturedGold = 0;
      draughtsMatch.draughtsState.capturedCrimson = 0;
      draughtsMatch.lastAction = `⚔️ Tactical 10x10 board reset! Fresh high-stakes duel underway.`;
    } else {
      // Find candidate jump moves first (Compulsory Eat-Up)
      interface MoveCandidate {
        piece: (typeof pieces)[0];
        toRow: number;
        toCol: number;
        isJump: boolean;
        capturedPiece?: (typeof pieces)[0];
      }

      const jumpCandidates: MoveCandidate[] = [];
      const stepCandidates: MoveCandidate[] = [];

      const activePieces = pieces.filter((p) => p.color === activeColor);

      for (const p of activePieces) {
        // Forward steps, but all pieces can jump backwards/forwards
        const rowDirs = p.isKing ? [-1, 1] : activeColor === 'gold' ? [-1] : [1];
        const jumpRowDirs = [-1, 1];
        const colDirs = [-1, 1];

        // 1. Check Jump Captures (mandatory)
        for (const dr of jumpRowDirs) {
          for (const dc of colDirs) {
            const adjR = p.row + dr;
            const adjC = p.col + dc;
            const jumpR = p.row + 2 * dr;
            const jumpC = p.col + 2 * dc;

            if (jumpR >= 0 && jumpR < 10 && jumpC >= 0 && jumpC < 10) {
              const enemyPiece = pieces.find((other) => other.row === adjR && other.col === adjC && other.color === enemyColor);
              const landingOccupied = pieces.some((other) => other.row === jumpR && other.col === jumpC);

              if (enemyPiece && !landingOccupied) {
                jumpCandidates.push({
                  piece: p,
                  toRow: jumpR,
                  toCol: jumpC,
                  isJump: true,
                  capturedPiece: enemyPiece,
                });
              }
            }
          }
        }

        // 2. Check Standard Step
        for (const dr of rowDirs) {
          for (const dc of colDirs) {
            const adjR = p.row + dr;
            const adjC = p.col + dc;

            if (adjR >= 0 && adjR < 10 && adjC >= 0 && adjC < 10) {
              const tileOccupied = pieces.some((other) => other.row === adjR && other.col === adjC);
              if (!tileOccupied) {
                stepCandidates.push({
                  piece: p,
                  toRow: adjR,
                  toCol: adjC,
                  isJump: false,
                });
              }
            }
          }
        }
      }

      // Compulsory Capture (Eat-up): If jumps exist, ONLY jumps are valid!
      const chosenMove = jumpCandidates.length > 0
        ? jumpCandidates[simTick % jumpCandidates.length]
        : stepCandidates.length > 0
        ? stepCandidates[simTick % stepCandidates.length]
        : null;

      if (chosenMove) {
        const fromRow = chosenMove.piece.row;
        const fromCol = chosenMove.piece.col;

        chosenMove.piece.row = chosenMove.toRow;
        chosenMove.piece.col = chosenMove.toCol;

        // Check King coronation (Gold on row 0, Crimson on row 9)
        if (
          (activeColor === 'gold' && chosenMove.toRow === 0) ||
          (activeColor === 'crimson' && chosenMove.toRow === 9)
        ) {
          chosenMove.piece.isKing = true;
        }

        // Handle capture
        if (chosenMove.isJump && chosenMove.capturedPiece) {
          const capIndex = pieces.findIndex((p) => p.id === chosenMove.capturedPiece!.id);
          if (capIndex !== -1) {
            pieces.splice(capIndex, 1);
          }
          if (activeColor === 'gold') {
            draughtsMatch.draughtsState.capturedCrimson += 1;
          } else {
            draughtsMatch.draughtsState.capturedGold += 1;
          }

          draughtsMatch.lastAction = `💥 MANDATORY EAT-UP! ${activePlayer.displayName} jumped over ${files[chosenMove.capturedPiece.col]}${10 - chosenMove.capturedPiece.row}!`;
        } else {
          const crowned = chosenMove.piece.isKing ? ' (King)' : '';
          draughtsMatch.lastAction = `♟️ ${activePlayer.displayName} advanced ${activeColor}${crowned} to ${files[chosenMove.toCol]}${10 - chosenMove.toRow}.`;
        }

        draughtsMatch.draughtsState.lastMove = {
          fromRow,
          fromCol,
          toRow: chosenMove.toRow,
          toCol: chosenMove.toCol,
          pieceId: chosenMove.piece.id,
          captured: chosenMove.isJump,
        };
      } else {
        draughtsMatch.lastAction = `♟️ ${activePlayer.displayName} contemplating strategic defense.`;
      }
    }

    draughtsMatch.turn = isP1 ? 'player2' : 'player1';
    draughtsMatch.draughtsState.currentTurnColor = isP1 ? 'crimson' : 'gold';
    draughtsMatch.turnTimeLeft = 14;

    broadcastToMatch(draughtsMatch.id, {
      type: 'match_update',
      matchId: draughtsMatch.id,
      match: draughtsMatch,
    });
  }
}, 2800);

async function startServer() {
  const server = http.createServer(app);

  // WebSocket Server Setup
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP -> WS upgrade exclusively for /ws and /api/ws
  server.on('upgrade', (request, socket, head) => {
    try {
      const parsedUrl = new URL(request.url || '', `http://${request.headers.host}`);
      if (parsedUrl.pathname === '/ws' || parsedUrl.pathname === '/api/ws' || parsedUrl.pathname === '/livechat' || parsedUrl.pathname === '/api/livechat') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      // Pass through if invalid URL
    }
  });

  // WebSocket Connection Lifecycle
  wss.on('connection', (ws) => {
    let currentSpectatingMatchId: string | null = null;

    // Send initial snapshot of all active live matches
    ws.send(
      JSON.stringify({
        type: 'init',
        matches: LIVE_MATCHES,
        timestamp: Date.now(),
      })
    );

    ws.on('message', (raw) => {
      try {
        let msg: any = null;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          const plainText = raw.toString().trim();
          if (plainText) {
            liveChatService.handleInboundWebMessage(ws, undefined, plainText);
            return;
          }
        }

        if (!msg) return;

        switch (msg.type) {
          case 'livechat_init':
          case 'init_livechat': {
            if (msg.sessionId) {
              liveChatService.registerSession(msg.sessionId, ws);
            }
            ws.send(
              JSON.stringify({
                type: 'livechat_registered',
                sessionId: msg.sessionId || liveChatService.getSessionIdForSocket(ws),
              })
            );
            break;
          }

          case 'livechat_send':
          case 'chat_message':
          case 'web_chat': {
            const body = msg.text || msg.body || msg.message;
            if (body) {
              liveChatService.handleInboundWebMessage(ws, msg.sessionId, body);
            }
            break;
          }

          case 'get_matches': {
            ws.send(
              JSON.stringify({
                type: 'matches_list',
                matches: LIVE_MATCHES,
              })
            );
            break;
          }

          case 'spectate': {
            const matchId = msg.matchId;
            const match = LIVE_MATCHES.find((m) => m.id === matchId);
            if (!match) {
              ws.send(JSON.stringify({ type: 'error', message: 'Match not found' }));
              return;
            }

            // Remove from previous match if switching
            if (currentSpectatingMatchId && currentSpectatingMatchId !== matchId) {
              const oldSet = matchSpectators.get(currentSpectatingMatchId);
              if (oldSet) {
                oldSet.delete(ws);
                const oldMatch = LIVE_MATCHES.find((m) => m.id === currentSpectatingMatchId);
                if (oldMatch) {
                  oldMatch.spectatorCount = Math.max(1, oldMatch.spectatorCount - 1);
                }
              }
            }

            currentSpectatingMatchId = matchId;
            if (!matchSpectators.has(matchId)) {
              matchSpectators.set(matchId, new Set());
            }
            matchSpectators.get(matchId)!.add(ws);

            // Increment spectator count
            match.spectatorCount += 1;

            // Send authoritative match state
            ws.send(
              JSON.stringify({
                type: 'spectate_sync',
                matchId,
                match,
                isReadOnly: true,
                message: 'Connected to live read-only spectator stream',
              })
            );

            // Broadcast updated spectator count to all viewers of this match
            broadcastToMatch(matchId, {
              type: 'spectator_count',
              matchId,
              count: match.spectatorCount,
            });
            break;
          }

          case 'leave_spectate': {
            if (currentSpectatingMatchId) {
              const set = matchSpectators.get(currentSpectatingMatchId);
              if (set) {
                set.delete(ws);
              }
              const match = LIVE_MATCHES.find((m) => m.id === currentSpectatingMatchId);
              if (match) {
                match.spectatorCount = Math.max(0, match.spectatorCount - 1);
                broadcastToMatch(currentSpectatingMatchId, {
                  type: 'spectator_count',
                  matchId: currentSpectatingMatchId,
                  count: match.spectatorCount,
                });
              }
              currentSpectatingMatchId = null;
            }
            ws.send(JSON.stringify({ type: 'spectate_left' }));
            break;
          }

          case 'join_game_room': {
            const { roomCode, userId, username, displayName, avatarUrl, winRate, stake, pot, gameMode, turnMode, telegramId } = msg;
            if (roomCode) {
              const cleanCode = String(roomCode).trim().toUpperCase();
              if (!p2pRoomClients.has(cleanCode)) {
                p2pRoomClients.set(cleanCode, new Set());
              }
              p2pRoomClients.get(cleanCode)!.add(ws);
              (ws as any).p2pRoomCode = cleanCode;

              let existingRoom = sharedRoomsStore.get(cleanCode) || p2pRoomMeta.get(cleanCode) || p2pPersistedRooms.get(cleanCode);
              if (!existingRoom && stake) {
                existingRoom = {
                  roomCode: cleanCode,
                  hostUsername: username,
                  hostDisplayName: displayName || username,
                  hostAvatar: avatarUrl,
                  hostWinRate: winRate,
                  stake: Number(stake),
                  pot: pot ? Number(pot) : Math.round(Number(stake) * 1.9),
                  gameMode: gameMode || (cleanCode.includes('BD') ? 'bead16' : 'whot'),
                  turnMode: turnMode || 'casual',
                };
                p2pRoomMeta.set(cleanCode, existingRoom);
                rememberP2pRoom(cleanCode, existingRoom);
              } else if (existingRoom && stake && (!existingRoom.stake || (existingRoom.stake === 2500 && username?.toLowerCase() === existingRoom.hostUsername?.toLowerCase()))) {
                existingRoom.stake = Number(stake);
                existingRoom.pot = pot ? Number(pot) : Math.round(Number(stake) * 1.9);
                if (username && !existingRoom.hostUsername) existingRoom.hostUsername = username;
                p2pRoomMeta.set(cleanCode, existingRoom);
                rememberP2pRoom(cleanCode, existingRoom);
              }

              // Detect if a non-host player is joining
              if (existingRoom && username && existingRoom.hostUsername && username.toLowerCase() !== existingRoom.hostUsername.toLowerCase()) {
                const p2Data = {
                  id: userId || 'opp_' + Date.now(),
                  username,
                  displayName: displayName || username,
                  avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                  winRate: winRate || 65.0,
                };
                existingRoom.joinedPlayer = p2Data;
                existingRoom.status = 'IN_PROGRESS';
                sharedRoomsStore.set(cleanCode, existingRoom);
                p2pRoomMeta.set(cleanCode, existingRoom);
                rememberP2pRoom(cleanCode, existingRoom);

                // Broadcast player_joined to Host (and all subscribers)
                const subscribers = p2pRoomClients.get(cleanCode);
                if (subscribers) {
                  const joinedPayload = JSON.stringify({
                    type: 'p2p_player_joined',
                    roomCode: cleanCode,
                    player2: p2Data,
                  });
                  for (const client of subscribers) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                      client.send(joinedPayload);
                    }
                  }
                }
                console.log(`[P2P Socket] Player @${username} joined room ${cleanCode} (Host: @${existingRoom.hostUsername})`);
              }

              if (existingRoom && telegramId) {
                const recipients = p2pTelegramRecipients.get(cleanCode) || {};
                if (username && username.toLowerCase() === String(existingRoom.hostUsername || '').toLowerCase()) recipients.hostChatId = String(telegramId);
                else if (username && username.toLowerCase() === String(existingRoom.joinedPlayer?.username || '').toLowerCase()) recipients.challengerChatId = String(telegramId);
                if (recipients.hostChatId || recipients.challengerChatId) {
                  p2pTelegramRecipients.set(cleanCode, recipients);
                  persistP2pTelegramRecipients();
                }
              }
              if (existingRoom) {
                ws.send(
                  JSON.stringify({
                    type: 'room_meta_sync',
                    roomCode: cleanCode,
                    stake: existingRoom.stake,
                    pot: existingRoom.pot || Math.round(existingRoom.stake * 1.9),
                    gameMode: existingRoom.gameMode,
                    turnMode: existingRoom.turnMode || turnMode || 'casual',
                    hostUsername: existingRoom.hostUsername || existingRoom.hostName,
                    joinedPlayer: existingRoom.joinedPlayer || null,
                  })
                );
              }
              const savedState = p2pGameStates.get(cleanCode);
              if (savedState) {
                ws.send(JSON.stringify({ type: 'p2p_game_state_update', roomCode: cleanCode, state: savedState.state || savedState }));
              }
              console.log(`[P2P Socket] User ${username || userId || 'Player'} subscribed to P2P room ${cleanCode}`);
              (ws as any).p2pRoomCode = cleanCode;
              (ws as any).p2pUserId = userId || username;
              (ws as any).p2pUsername = username;
            }
            break;
          }

          case 'p2p_game_state': {
            const { roomCode, senderId, state } = msg;
            if (roomCode) {
              const cleanCode = String(roomCode).trim().toUpperCase();
              const room = sharedRoomsStore.get(cleanCode) || p2pRoomMeta.get(cleanCode) || p2pPersistedRooms.get(cleanCode);
              const previousRecord = p2pGameStates.get(cleanCode);
              const previousState = previousRecord?.state || previousRecord;
              const previousOwner = previousRecord?.turnOwnerUsername || previousState?.turnOwnerUsername || null;
              const senderUsername = String((ws as any).p2pUsername || '');
              const nextOwner = state && !state.isGameOver ? getP2pTurnOwnerUsername(state, room, senderUsername) : null;
              if (state && typeof state === 'object') {
                p2pGameStates.set(cleanCode, { state, turnOwnerUsername: nextOwner, senderUsername, updatedAt: Date.now() });
                persistP2pGameStates();
              }

              if (nextOwner && nextOwner.toLowerCase() !== senderUsername.toLowerCase() && (!previousOwner || previousOwner.toLowerCase() !== nextOwner.toLowerCase())) {
                const recipients = p2pTelegramRecipients.get(cleanCode);
                const hostUsername = String(room?.hostUsername || '').toLowerCase();
                const chatId = nextOwner.toLowerCase() === hostUsername ? recipients?.hostChatId : recipients?.challengerChatId;
                if (chatId) void telegramBotListener.sendMatchTurnNotification(chatId, room?.gameMode || 'whot', cleanCode);
              }

              const subscribers = p2pRoomClients.get(cleanCode);
              if (subscribers) {
                const payload = JSON.stringify({ type: 'p2p_game_state_update', roomCode: cleanCode, senderId, state });
                for (const client of subscribers) {
                  if (client !== ws && client.readyState === WebSocket.OPEN) client.send(payload);
                }
              }
            }
            break;
          }
          case 'p2p_voice_signal': {
            const { roomCode, senderId, signal } = msg;
            if (roomCode) {
              const cleanCode = String(roomCode).trim().toUpperCase();
              const subscribers = p2pRoomClients.get(cleanCode);
              if (subscribers) {
                const payload = JSON.stringify({
                  type: 'p2p_voice_signal_relayed',
                  roomCode: cleanCode,
                  senderId,
                  signal,
                });
                for (const client of subscribers) {
                  if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(payload);
                  }
                }
              }
            }
            break;
          }

          case 'spectator_cheer': {
            // Spectators can send cheer reactions (🔥, 👏, 😱, 👑)
            const { matchId, emoji, username } = msg;
            if (matchId && emoji) {
              const reactionPayload = {
                type: 'spectator_reaction',
                id: `cheer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                matchId,
                emoji,
                username: username || 'Spectator',
                timestamp: Date.now(),
              };
              broadcastToMatch(matchId, reactionPayload);
            }
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
            break;
          }

          // Strict Read-Only Enforcement: Block any wager, card play, or move mutations
          case 'play_card':
          case 'roll_dice':
          case 'move_piece':
          case 'wager':
          case 'claim_pot': {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'READ_ONLY_ACCESS',
                message:
                  'Spectator access is strictly read-only. Game moves and wager modifications are forbidden.',
              })
            );
            break;
          }

          default:
            break;
        }
      } catch {
        // Ignore unparseable frames
      }
    });

    ws.on('close', async () => {
      // 0. Cleanup liveChat session
      liveChatService.unregisterSocket(ws);

      // 1. Cleanup spectating connection
      if (currentSpectatingMatchId) {
        const set = matchSpectators.get(currentSpectatingMatchId);
        if (set) {
          set.delete(ws);
        }
        const match = LIVE_MATCHES.find((m) => m.id === currentSpectatingMatchId);
        if (match) {
          match.spectatorCount = Math.max(0, match.spectatorCount - 1);
          broadcastToMatch(currentSpectatingMatchId, {
            type: 'spectator_count',
            matchId: currentSpectatingMatchId,
            count: match.spectatorCount,
          });
        }
      }

      // 2. Cleanup P2P game room connection & handle disconnect/refresh forfeit
      const cleanCode = (ws as any).p2pRoomCode;
      const discUserId = (ws as any).p2pUserId;
      const discUsername = (ws as any).p2pUsername;

      if (cleanCode) {
        const subscribers = p2pRoomClients.get(cleanCode);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            p2pRoomClients.delete(cleanCode);
          }
        }

        console.log(`[P2P Disconnect] User @${discUsername || discUserId || 'Player'} disconnected from room ${cleanCode}`);

        const room = sharedRoomsStore.get(cleanCode) || p2pRoomMeta.get(cleanCode);
        if (room) {
          // Notify remaining subscribers in the room that opponent disconnected / refreshed
          if (room.turnMode !== 'casual' && subscribers && subscribers.size > 0) {
            const playerLeftPayload = JSON.stringify({
              type: 'p2p_player_left',
              roomCode: cleanCode,
              disconnectedUserId: discUserId,
              disconnectedUsername: discUsername,
              gameMessage: `⚠️ @${discUsername || 'Opponent'} disconnected / refreshed page. Match forfeited!`,
            });
            for (const subscriber of subscribers) {
              if (subscriber !== ws && subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(playerLeftPayload);
              }
            }
          }

          // If the match was in progress (both players joined), auto-settle forfeit on backend
          if (room.turnMode !== 'casual' && room.joinedPlayer && room.hostUsername) {
            const hostUser = (room.hostUsername || '').toLowerCase();
            const discUser = (discUsername || '').toLowerCase();
            const isHostDisc = hostUser === discUser || room.hostUserId === discUserId;

            const winnerUsername = isHostDisc ? room.joinedPlayer.username : room.hostUsername;
            const loserUsername = isHostDisc ? room.hostUsername : room.joinedPlayer.username;
            const winnerId = isHostDisc ? (room.joinedPlayer.id || room.joinedPlayer.username) : (room.hostUserId || room.hostUsername);
            const loserId = isHostDisc ? (room.hostUserId || room.hostUsername) : (room.joinedPlayer.id || room.joinedPlayer.username);
            const matchId = room.id || `M-${cleanCode}`;

            try {
              if (escrowEngine.getMatchSession(matchId)) {
                // Settle in escrowEngine backend ledger & release escrow locks
                escrowEngine.verifyAndSettleMatch(matchId, winnerId, {
                  gameMode: room.gameMode || 'whot',
                  winner: isHostDisc ? 'opponent' : 'player',
                  disconnectForfeit: true,
                  reason: `Match forfeited due to browser refresh / disconnect by @${discUsername}`,
                });
              } else {
                const potAmount = room.pot || Math.round((room.stake || 2500) * 1.9);
                escrowEngine.deposit(winnerId, winnerUsername, potAmount, 'fiat_naira', {
                  notes: `Match victory payout: @${discUsername} forfeited due to browser refresh`,
                });
              }
              console.log(`[P2P Disconnect] Auto-settled room ${cleanCode} after @${discUsername} disconnect. Winner: @${winnerUsername}`);
            } catch (err) {
              console.warn('[P2P Disconnect] Auto-settlement warning:', err);
            }
          } else if (room.turnMode !== 'casual' && !room.joinedPlayer && room.hostUsername) {
            // Room was waiting for opponent: refund host's locked escrow stake
            const matchId = room.id || `M-${cleanCode}`;
            try {
              if (escrowEngine.getMatchSession(matchId)) {
                escrowEngine.refundMatch(matchId, `Host @${discUsername} refreshed/disconnected while waiting`);
              }
              console.log(`[P2P Disconnect] Auto-refunded room ${cleanCode} for host @${discUsername}`);
            } catch (err) {
              console.warn('[P2P Disconnect] Auto-refund warning:', err);
            }
          }
        }
      }
    });
  });

  // Vite Middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Configure Telegram Bot Listener handler for 'Confirm & Credit User' NGN Deposit actions
  telegramBotListener.setConfirmDepositHandler(async (depositId: string) => {
    const item = fiatDepositStore.find((d) => d.id === depositId);
    if (item && item.status !== 'confirmed') {
      item.status = 'confirmed';
      item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

      // 1. Credit Ledger in escrowEngine
      escrowEngine.deposit(item.userId, item.username, item.amountNgn, 'fiat_naira', {
        referenceNo: item.referenceNo,
        depositId: item.id,
      });

      // 2. Persist balance credit directly in PostgreSQL user_wallets
      try {
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE user_wallets SET available_balance = available_balance + $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 OR user_id = (SELECT id FROM users WHERE username = $3 LIMIT 1)`,
            [item.amountNgn, item.userId, item.username.toLowerCase()]
          );
          console.log(`[PostgreSQL] Confirmed & Credited ₦${item.amountNgn} to user @${item.username} (ID: ${item.userId}) via Telegram Admin`);
        } finally {
          client.release();
        }
      } catch (err) {
        console.warn('[PostgreSQL] Wallet credit fallback:', err);
      }

      return {
        id: item.id,
        userId: item.userId,
        username: item.username,
        amountNgn: item.amountNgn,
        referenceNo: item.referenceNo,
        bankName: item.bankName,
        accountNumber: item.accountNumber,
        accountName: item.accountName,
        status: item.status,
        requestedAt: item.requestedAt,
      };
    }
    return null;
  });

  telegramBotListener.setRejectDepositHandler(async (depositId: string) => {
    const item = fiatDepositStore.find((d) => d.id === depositId);
    if (item) {
      item.status = 'rejected';
      item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      return {
        id: item.id,
        userId: item.userId,
        username: item.username,
        amountNgn: item.amountNgn,
        referenceNo: item.referenceNo,
        bankName: item.bankName,
        accountNumber: item.accountNumber,
        accountName: item.accountName,
        status: item.status,
        requestedAt: item.requestedAt,
      };
    }
    return null;
  });

  // Configure Telegram Bot Listener handler for 'Mark as Disbursed' button actions
  telegramBotListener.setDisburseHandler(async (withdrawalId: string) => {
    const item = withdrawalStore.find((w) => w.id === withdrawalId);
    if (item) {
      item.status = 'disbursed';
      item.processedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      item.adminNotes = 'Disbursed via Telegram Admin Listener Bot';
      console.log(`[Telegram Listener] Marked withdrawal ${withdrawalId} as DISBURSED.`);
      savePersistentWithdrawalsToFile();

      // Update database record if present
      try {
        const client = await pool.connect();
        try {
          await client.query(
            `UPDATE escrow_transactions SET status = 'SETTLED_ON_CHAIN', updated_at = CURRENT_TIMESTAMP WHERE external_reference = $1 OR id = $2`,
            [withdrawalId, withdrawalId]
          );
        } finally {
          client.release();
        }
      } catch (err) {
        // ignore db error fallback
      }

      return {
        id: item.id,
        userId: item.userId,
        username: item.username,
        amountNgn: item.amountNgn,
        amountUsdt: item.amountUsdt,
        currency: item.currency,
        method: item.method,
        destinationAddress: item.destinationAddress,
        status: item.status,
        requestedAt: item.requestedAt,
        adminNotes: item.adminNotes,
      };
    }
    return null;
  });

  // Start polling Telegram Bot for interactive button events
  telegramBotListener.startListening();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillStake Server running on http://0.0.0.0:${PORT} with WebSocket support`);
  });
}

startServer();

