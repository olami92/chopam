export type GameMode = 'whot' | 'ludo_classic' | 'ludo_blitz' | 'draughts' | 'bead16';
export type TurnMode = 'live' | 'async';
export const TURN_MODE_SECONDS: Record<TurnMode, number> = { live: 60, async: 60 * 60 };
export const normalizeTurnMode = (mode: unknown, fallback: TurnMode = 'live'): TurnMode => {
  if (mode === 'live' || mode === 'fast_blitz') return 'live';
  if (mode === 'async' || mode === 'casual') return 'async';
  return fallback;
};

export type TabType = 'arena' | 'lobby' | 'wallet' | 'analytics';

export interface AdminUserRecord {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  availableBalance: number;
  escrowLockedBalance: number;
  status: 'active' | 'frozen';
  totalDeposited: number;
  totalWithdrawn: number;
  totalMatches: number;
  winRate: number;
  joinedAt: string;
  lastActive: string;
  walletAddress?: string;
}

export interface PlatformAdminStats {
  totalUsers: number;
  totalDeposits: number; // in NGN
  totalDepositsUsdt: number; // in USDT
  totalWithdrawals: number; // in NGN
  totalWithdrawalsUsdt: number; // in USDT
  totalHouseFeeCollected: number; // in NGN
  totalHouseFeeCollectedUsdt: number; // in USDT
  totalGateFeeCollected?: number; // in NGN
  totalGateFeeCollectedUsdt?: number; // in USDT
  gateFeePercent?: number; // percentage
  activeEscrowLocked: number;
  totalMatchesPlayed: number;
  treasuryAddress: string;
}

export type MatchStatus = 'waiting' | 'waiting_for_opponent' | 'locked_escrow' | 'in_progress' | 'settling' | 'completed' | 'cancelled';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface GameSkillStat {
  gameMode: GameMode;
  name: string;
  matches: number;
  won: number;
  lost: number;
  winRate: number; // percentage (0-100)
  profit: number; // in NGN
  currentStreak: number;
  highestStreak: number;
  tier: string;
}

export interface DayPerformance {
  day: string; // 'M', 'T', 'W', 'T', 'F', 'S', 'S'
  dayLabel: string; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  fullDay: string; // 'Monday', 'Tuesday', etc.
  battles: number;
  won: number;
  lost: number;
  profit: number; // net profit in NGN (positive or negative)
  isToday: boolean;
}

export interface UserProfile {
  id: string;
  telegramId?: number;
  username: string;
  displayName: string;
  actualName?: string;
  avatarUrl: string;
  isVerified: boolean;
  email?: string;
  emailVerified?: boolean;
  phone?: string;
  phoneVerified?: boolean;
  tier: string;
  availableBalance: number; // in NGN
  escrowBalance: number;    // in NGN
  coinBalance?: number;     // platform-only reward coins, not cash
  referralCode?: string;
  winRate: number;          // e.g. 68.5
  totalWagers: number;
  netWinnings: number;
  rank: number;
  location?: string;
  locationAutoPicked?: boolean;
  depositCurrency?: 'FIAT' | 'USDT' | 'BOTH';
  telegramBindStatus?: 'bound' | 'unbound' | 'pending';
  telegramBotUsername?: string;
  gameStats?: Record<GameMode, {
    matches: number;
    won: number;
    lost: number;
    profit: number;
    currentStreak: number;
    highestStreak: number;
  }>;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'escrow' | 'match' | 'telegram' | 'system' | 'reward';
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  amount?: number;
}

export interface EscrowTransaction {
  id: string;
  matchId: string;
  gameMode: GameMode;
  stake: number;
  pot: number;
  fee: number;
  opponentUsername: string;
  result: 'WON' | 'LOST' | 'ESCROW' | 'REFUNDED';
  txHash: string;
  timestamp: string;
  status: 'LOCKED' | 'RELEASED' | 'FEE_DEDUCTED' | 'REFUNDED';
}

export type WalletTransactionStatus = 'processing' | 'successful' | 'failed';

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  amountUsdt?: number;
  method: string;
  status: WalletTransactionStatus;
  timestamp: string;
  txHash?: string;
  reference?: string;
}

