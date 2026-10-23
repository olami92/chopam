-- ============================================================================
-- SkillPlay Escrow Gaming Platform - PostgreSQL Database Schema
-- Compatible with PostgreSQL 14+, Neon, Supabase, Amazon RDS, and Cloud SQL
-- ============================================================================

-- Enable UUID extension for cryptographically secure, collision-free identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
CREATE TYPE game_type_enum AS ENUM ('LUDO', 'WHOT', 'DRAUGHTS');
CREATE TYPE match_status_enum AS ENUM ('WAITING', 'ACTIVE', 'SETTLING', 'COMPLETED', 'FORFEITED', 'CANCELLED');
CREATE TYPE transaction_type_enum AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'STAKE_LOCK', 'POT_PAYOUT', 'COMMISSION_FEE', 'REFUND');
CREATE TYPE transaction_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'SETTLED_ON_CHAIN', 'FAILED', 'REJECTED');
CREATE TYPE payment_channel_enum AS ENUM ('POLYGON_USDT', 'BANK_TRANSFER', 'OPAY', 'KUDA', 'INTERNAL_VAULT');

-- ============================================================================
-- 2. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    evm_wallet_address VARCHAR(42), -- 0x... Polygon address
    state_location VARCHAR(100) DEFAULT 'Lagos, Nigeria',
    is_verified BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR(32) UNIQUE,
    referred_by_user_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_wallet ON users(evm_wallet_address);

-- ============================================================================
-- 3. USER WALLETS & VAULTS (Non-Custodial Balance Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'NGN', -- 'NGN' or 'USDT'
    available_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (available_balance >= 0),
    escrow_locked_balance NUMERIC(18, 4) NOT NULL DEFAULT 0.0000 CHECK (escrow_locked_balance >= 0),
    onchain_deposited_usdt NUMERIC(18, 6) NOT NULL DEFAULT 0.000000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_currency UNIQUE (user_id, currency)
);

CREATE INDEX idx_wallets_user_id ON user_wallets(user_id);

-- Platform reward coins are separate from cash and escrow balances.
CREATE TABLE IF NOT EXISTS platform_coin_accounts (
    user_id TEXT PRIMARY KEY,
    balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_coin_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK (amount > 0),
    reason VARCHAR(40) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL UNIQUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_coin_ledger_user ON platform_coin_ledger(user_id, created_at DESC);

-- ============================================================================
-- 4. MATCH ROOMS (Skill Duel Sessions & Pots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS match_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(12) UNIQUE NOT NULL,
    game_type game_type_enum NOT NULL,
    status match_status_enum NOT NULL DEFAULT 'WAITING',
    
    -- Staking Details
    stake_amount NUMERIC(18, 2) NOT NULL CHECK (stake_amount > 0),
    gross_pot NUMERIC(18, 2) NOT NULL CHECK (gross_pot >= 0),
    platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00, -- 5% protocol fee
    net_winner_payout NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    platform_fee_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,

    -- Participants
    creator_id UUID NOT NULL REFERENCES users(id),
    opponent_id UUID REFERENCES users(id),
    winner_id UUID REFERENCES users(id),
    loser_id UUID REFERENCES users(id),

    -- Blockchain Escrow Link
    onchain_match_id_bytes32 VARCHAR(66), -- 0x... 32-byte hash
    settlement_tx_hash VARCHAR(66),
    oracle_signer_address VARCHAR(42),

    -- Match Lifecycle
    spectators_count INTEGER DEFAULT 0,
    max_turns INTEGER DEFAULT 500,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_rooms_status ON match_rooms(status);
CREATE INDEX idx_match_rooms_creator ON match_rooms(creator_id);
CREATE INDEX idx_match_rooms_opponent ON match_rooms(opponent_id);
CREATE INDEX idx_match_rooms_code ON match_rooms(room_code);

-- ============================================================================
-- 5. GAME MOVES & AUDIT LOGS (Anti-Cheat & Turn State)
-- ============================================================================
CREATE TABLE IF NOT EXISTS match_moves (
    id BIGSERIAL PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES match_rooms(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES users(id),
    turn_number INTEGER NOT NULL,
    move_action VARCHAR(50) NOT NULL, -- e.g., 'DICE_ROLL', 'PIECE_MOVE', 'PLAY_CARD', 'JUMP_PIECE'
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    board_state_snapshot JSONB,
    move_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_match_moves_match ON match_moves(match_id, turn_number);

-- ============================================================================
-- 6. ESCROW & FINANCIAL TRANSACTIONS LEDGER
-- ============================================================================
CREATE TABLE IF NOT EXISTS escrow_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_id UUID REFERENCES match_rooms(id) ON DELETE SET NULL,
    
    transaction_type transaction_type_enum NOT NULL,
    status transaction_status_enum NOT NULL DEFAULT 'PENDING',
    payment_channel payment_channel_enum NOT NULL,

    amount NUMERIC(18, 4) NOT NULL,
    fee_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(10) NOT NULL DEFAULT 'NGN',

    -- External payment reference / Blockchain Transaction Hash
    external_reference VARCHAR(100),
    blockchain_tx_hash VARCHAR(66),
    polygon_block_number BIGINT,
    wallet_or_bank_destination TEXT,

    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_tx_user ON escrow_transactions(user_id);
CREATE INDEX idx_escrow_tx_match ON escrow_transactions(match_id);
CREATE INDEX idx_escrow_tx_hash ON escrow_transactions(blockchain_tx_hash);

-- ============================================================================
-- 7. PLAYER STATS & LEADERBOARD
-- ============================================================================
CREATE TABLE IF NOT EXISTS player_stats (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_matches_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    current_win_streak INTEGER DEFAULT 0,
    highest_win_streak INTEGER DEFAULT 0,
    total_earnings_ngn NUMERIC(18, 2) DEFAULT 0.00,
    total_earnings_usdt NUMERIC(18, 2) DEFAULT 0.00,
    skill_rating_elo INTEGER DEFAULT 1200,
    rank_tier VARCHAR(20) DEFAULT 'Gold III',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. AUTOMATIC TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_wallets
BEFORE UPDATE ON user_wallets
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_escrow_tx
BEFORE UPDATE ON escrow_transactions
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_stats
BEFORE UPDATE ON player_stats
FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
