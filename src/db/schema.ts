import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  bigserial,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const gameTypeEnum = pgEnum('game_type_enum', ['LUDO', 'WHOT', 'DRAUGHTS']);
export const matchStatusEnum = pgEnum('match_status_enum', [
  'WAITING',
  'ACTIVE',
  'SETTLING',
  'COMPLETED',
  'FORFEITED',
  'CANCELLED',
]);
export const transactionTypeEnum = pgEnum('transaction_type_enum', [
  'DEPOSIT',
  'WITHDRAWAL',
  'STAKE_LOCK',
  'POT_PAYOUT',
  'COMMISSION_FEE',
  'REFUND',
]);
export const transactionStatusEnum = pgEnum('transaction_status_enum', [
  'PENDING',
  'CONFIRMED',
  'SETTLED_ON_CHAIN',
  'FAILED',
  'REJECTED',
]);
export const paymentChannelEnum = pgEnum('payment_channel_enum', [
  'POLYGON_USDT',
  'BANK_TRANSFER',
  'OPAY',
  'KUDA',
  'INTERNAL_VAULT',
]);

// 1. Users Table
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 50 }).notNull().unique(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).unique(),
    phoneNumber: varchar('phone_number', { length: 20 }),
    avatarUrl: text('avatar_url').default(
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    ),
    evmWalletAddress: varchar('evm_wallet_address', { length: 42 }),
    stateLocation: varchar('state_location', { length: 100 }).default('Lagos, Nigeria'),
    isVerified: boolean('is_verified').default(false),
    isBanned: boolean('is_banned').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    usernameIdx: index('idx_users_username').on(table.username),
    walletIdx: index('idx_users_wallet').on(table.evmWalletAddress),
  })
);

// 2. User Wallets
export const userWallets = pgTable(
  'user_wallets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    availableBalance: numeric('available_balance', { precision: 18, scale: 4 })
      .notNull()
      .default('0.0000'),
    escrowLockedBalance: numeric('escrow_locked_balance', { precision: 18, scale: 4 })
      .notNull()
      .default('0.0000'),
    onchainDepositedUsdt: numeric('onchain_deposited_usdt', { precision: 18, scale: 6 })
      .notNull()
      .default('0.000000'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_wallets_user_id').on(table.userId),
  })
);

// 3. Match Rooms
export const matchRooms = pgTable(
  'match_rooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomCode: varchar('room_code', { length: 12 }).notNull().unique(),
    gameType: gameTypeEnum('game_type').notNull(),
    status: matchStatusEnum('status').notNull().default('WAITING'),
    stakeAmount: numeric('stake_amount', { precision: 18, scale: 2 }).notNull(),
    grossPot: numeric('gross_pot', { precision: 18, scale: 2 }).notNull(),
    platformFeePercent: numeric('platform_fee_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('5.00'),
    netWinnerPayout: numeric('net_winner_payout', { precision: 18, scale: 2 }).default('0.00'),
    platformFeeAmount: numeric('platform_fee_amount', { precision: 18, scale: 2 }).default('0.00'),
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    opponentId: uuid('opponent_id').references(() => users.id),
    winnerId: uuid('winner_id').references(() => users.id),
    loserId: uuid('loser_id').references(() => users.id),
    onchainMatchIdBytes32: varchar('onchain_match_id_bytes32', { length: 66 }),
    settlementTxHash: varchar('settlement_tx_hash', { length: 66 }),
    oracleSignerAddress: varchar('oracle_signer_address', { length: 42 }),
    spectatorsCount: integer('spectators_count').default(0),
    maxTurns: integer('max_turns').default(500),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_match_rooms_status').on(table.status),
    creatorIdx: index('idx_match_rooms_creator').on(table.creatorId),
    roomCodeIdx: index('idx_match_rooms_code').on(table.roomCode),
  })
);

// 4. Match Moves
export const matchMoves = pgTable(
  'match_moves',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matchRooms.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => users.id),
    turnNumber: integer('turn_number').notNull(),
    moveAction: varchar('move_action', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    boardStateSnapshot: jsonb('board_state_snapshot'),
    moveDurationMs: integer('move_duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    matchTurnIdx: index('idx_match_moves_match').on(table.matchId, table.turnNumber),
  })
);

// 5. Escrow Transactions Ledger
export const escrowTransactions = pgTable(
  'escrow_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id').references(() => matchRooms.id, { onDelete: 'set null' }),
    transactionType: transactionTypeEnum('transaction_type').notNull(),
    status: transactionStatusEnum('status').notNull().default('PENDING'),
    paymentChannel: paymentChannelEnum('payment_channel').notNull(),
    amount: numeric('amount', { precision: 18, scale: 4 }).notNull(),
    feeAmount: numeric('fee_amount', { precision: 18, scale: 4 }).notNull().default('0.0000'),
    currency: varchar('currency', { length: 10 }).notNull().default('NGN'),
    externalReference: varchar('external_reference', { length: 100 }),
    blockchainTxHash: varchar('blockchain_tx_hash', { length: 66 }),
    polygonBlockNumber: numeric('polygon_block_number', { precision: 20, scale: 0 }),
    walletOrBankDestination: text('wallet_or_bank_destination'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_escrow_tx_user').on(table.userId),
    matchIdx: index('idx_escrow_tx_match').on(table.matchId),
    hashIdx: index('idx_escrow_tx_hash').on(table.blockchainTxHash),
  })
);

// 6. Player Stats
export const playerStats = pgTable('player_stats', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  totalMatchesPlayed: integer('total_matches_played').default(0),
  totalWins: integer('total_wins').default(0),
  totalLosses: integer('total_losses').default(0),
  currentWinStreak: integer('current_win_streak').default(0),
  highestWinStreak: integer('highest_win_streak').default(0),
  totalEarningsNgn: numeric('total_earnings_ngn', { precision: 18, scale: 2 }).default('0.00'),
  totalEarningsUsdt: numeric('total_earnings_usdt', { precision: 18, scale: 2 }).default('0.00'),
  skillRatingElo: integer('skill_rating_elo').default(1200),
  rankTier: varchar('rank_tier', { length: 20 }).default('Gold III'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 7. Platform Settings (Key-Value configuration persistence for bank details & treasury address)
export const platformSettings = pgTable('platform_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  wallet: one(userWallets, {
    fields: [users.id],
    references: [userWallets.userId],
  }),
  stats: one(playerStats, {
    fields: [users.id],
    references: [playerStats.userId],
  }),
  createdRooms: many(matchRooms, { relationName: 'creator' }),
  transactions: many(escrowTransactions),
  moves: many(matchMoves),
}));

export const matchRoomsRelations = relations(matchRooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [matchRooms.creatorId],
    references: [users.id],
    relationName: 'creator',
  }),
  opponent: one(users, {
    fields: [matchRooms.opponentId],
    references: [users.id],
    relationName: 'opponent',
  }),
  moves: many(matchMoves),
  transactions: many(escrowTransactions),
}));