export interface OpenTable {
  id: string;
  roomCode: string;
  hostName: string;
  hostUsername: string;
  hostAvatar: string;
  hostWinRate: number;
  gameMode: GameMode;
  turnMode?: TurnMode;
  joinedPlayer?: { id?: string; username: string; displayName?: string; avatarUrl?: string; winRate?: number };
  hostUserId?: string;
  stake: number;
  pot: number;
  isPrivate: boolean;
  createdAt: string;
}

export interface ActiveMatch {
  id: string;
  roomCode: string;
  gameMode: GameMode;
  turnMode: TurnMode;
  turnDeadlineAt?: number;
  stake: number;
  pot: number;
  fee: number;
  status: MatchStatus;
  hostUsername?: string;
  opponent: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    winRate: number;
  };
  winnerId?: string;
  isPrivate?: boolean;
  isVsAi?: boolean;
  isP2P?: boolean;
  finalizedTxHash?: string;
  settledResult?: 'player' | 'opponent' | 'draw';
  settledAt?: string;
  coinMatchId?: string;
}

// Whot Game Types
export type WhotShape = 'circle' | 'triangle' | 'cross' | 'square' | 'star' | 'whot';

export interface WhotCard {
  id: string;
  shape: WhotShape;
  number: number; // 1,2,3,4,5,7,8,10,11,12,13,14,20
  isSpecial?: boolean;
}

// Ludo Game Types
export type LudoColor = 'red' | 'yellow' | 'green' | 'blue';

export interface LudoToken {
  id: string;
  color: LudoColor;
  index: number; // 0, 1, 2, 3
  step: number;  // -1 = in base, 0 to 51 = on main track, 52 to 57 = home column, 58 = home
}

// Draughts Game Types
export type DraughtsPieceColor = 'gold' | 'crimson';

export interface DraughtsPiece {
  id: string;
  color: DraughtsPieceColor;
  row: number; // 0 to 7
  col: number; // 0 to 7
  isKing: boolean;
}

export interface DraughtsMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  capturedPiece?: DraughtsPiece;
}

// Spectator & Live Arena Types
export interface LiveMatchPlayer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  winRate: number;
  cardCount?: number;
  score?: number;
  tier?: string;
}

export interface LiveSpectateMatch {
  id: string;
  roomCode: string;
  gameMode: GameMode;
  stake: number;
  pot: number;
  fee: number;
  status: 'live' | 'settling' | 'finished';
  spectatorCount: number;
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
  turn: 'player1' | 'player2';
  lastAction: string;
  startedAt: string;
  turnTimeLeft: number;
  escrowTxHash: string;
  whotState?: {
    currentShape: WhotShape;
    currentNumber: number | null;
    topCard: WhotCard;
    discardCount: number;
    marketDeckCount: number;
    player1Cards: WhotCard[];
    player2Cards: WhotCard[];
    pendingPenalty?: { type: number; count: number } | null;
  };
  ludoState?: {
    currentTurnColor: LudoColor;
    diceValue: number;
    player1Tokens: LudoToken[];
    player2Tokens: LudoToken[];
    lastRollText?: string;
    lastMovedTokenId?: string;
    isRolling?: boolean;
  };
  draughtsState?: {
    currentTurnColor: DraughtsPieceColor;
    pieces: DraughtsPiece[];
    capturedGold: number;
    capturedCrimson: number;
    lastMove?: {
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      pieceId: string;
      captured?: boolean;
    };
  };
}

export interface SpectatorReaction {
  id: string;
  matchId: string;
  emoji: string;
  username: string;
  timestamp: number;
}

export type FeedbackCategory = 'bug' | 'feature' | 'gameplay' | 'wallet' | 'other';
export type FeedbackPriority = 'low' | 'medium' | 'high';

export interface FeedbackReport {
  id: string;
  userId: string;
  username: string;
  email?: string;
  type: 'bug' | 'feature';
  category: FeedbackCategory;
  priority: FeedbackPriority;
  subject: string;
  description: string;
  deviceInfo?: string;
  timestamp: string;
  status: 'pending' | 'reviewed' | 'resolved';
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'disbursed';

export interface AdminWithdrawalRecord {
  id: string;
  userId: string;
  username: string;
  amountNgn: number;
  amountUsdt: number;
  currency: string;
  method: 'polygon_usdt' | 'polygon_pol';
  destinationAddress: string;
  status: WithdrawalStatus;
  requestedAt: string;
  processedAt?: string;
  txHash?: string;
  auditLogId?: string;
  adminNotes?: string;
}

export interface DepositInvoice {
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

