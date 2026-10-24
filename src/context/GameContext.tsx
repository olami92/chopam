import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UserProfile,
  GameMode,
  TabType,
  ActiveMatch,
  MatchStatus,
  EscrowTransaction,
  WalletTransaction,
  OpenTable,
  AppNotification,
  GameSkillStat,
  DayPerformance,
  TurnMode,
  TURN_MODE_SECONDS,
} from '../types';
import { MatchReplayData, ReplayStep } from '../types/replay';
import { getReplayById, saveReplay } from '../services/replayService';
import { EscrowApiService } from '../services/escrowService';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';
import { autoDetectLocation } from '../services/location';
import { getDynamicAvatarUrl, ensureDynamicAvatarUrl } from '../utils/avatar';

const STORAGE_KEY_USER = 'skillstake_user_v1';
const STORAGE_KEY_ESCROW = 'skillstake_escrow_v1';
const STORAGE_KEY_AUTH = 'skillstake_auth_v1';
const STORAGE_KEY_SESSION = 'skillstake_session_v1';
const STORAGE_KEY_NOTIFICATIONS = 'skillstake_notifications_v1';
const STORAGE_KEY_WALLET_TX = 'skillstake_wallet_tx_v1';
const STORAGE_KEY_WEEKLY = 'skillstake_weekly_v1';

const getUserStorageKey = (identifier?: string) => {
  if (!identifier) return STORAGE_KEY_USER;
  const clean = String(identifier).trim().toLowerCase().replace(/^@/, '');
  return `skillstake_user_profile_${clean}`;
};

const getWeeklyStorageKey = (identifier?: string) => {
  if (!identifier) return STORAGE_KEY_WEEKLY;
  const clean = String(identifier).trim().toLowerCase().replace(/^@/, '');
  return `skillstake_weekly_perf_${clean}`;
};

const getEscrowStorageKey = (identifier?: string) => {
  if (!identifier) return STORAGE_KEY_ESCROW;
  const clean = String(identifier).trim().toLowerCase().replace(/^@/, '');
  return `skillstake_escrow_history_${clean}`;
};

const getActiveMatchStorageKey = (identifier?: string) => `skillstake_active_match_${String(identifier || 'guest').trim().toLowerCase().replace(/^@/, '')}`;
const DEMO_ESCROW_TRANSACTION_IDS = new Set(['tx_9921', 'tx_9920', 'tx_9919', 'tx_9918']);

const restoreEscrowHistory = (raw: string | null): EscrowTransaction[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((transaction) => !DEMO_ESCROW_TRANSACTION_IDS.has(transaction?.id));
  } catch {
    return [];
  }
};

const calculateDerivedWeeklyStats = (items: (DayPerformance | any)[]) => {
  const allMatches: number = items.reduce((acc, it) => acc + (it ? it.matches || 0 : 0), 0);
  const allWon: number = items.reduce((acc, it) => acc + (it ? it.won || 0 : 0), 0);
  const liveWinRate: number = allMatches > 0 ? parseFloat(((allWon / allMatches) * 100).toFixed(1)) : 0;
  const liveNetWinnings: number = items.reduce((acc, it) => acc + (it ? it.profit || 0 : 0), 0);
  return { allMatches, allWon, liveWinRate, liveNetWinnings };
};

const summaryHasZeroMatches = (stats?: Record<string, GameStatEntry>) =>
  !stats || Object.values(stats).reduce((acc, s) => acc + (s?.matches || 0), 0) === 0;


const EMPTY_GAME_STATS: Record<GameMode, {
  matches: number;
  won: number;
  lost: number;
  profit: number;
  currentStreak: number;
  highestStreak: number;
}> = {
  whot: { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 },
  ludo_blitz: { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 },
  ludo_classic: { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 },
  draughts: { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 },
  bead16: { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 },
};

const INITIAL_GAME_STATS = EMPTY_GAME_STATS;

const getDayIndex = () => {
  const d = new Date().getDay();
  return (d + 6) % 7; // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
};

const EMPTY_WEEKLY_DAYS: Omit<DayPerformance, 'isToday'>[] = [
  { day: 'M', dayLabel: 'Mon', fullDay: 'Monday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'T', dayLabel: 'Tue', fullDay: 'Tuesday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'W', dayLabel: 'Wed', fullDay: 'Wednesday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'T', dayLabel: 'Thu', fullDay: 'Thursday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'F', dayLabel: 'Fri', fullDay: 'Friday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'S', dayLabel: 'Sat', fullDay: 'Saturday', battles: 0, won: 0, lost: 0, profit: 0 },
  { day: 'S', dayLabel: 'Sun', fullDay: 'Sunday', battles: 0, won: 0, lost: 0, profit: 0 },
];

const DEMO_WEEKLY_DAYS: Omit<DayPerformance, 'isToday'>[] = [
  { day: 'M', dayLabel: 'Mon', fullDay: 'Monday', battles: 12, won: 8, lost: 4, profit: 14500 },
  { day: 'T', dayLabel: 'Tue', fullDay: 'Tuesday', battles: 18, won: 13, lost: 5, profit: 22000 },
  { day: 'W', dayLabel: 'Wed', fullDay: 'Wednesday', battles: 9, won: 6, lost: 3, profit: 9500 },
  { day: 'T', dayLabel: 'Thu', fullDay: 'Thursday', battles: 22, won: 16, lost: 6, profit: 28000 },
  { day: 'F', dayLabel: 'Fri', fullDay: 'Friday', battles: 28, won: 21, lost: 7, profit: 35000 },
  { day: 'S', dayLabel: 'Sat', fullDay: 'Saturday', battles: 16, won: 11, lost: 5, profit: 18000 },
  { day: 'S', dayLabel: 'Sun', fullDay: 'Sunday', battles: 20, won: 14, lost: 6, profit: 25000 },
];

const buildWeeklyData = (base?: DayPerformance[] | Omit<DayPerformance, 'isToday'>[]): DayPerformance[] => {
  const todayIdx = getDayIndex();
  const source = base && base.length === 7 ? base : EMPTY_WEEKLY_DAYS;
  return source.map((item, idx) => ({
    ...item,
    isToday: idx === todayIdx,
  }));
};

interface GameStatEntry {
  matches: number;
  won: number;
  lost: number;
  profit: number;
  currentStreak: number;
  highestStreak: number;
}

const summarizeGameStats = (stats?: Record<string, GameStatEntry>) => {
  if (!stats) {
    return { allMatches: 0, allWon: 0, allLost: 0, liveWinRate: 0, liveNetWinnings: 0 };
  }
  const items = Object.values(stats);
  const allMatches: number = items.reduce((acc, it) => acc + (it ? it.matches || 0 : 0), 0);
  const allWon: number = items.reduce((acc, it) => acc + (it ? it.won || 0 : 0), 0);
  const allLost: number = items.reduce((acc, it) => acc + (it ? it.lost || 0 : 0), 0);
  const liveWinRate: number = allMatches > 0 ? parseFloat(((allWon / allMatches) * 100).toFixed(1)) : 0;
  const liveNetWinnings: number = items.reduce((acc, it) => acc + (it ? it.profit || 0 : 0), 0);
  return { allMatches, allWon, allLost, liveWinRate, liveNetWinnings };
};

const EMPTY_USER_PROFILE: UserProfile = {
  id: 'usr_new',
  username: 'Player',
  displayName: 'Player',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  isVerified: true, // KYC disabled for Telegram P2P platform
  tier: 'Unranked',
  availableBalance: 0,
  escrowBalance: 0,
  winRate: 0,
  totalWagers: 0,
  netWinnings: 0,
  rank: 0,
  depositCurrency: 'FIAT',
  location: 'Lagos, Nigeria',
  locationAutoPicked: false,
  gameStats: EMPTY_GAME_STATS,
};


const INITIAL_MOCK_USER = EMPTY_USER_PROFILE;

const WELCOME_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_welcome',
    title: 'Welcome to Tete Arena!',
    message: 'Your account is ready. Deposit funds to join high-stakes matches or create open wager tables.',
    type: 'system',
    timestamp: 'Just now',
    read: false,
  },
];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif_1',
    title: '₦4,750 Escrow Payout Released',
    message: 'Whot match M-7712 against @LagosBaller was verified. Escrow funds credited to your vault.',
    type: 'escrow',
    timestamp: '15m ago',
    read: false,
    amount: 4750,
  },
  {
    id: 'notif_2',
    title: 'Telegram Bot Account Synced',
    message: 'Your account is securely bound to @SkillStakeBot (Telegram ID: 729104882). Instant wager alerts are active.',
    type: 'telegram',
    timestamp: '1h ago',
    read: false,
  },
  {
    id: 'notif_3',
    title: 'High-Stakes Table Challenge',
    message: '@Chidi_G opened a ₦3,500 Ludo Blitz table TG-8842. Head to Open Tables to accept the match.',
    type: 'match',
    timestamp: '2h ago',
    read: true,
  },
  {
    id: 'notif_4',
    title: 'Leaderboard Promotion: Grandmaster II',
    message: 'Congratulations! Your 68.5% win rate has elevated your standing on the regional Lagos leaderboard.',
    type: 'reward',
    timestamp: 'Yesterday',
    read: true,
  },
  {
    id: 'notif_5',
    title: 'Escrow Security Audit Complete',
    message: 'All multi-signature smart escrow contracts passed daily automated latency checks.',
    type: 'system',
    timestamp: '2 days ago',
    read: true,
  },
];

const DEMO_ESCROW_HISTORY: EscrowTransaction[] = [
  {
    id: 'tx_9921',
    matchId: 'M-7712',
    gameMode: 'whot',
    stake: 2500,
    pot: 4750,
    fee: 250,
    opponentUsername: 'LagosBaller',
    result: 'WON',
    txHash: '0x8f2a991bce47d2a9019b882103f5',
    timestamp: '12m ago',
    status: 'RELEASED',
  },
  {
    id: 'tx_9920',
    matchId: 'M-7709',
    gameMode: 'ludo_blitz',
    stake: 5000,
    pot: 9500,
    fee: 500,
    opponentUsername: 'Tunde_Viper',
    result: 'LOST',
    txHash: '0x3c91af0219c836db90a77102eef1',
    timestamp: '1h ago',
    status: 'FEE_DEDUCTED',
  },
  {
    id: 'tx_9919',
    matchId: 'M-7702',
    gameMode: 'draughts',
    stake: 1500,
    pot: 2850,
    fee: 150,
    opponentUsername: 'Nkechi_Stakes',
    result: 'WON',
    txHash: '0x19bb2c55e920d3f821ac33b47e22',
    timestamp: '3h ago',
    status: 'RELEASED',
  },
  {
    id: 'tx_9918',
    matchId: 'M-7695',
    gameMode: 'ludo_classic',
    stake: 3000,
    pot: 5700,
    fee: 300,
    opponentUsername: 'AbujaKingpin',
    result: 'WON',
    txHash: '0x7e8891ac3b2184ff930b127e89ab',
    timestamp: 'Yesterday',
    status: 'RELEASED',
  },
];

const INITIAL_WALLET_TRANSACTIONS: WalletTransaction[] = [];


const DEMO_OPEN_TABLES: OpenTable[] = [
  {
    id: 'tbl_1',
    roomCode: 'TG-1044',
    hostName: 'Emeka Rolls',
    hostUsername: 'Emeka_Dice',
    hostAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    hostWinRate: 72.0,
    gameMode: 'whot',
    stake: 2000,
    pot: 3800,
    isPrivate: false,
    createdAt: 'Just now',
  },
  {
    id: 'tbl_2',
    roomCode: 'TG-8842',
    hostName: 'Chidi Gambits',
    hostUsername: 'Chidi_G',
    hostAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    hostWinRate: 65.5,
    gameMode: 'ludo_blitz',
    stake: 3500,
    pot: 6650,
    isPrivate: false,
    createdAt: '2m ago',
  },
  {
    id: 'tbl_3',
    roomCode: 'TG-4401',
    hostName: 'Zainab King',
    hostUsername: 'QueenZainab',
    hostAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    hostWinRate: 78.2,
    gameMode: 'draughts',
    stake: 5000,
    pot: 9500,
    isPrivate: false,
    createdAt: '5m ago',
  },
  {
    id: 'tbl_4',
    roomCode: 'TG-9905',
    hostName: 'Femi Master',
    hostUsername: 'Femi_Ludo99',
    hostAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    hostWinRate: 61.0,
    gameMode: 'ludo_classic',
    stake: 1000,
    pot: 1900,
    isPrivate: false,
    createdAt: '8m ago',
  },
  {
    id: 'tbl_5',
    roomCode: 'TG-7733',
    hostName: 'Blessing Sharp',
    hostUsername: 'BlessingAce',
    hostAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    hostWinRate: 69.4,
    gameMode: 'whot',
    stake: 10000,
    pot: 19000,
    isPrivate: false,
    createdAt: '11m ago',
  },
];

const INITIAL_OPEN_TABLES: OpenTable[] = [];

interface GameContextType {
  user: UserProfile;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalTab: 'signin' | 'register';
  openAuthModal: (tab?: 'signin' | 'register') => void;
  closeAuthModal: () => void;
  login: (usernameOrEmail: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { username: string; displayName: string; email: string; phone?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  loginWithTelegram: (tgPayload?: { initData?: string; user?: any; startParam?: string }) => Promise<{ success: boolean; error?: string }>;
  loginAsDemo: () => void;
  logout: () => void;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  activeMatch: ActiveMatch | null;
  openTables: OpenTable[];
  escrowHistory: EscrowTransaction[];
  walletTransactions: WalletTransaction[];
  startMatch: (
    gameMode: GameMode,
    stake: number,
    isPrivate?: boolean,
    roomCode?: string,
    opponent?: ActiveMatch['opponent'],
    isVsAi?: boolean,
    hostUsername?: string,
    initialStatus?: MatchStatus,
    turnMode?: TurnMode
  ) => boolean;
  startCoinAiMatch: (stake: number, gameMode?: GameMode) => Promise<boolean>;
  submitCoinAiAction: (action: Record<string, unknown>) => Promise<boolean>;
  timeoutCoinAiMatch: () => Promise<boolean>;
  updateTeteCoinBalance: (balance: number) => void;
  completeCoinAiMatch: (winner: 'player' | 'opponent') => void;
  settleMatch: (winner: 'player' | 'opponent' | 'draw') => string;
  cancelMatch: () => void;
  forfeitMatch: () => void;
  recordReplayStep: (step: Omit<ReplayStep, 'stepIndex'>) => void;
  clearReplaySteps: () => void;
  deposit: (amount: number, method: string) => void;
  withdraw: (amount: number, bank: string, accountNumber: string, bankDetails?: { bankName?: string; accountName?: string }) => boolean;
  createTable: (gameMode: GameMode, stake: number, customRoomCode?: string, turnMode?: TurnMode) => string;
  joinTable: (table: OpenTable) => boolean;
  joinByRoomCode: (roomCode: string) => Promise<boolean> | boolean;
  spectatingMatchId: string | null;
  setSpectatingMatchId: (id: string | null) => void;
  isTelegram: boolean;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  updateUserProfile: (updates: Partial<UserProfile>) => void;
  bindTelegram: (telegramId: number, username?: string) => void;
  unbindTelegram: () => void;
  refreshLocation: () => Promise<string>;
  isProfileMenuOpen: boolean;
  openProfileMenu: () => void;
  closeProfileMenu: () => void;
  weeklyPerformance: DayPerformance[];
  gameSkillMatrix: GameSkillStat[];
  simulateMatchResult: (gameMode: GameMode, stake: number, outcome: 'WON' | 'LOST') => void;
  resetLiveTelemetry: () => void;
  activeReplay: MatchReplayData | null;
  openReplay: (matchId: string) => void;
  closeReplay: () => void;
  sendP2pStateUpdate: (stateData: any) => void;
  sendP2pVoiceSignal: (signalData: any) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // If inside Telegram WebApp, auto authenticate with Telegram session
    if (telegram.isTelegram()) {
      return true;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register'>('signin');

  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      if (saved) {
        const parsed = JSON.parse(saved);
        const email = parsed.email || 'player@example.invalid';
        const emailVerified = Boolean(parsed.emailVerified);
        const phone = parsed.phone || '';
        const phoneVerified = Boolean(parsed.phoneVerified);
        const isVerified = Boolean(emailVerified && phoneVerified);
        let gameStats = parsed.gameStats || INITIAL_GAME_STATS;
        if (summaryHasZeroMatches(gameStats)) {
          const perUserRaw =
            localStorage.getItem(getUserStorageKey(parsed.id)) ||
            localStorage.getItem(getUserStorageKey(parsed.username));
          if (perUserRaw) {
            const perUser = JSON.parse(perUserRaw);
            if (perUser.gameStats && !summaryHasZeroMatches(perUser.gameStats)) {
              gameStats = perUser.gameStats;
            }
          }
        }

        // Unified derivation of matches, won, and live winRate
        const summary = summarizeGameStats(gameStats as Record<string, GameStatEntry>);

        return {
          ...INITIAL_MOCK_USER,
          ...parsed,
          avatarUrl: ensureDynamicAvatarUrl(parsed.avatarUrl, parsed.username || 'Player'),
          email,
          emailVerified,
          phone,
          phoneVerified,
          isVerified,
          gameStats,
          winRate: summary.allMatches > 0 ? summary.liveWinRate : (parsed.winRate || 0),
          totalWagers: summary.allMatches || parsed.totalWagers || 0,
          netWinnings: parsed.netWinnings ?? summary.liveNetWinnings,
        };

      }
    } catch {
      // fallback
    }

    // Check if Telegram user info is available
    const tgUser = telegram.getUser();
    if (tgUser) {
      const tgUsername = tgUser.username || `User_${tgUser.id}`;
      return {
        ...INITIAL_MOCK_USER,
        id: `tg_${tgUser.id}`,
        telegramId: tgUser.id,
        username: tgUsername,
        displayName: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
        avatarUrl: ensureDynamicAvatarUrl(tgUser.photo_url, tgUsername),
        isVerified: true,
      };
    }

    return INITIAL_MOCK_USER;
  });
  const coinMatchStarting = useRef(false);

  const [weeklyPerformance, setWeeklyPerformance] = useState<DayPerformance[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WEEKLY);
      if (saved) {
        return buildWeeklyData(JSON.parse(saved));
      }
    } catch {
      // fallback
    }
    return buildWeeklyData();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY, JSON.stringify(weeklyPerformance));
    } catch {
      // ignore
    }
  }, [weeklyPerformance]);

  // Dynamically derived Game Skill Matrix from user.gameStats
  const gameSkillMatrix: GameSkillStat[] = useMemo(() => {
    const stats = user.gameStats || INITIAL_GAME_STATS;
    const configs: { mode: GameMode; name: string }[] = [
      { mode: 'whot', name: 'Naija Whot' },
      { mode: 'ludo_blitz', name: 'Ludo Blitz' },
      { mode: 'ludo_classic', name: 'Classic Ludo' },
      { mode: 'draughts', name: 'Draughts Duel' },
      { mode: 'bead16', name: 'Bead 16 Tactics' },
    ];

    return configs.map(({ mode, name }) => {
      const s = stats[mode] || { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 };
      const winRate = s.matches > 0 ? parseFloat(((s.won / s.matches) * 100).toFixed(1)) : 0;
      let tier = 'Gold Staker';
      if (winRate >= 75) tier = 'Grandmaster I';
      else if (winRate >= 70) tier = 'Grandmaster II';
      else if (winRate >= 65) tier = 'Diamond I';
      else if (winRate >= 60) tier = 'Diamond II';
      else if (winRate >= 50) tier = 'Platinum I';

      return {
        gameMode: mode,
        name,
        matches: s.matches,
        won: s.won,
        lost: s.lost,
        winRate,
        profit: s.profit,
        currentStreak: s.currentStreak || 0,
        highestStreak: s.highestStreak || 0,
        tier,
      };
    });
  }, [user.gameStats]);

  const [activeTab, setActiveTab] = useState<TabType>('arena');
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(() => {
    try {
      const saved = localStorage.getItem(getActiveMatchStorageKey(user?.username));
      const match = saved ? JSON.parse(saved) as ActiveMatch : null;
      return match && match.status !== 'completed' && match.status !== 'cancelled' ? match : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user?.username) return;
    const key = getActiveMatchStorageKey(user.username);
    try {
      if (activeMatch && activeMatch.status !== 'completed' && activeMatch.status !== 'cancelled') {
        localStorage.setItem(key, JSON.stringify(activeMatch));
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Match recovery remains available from the server-side room snapshot.
    }
  }, [activeMatch, user?.username]);
  const [spectatingMatchId, setSpectatingMatchId] = useState<string | null>(null);
  const [openTables, setOpenTables] = useState<OpenTable[]>(INITIAL_OPEN_TABLES);
  const [escrowHistory, setEscrowHistory] = useState<EscrowTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ESCROW);
      if (saved) return restoreEscrowHistory(saved);
    } catch {
      // fallback
    }
    return [];
  });

  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WALLET_TX);
      if (saved) {
        const parsed: WalletTransaction[] = JSON.parse(saved);
        const DEMO_IDS = new Set(['wtx_101', 'wtx_102', 'wtx_103', 'wtx_104']);
        const DEMO_REFS = new Set(['DEP-88412', 'WD-98231', 'WD-97104', 'DEP-87002']);
        const clean = parsed.filter((t) => !DEMO_IDS.has(t.id) && (!t.reference || !DEMO_REFS.has(t.reference)));
        localStorage.setItem(STORAGE_KEY_WALLET_TX, JSON.stringify(clean));
        return clean;
      }
    } catch {
      // fallback
    }
    return INITIAL_WALLET_TRANSACTIONS;
  });


  const [activeReplay, setActiveReplay] = useState<MatchReplayData | null>(null);
  const recordedStepsRef = useRef<ReplayStep[]>([]);

  const recordReplayStep = useCallback((step: Omit<ReplayStep, 'stepIndex'>) => {
    const nextIdx = recordedStepsRef.current.length + 1;
    recordedStepsRef.current.push({
      ...step,
      stepIndex: nextIdx,
    });
  }, []);

  const clearReplaySteps = useCallback(() => {
    recordedStepsRef.current = [];
  }, []);

  const openReplay = useCallback((matchId: string) => {
    const replay = getReplayById(matchId);
    if (replay) {
      setActiveReplay(replay);
      sound.playClick();
      telegram.triggerHaptic('medium');
    } else {
      // Fallback: create dynamic placeholder replay if ID not found
      const matchTx = escrowHistory.find((t) => t.matchId === matchId || t.id === matchId);
      const mode = matchTx?.gameMode || 'whot';
      const fallbackReplay = getReplayById('M-7712'); // Use standard template
      if (fallbackReplay) {
        setActiveReplay({
          ...fallbackReplay,
          id: matchId,
          stake: matchTx?.stake || 2500,
          pot: matchTx?.pot || 4750,
          fee: matchTx?.fee || 250,
          winner: matchTx?.result === 'WON' ? 'player' : 'opponent',
          txHash: matchTx?.txHash || fallbackReplay.txHash,
        });
      }
    }
  }, [escrowHistory]);

  const closeReplay = useCallback(() => {
    setActiveReplay(null);
  }, []);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return [];
  });

  // Save notifications to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const openProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(true);
    sound.playClick();
  }, []);

  const closeProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(false);
  }, []);

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    sound.playClick();
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    sound.playClick();
  }, []);

  const addNotification = useCallback(
    (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
      const newNotif: AppNotification = {
        ...notif,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: 'Just now',
        read: false,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    },
    []
  );

  const updateUserProfile = useCallback((updates: Partial<UserProfile>) => {
    setUser((prev) => {
      const nextEmailVerified = updates.emailVerified !== undefined ? updates.emailVerified : prev.emailVerified;
      const nextPhoneVerified = updates.phoneVerified !== undefined ? updates.phoneVerified : prev.phoneVerified;
      const isVerified = Boolean(nextEmailVerified && nextPhoneVerified);

      const wasVerified = Boolean(prev.emailVerified && prev.phoneVerified);
      if (!wasVerified && isVerified) {
        addNotification({
          title: 'KYC Status Verified',
          message: 'Both your email address and phone number have been confirmed. Full verified player perks and higher withdrawal limits are now unlocked!',
          type: 'reward',
        });
        sound.playWin();
        telegram.triggerHaptic('success');
      }

      return {
        ...prev,
        ...updates,
        isVerified,
      };
    });
    telegram.triggerHaptic('light');
  }, [addNotification]);

  const bindTelegram = useCallback(
    (telegramId: number, botUsername = 'SkillStakeBot') => {
      setUser((prev) => ({
        ...prev,
        telegramId,
        telegramBindStatus: 'bound',
        telegramBotUsername: botUsername,
      }));
      addNotification({
        title: 'Telegram Bot Connected',
        message: `Account successfully bound to @${botUsername} (ID: ${telegramId}). Real-time escrow push alerts enabled.`,
        type: 'telegram',
      });
      telegram.triggerHaptic('success');
      sound.playWin();
    },
    [addNotification]
  );

  const unbindTelegram = useCallback(() => {
    setUser((prev) => ({
      ...prev,
      telegramId: undefined,
      telegramBindStatus: 'unbound',
    }));
    addNotification({
      title: 'Telegram Bot Unlinked',
      message: 'Telegram bot synchronization has been disconnected.',
      type: 'system',
    });
    telegram.triggerHaptic('medium');
  }, [addNotification]);

  const refreshLocation = useCallback(async (): Promise<string> => {
    try {
      const res = await autoDetectLocation();
      setUser((prev) => ({
        ...prev,
        location: res.formatted,
        locationAutoPicked: true,
      }));
      telegram.triggerHaptic('light');
      return res.formatted;
    } catch {
      return user.location || 'Lagos, Nigeria';
    }
  }, [user.location]);

  // Initial location auto-detect if not set
  useEffect(() => {
    if (!user.location) {
      autoDetectLocation().then((res) => {
        setUser((prev) => ({
          ...prev,
          location: res.formatted,
          locationAutoPicked: true,
        }));
      });
    }
  }, [user.location]);

  const lastSyncedRef = useRef<string>('');

  // Synchronize user profile & balance with backend database
  useEffect(() => {
    if (user?.id && user?.username) {
      const summary = summarizeGameStats(user.gameStats);
      const syncKey = `${user.id}_${user.availableBalance}_${user.escrowBalance}_${summary.allMatches}_${summary.allWon}_${summary.allLost}`;
      if (lastSyncedRef.current === syncKey) return;
      lastSyncedRef.current = syncKey;

      EscrowApiService.syncUser(
        user.id,
        user.username,
        user.availableBalance,
        user.displayName,
        user.email,
        summary.allMatches,
        summary.allWon,
        summary.allLost
      ).then((backendBalance) => {
        if (backendBalance) {
          setUser((prev) => {
            if (
              prev.availableBalance === backendBalance.availableBalance &&
              prev.escrowBalance === backendBalance.escrowLockedBalance
            ) {
              return prev;
            }
            return {
              ...prev,
              availableBalance: backendBalance.availableBalance,
              escrowBalance: backendBalance.escrowLockedBalance,
            };
          });
        }
      });
    }
  }, [user?.id, user?.username, user?.displayName, user?.email, user?.availableBalance, user?.escrowBalance, user?.winRate, user?.totalWagers]);

  // Periodically poll balance from backend (every 5 seconds) to auto-reflect Telegram admin deposit confirmations
  useEffect(() => {
    if (!user?.id) return;
    const interval = setInterval(() => {
      // Pause balance polling if user is currently playing a match to avoid in-flight race conditions
      if (activeMatch && activeMatch.status !== 'completed') return;

      EscrowApiService.fetchUserBalance(user.id, user.username).then((b) => {
        if (b) {
          setUser((prev) => {
            if (prev.availableBalance !== b.availableBalance || prev.escrowBalance !== b.escrowLockedBalance) {
              return {
                ...prev,
                availableBalance: b.availableBalance,
                escrowBalance: b.escrowLockedBalance,
              };
            }
            return prev;
          });
        }
      });

      // Periodically fetch live transactions from backend audit logs
      EscrowApiService.fetchUserTransactions(user.id).then((txs) => {
        if (txs && txs.length > 0) {
          setWalletTransactions((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newBackendTxs = txs.filter((t) => !existingIds.has(t.id));
            if (newBackendTxs.length > 0) {
              return [...newBackendTxs, ...prev];
            }
            return prev;
          });
        }
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id, user?.username]);



  // Save changes to local storage per-user
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      if (user.username) {
        localStorage.setItem(getUserStorageKey(user.username), JSON.stringify(user));
      }
      if (user.id) {
        localStorage.setItem(getUserStorageKey(user.id), JSON.stringify(user));
      }
    } catch {
      // ignore storage quota
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ESCROW, JSON.stringify(escrowHistory));
      if (user?.username) {
        localStorage.setItem(getEscrowStorageKey(user.username), JSON.stringify(escrowHistory));
      }
      if (user?.id) {
        localStorage.setItem(getEscrowStorageKey(user.id), JSON.stringify(escrowHistory));
      }
    } catch {
      // ignore
    }
  }, [escrowHistory, user?.username, user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WEEKLY, JSON.stringify(weeklyPerformance));
      if (user?.username) {
        localStorage.setItem(getWeeklyStorageKey(user.username), JSON.stringify(weeklyPerformance));
      }
      if (user?.id) {
        localStorage.setItem(getWeeklyStorageKey(user.id), JSON.stringify(weeklyPerformance));
      }
    } catch {
      // ignore
    }
  }, [weeklyPerformance, user?.username, user?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WALLET_TX, JSON.stringify(walletTransactions));
    } catch {
      // ignore
    }
  }, [walletTransactions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, isAuthenticated ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [isAuthenticated]);


  const openAuthModal = useCallback((tab: 'signin' | 'register' = 'signin') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanIdentifier = usernameOrEmail.trim();
    const cleanPassword = (password || '').trim();

    if (!cleanIdentifier) {
      return { success: false, error: 'Please enter your username or email' };
    }
    if (!cleanPassword) {
      return { success: false, error: 'Please enter your password' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanIdentifier, password: cleanPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid username/email or password.' };
      }
      if (data.sessionToken) localStorage.setItem(STORAGE_KEY_SESSION, data.sessionToken);

      // Restore saved per-user stats, win rate, weekly performance & escrow history
      const savedUserRaw =
        localStorage.getItem(getUserStorageKey(data.user.id)) ||
        localStorage.getItem(getUserStorageKey(data.user.username)) ||
        localStorage.getItem(getUserStorageKey(cleanIdentifier));

      const savedWeeklyRaw =
        localStorage.getItem(getWeeklyStorageKey(data.user.id)) ||
        localStorage.getItem(getWeeklyStorageKey(data.user.username)) ||
        localStorage.getItem(getWeeklyStorageKey(cleanIdentifier));

      const savedEscrowRaw =
        localStorage.getItem(getEscrowStorageKey(data.user.id)) ||
        localStorage.getItem(getEscrowStorageKey(data.user.username)) ||
        localStorage.getItem(getEscrowStorageKey(cleanIdentifier));

      let restoredUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
      let restoredGameStats = restoredUser?.gameStats || EMPTY_GAME_STATS;

      const isDemoAccount = false;
      const summary = summarizeGameStats(restoredGameStats as Record<string, GameStatEntry>);

      const authUser: UserProfile = {
        ...EMPTY_USER_PROFILE,
        ...restoredUser,
        id: data.user.id,
        username: data.user.username,
        displayName: data.user.displayName || restoredUser?.displayName || data.user.username,
        avatarUrl: ensureDynamicAvatarUrl(data.user.avatarUrl || restoredUser?.avatarUrl, data.user.username),
        email: data.user.email || restoredUser?.email || '',
        phone: data.user.phone || restoredUser?.phone || '',
        availableBalance: data.user.availableBalance !== undefined ? data.user.availableBalance : (restoredUser?.availableBalance || 0),
        escrowBalance: data.user.escrowBalance !== undefined ? data.user.escrowBalance : (restoredUser?.escrowBalance || 0),
        coinBalance: data.user.coinBalance ?? restoredUser?.coinBalance ?? 0,
        tier: restoredUser?.tier || 'Unranked',
        rank: restoredUser?.rank || 0,
        gameStats: restoredGameStats,
        winRate: summary.allMatches > 0 ? summary.liveWinRate : (restoredUser?.winRate || 0),
        totalWagers: summary.allMatches || restoredUser?.totalWagers || 0,
        netWinnings: restoredUser?.netWinnings ?? (summary.allMatches > 0 ? summary.liveNetWinnings : 0),
      };

      setUser(authUser);

      if (savedWeeklyRaw) {
        setWeeklyPerformance(buildWeeklyData(JSON.parse(savedWeeklyRaw)));
      } else {
        setWeeklyPerformance(buildWeeklyData(EMPTY_WEEKLY_DAYS));
      }

      setEscrowHistory(restoreEscrowHistory(savedEscrowRaw));

      setNotifications(WELCOME_NOTIFICATIONS);
      setOpenTables([]);
      setIsAuthenticated(true);
      setAuthModalOpen(false);
      telegram.triggerHaptic('success');
      sound.playWin();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error during sign in.' };
    }
  }, []);

  const register = useCallback(
    async (data: { username: string; password?: string; displayName: string; email: string; phone?: string }): Promise<{ success: boolean; error?: string }> => {
      if (!data.username.trim()) {
        return { success: false, error: 'Username is required' };
      }
      if (!data.password || data.password.trim().length < 4) {
        return { success: false, error: 'Password must be at least 4 characters long' };
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, referralCode: telegram.getStartParam() }),
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          return { success: false, error: resData.error || 'Registration failed' };
        }
        if (resData.sessionToken) localStorage.setItem(STORAGE_KEY_SESSION, resData.sessionToken);

        const newUser: UserProfile = {
          ...EMPTY_USER_PROFILE,
          id: resData.user.id,
          username: resData.user.username,
          displayName: resData.user.displayName,
          avatarUrl: ensureDynamicAvatarUrl(resData.user.avatarUrl, resData.user.username),
          email: resData.user.email,
          phone: resData.user.phone || '',
          availableBalance: 0,
          escrowBalance: 0,
          coinBalance: resData.user.coinBalance || 0,
          referralCode: resData.user.referralCode,
        };

        setUser(newUser);
        setEscrowHistory([]);
        setNotifications(WELCOME_NOTIFICATIONS);
        setWeeklyPerformance(buildWeeklyData(EMPTY_WEEKLY_DAYS));
        setOpenTables([]);
        setIsAuthenticated(true);
        setAuthModalOpen(false);
        telegram.triggerHaptic('success');
        sound.playWin();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message || 'Connection error during registration.' };
      }
    },
    []
  );

  const loginWithTelegram = useCallback(
    async (tgPayload?: { initData?: string; user?: any; startParam?: string }): Promise<{ success: boolean; error?: string }> => {
      const tgUser = tgPayload?.user || telegram.getUser();
      const initData = tgPayload?.initData || telegram.getInitData();
      const startParam = tgPayload?.startParam || telegram.getStartParam();

      const effectiveUser = tgUser || {
        id: 729104882,
        first_name: 'Telegram',
        last_name: 'Player',
        username: 'telegram_champ',
      };

      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData,
            user: effectiveUser,
            startParam,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || 'Telegram authentication failed.' };
        }
        const authToken = data.sessionToken || data.token;
        if (authToken) localStorage.setItem(STORAGE_KEY_SESSION, authToken);

        const cleanIdentifier = data.user.username;
        const savedUserRaw =
          localStorage.getItem(getUserStorageKey(data.user.id)) ||
          localStorage.getItem(getUserStorageKey(data.user.username)) ||
          localStorage.getItem(getUserStorageKey(cleanIdentifier));

        const savedWeeklyRaw =
          localStorage.getItem(getWeeklyStorageKey(data.user.id)) ||
          localStorage.getItem(getWeeklyStorageKey(data.user.username));

        const savedEscrowRaw =
          localStorage.getItem(getEscrowStorageKey(data.user.id)) ||
          localStorage.getItem(getEscrowStorageKey(data.user.username));

        let restoredUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
        let restoredGameStats = restoredUser?.gameStats || EMPTY_GAME_STATS;
        const summary = summarizeGameStats(restoredGameStats as Record<string, GameStatEntry>);

        const authUser: UserProfile = {
          ...EMPTY_USER_PROFILE,
          ...restoredUser,
          id: data.user.id,
          telegramId: data.user.telegramId,
          username: data.user.username,
          displayName: data.user.displayName || restoredUser?.displayName || data.user.username,
          avatarUrl: ensureDynamicAvatarUrl(data.user.avatarUrl || restoredUser?.avatarUrl, data.user.username),
          email: data.user.email || restoredUser?.email || '',
          phone: data.user.phone || restoredUser?.phone || '',
          availableBalance: data.user.availableBalance !== undefined ? data.user.availableBalance : (restoredUser?.availableBalance || 0),
          escrowBalance: data.user.escrowBalance !== undefined ? data.user.escrowBalance : (restoredUser?.escrowBalance || 0),
          coinBalance: data.user.coinBalance ?? restoredUser?.coinBalance ?? 0,
          referralCode: data.user.referralCode || restoredUser?.referralCode,
          isVerified: true,
          tier: restoredUser?.tier || 'Unranked',
          rank: restoredUser?.rank || 0,
          gameStats: restoredGameStats,
          winRate: summary.allMatches > 0 ? summary.liveWinRate : (restoredUser?.winRate || 0),
          totalWagers: summary.allMatches || restoredUser?.totalWagers || 0,
          netWinnings: restoredUser?.netWinnings ?? (summary.allMatches > 0 ? summary.liveNetWinnings : 0),
          telegramBindStatus: 'bound',
        };

        setUser(authUser);
        if (savedWeeklyRaw) {
          setWeeklyPerformance(buildWeeklyData(JSON.parse(savedWeeklyRaw)));
        } else {
          setWeeklyPerformance(buildWeeklyData(EMPTY_WEEKLY_DAYS));
        }

        setEscrowHistory(restoreEscrowHistory(savedEscrowRaw));

        setNotifications(WELCOME_NOTIFICATIONS);
        setOpenTables([]);
        setIsAuthenticated(true);
        setAuthModalOpen(false);
        telegram.triggerHaptic('success');
        sound.playWin();

        return { success: true };
      } catch (err: any) {
        console.error('Error logging in with Telegram:', err);
        return { success: false, error: err.message || 'Failed to authenticate with Telegram.' };
      }
    },
    []
  );

  // Auto-authenticate immediately if inside Telegram WebApp
  useEffect(() => {
    if (telegram.isTelegram()) {
      const tgUser = telegram.getUser();
      const initData = telegram.getInitData();
      if (tgUser || initData) {
        loginWithTelegram({ initData, user: tgUser, startParam: telegram.getStartParam() || undefined });
      }
    }
  }, [loginWithTelegram]);

  const loginAsDemo = useCallback(() => {
    const DEMO_USER: UserProfile = {
      id: 'usr_me',
      username: 'Player_Demo',
      displayName: 'Player One',
      avatarUrl: getDynamicAvatarUrl('Player_Demo'),
      email: 'player@skillstake.ng',
      emailVerified: false,
      phone: '',
      phoneVerified: false,
      isVerified: false,
      tier: 'Unranked',
      availableBalance: 0,
      escrowBalance: 0,
      winRate: 0,
      totalWagers: 0,
      netWinnings: 0,
      rank: 0,
      location: 'Lagos, Nigeria',
      locationAutoPicked: false,
      gameStats: EMPTY_GAME_STATS,
      coinBalance: 2000,
    };

    localStorage.removeItem(STORAGE_KEY_SESSION);
    setUser(DEMO_USER);
    setEscrowHistory(DEMO_ESCROW_HISTORY);
    setNotifications(INITIAL_NOTIFICATIONS);
    setWeeklyPerformance(buildWeeklyData(DEMO_WEEKLY_DAYS));
    setOpenTables(DEMO_OPEN_TABLES);
    setIsAuthenticated(true);
    setAuthModalOpen(false);
    telegram.triggerHaptic('success');
    sound.playWin();
  }, []);

  const logout = useCallback(() => {
    try {
      if (user?.username) {
        localStorage.setItem(getUserStorageKey(user.username), JSON.stringify(user));
        localStorage.setItem(getWeeklyStorageKey(user.username), JSON.stringify(weeklyPerformance));
        localStorage.setItem(getEscrowStorageKey(user.username), JSON.stringify(escrowHistory));
      }
      if (user?.id) {
        localStorage.setItem(getUserStorageKey(user.id), JSON.stringify(user));
        localStorage.setItem(getWeeklyStorageKey(user.id), JSON.stringify(weeklyPerformance));
        localStorage.setItem(getEscrowStorageKey(user.id), JSON.stringify(escrowHistory));
      }
      if (activeMatch?.coinMatchId) {
        const session = localStorage.getItem(STORAGE_KEY_SESSION);
        if (session) {
          void fetch(`/api/coins/ai-matches/${encodeURIComponent(activeMatch.coinMatchId)}/forfeit`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' },
            body: '{}',
          }).catch(() => undefined);
        }
      }
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch {
      // ignore
    }

    setIsAuthenticated(false);
    setActiveMatch(null);
    telegram.triggerHaptic('selection');
    sound.playClick();
  }, [user, weeklyPerformance, escrowHistory, activeMatch]);


  const updateTeteCoinBalance = useCallback((balance: number) => {
    if (!Number.isFinite(balance)) return;
    setUser((prev) => ({ ...prev, coinBalance: balance }));
  }, []);

  const completeCoinAiMatch = useCallback((winner: 'player' | 'opponent') => {
    setActiveMatch((prev) => prev?.coinMatchId
      ? { ...prev, status: 'completed', settledResult: winner, settledAt: new Date().toLocaleTimeString() }
      : prev);
  }, []);

  const submitCoinAiAction = useCallback(async (action: Record<string, unknown>): Promise<boolean> => {
    const matchId = activeMatch?.coinMatchId;
    if (!matchId || !activeMatch) return false;
    try {
      const { TeteCoinMatchService, publishCoinGameState } = await import('../services/teteCoinMatchService');
      const result = await TeteCoinMatchService.act(matchId, action);
      updateTeteCoinBalance(result.balance);
      if (Number.isFinite(result.state?.turnDeadlineAt)) setActiveMatch((prev) => prev?.coinMatchId === matchId ? { ...prev, turnDeadlineAt: result.state.turnDeadlineAt } : prev);
      publishCoinGameState(activeMatch.gameMode, result);
      if (result.status === 'SETTLED' && result.winner) completeCoinAiMatch(result.winner === 'p2' ? 'player' : 'opponent');
      return true;
    } catch (error: any) {
      addNotification({ title: 'Move not applied', message: error?.message || 'The server could not verify that move. Refresh the match state and try again.', type: 'system' });
      if (error?.status === 409) {
        try {
          const { TeteCoinMatchService, publishCoinGameState } = await import('../services/teteCoinMatchService');
          const current = await TeteCoinMatchService.load(matchId);
          updateTeteCoinBalance(current.balance);
          if (Number.isFinite(current.state?.turnDeadlineAt)) setActiveMatch((prev) => prev?.coinMatchId === matchId ? { ...prev, turnDeadlineAt: current.state.turnDeadlineAt } : prev);
          publishCoinGameState(activeMatch.gameMode, current);
        } catch { /* Keep the saved server state as the recovery source. */ }
      }
      return false;
    }
  }, [activeMatch?.coinMatchId, activeMatch?.gameMode, updateTeteCoinBalance, completeCoinAiMatch, addNotification]);

  const timeoutCoinAiMatch = useCallback(async (): Promise<boolean> => {
    if (!activeMatch?.coinMatchId) return false;
    try {
      const { TeteCoinMatchService, publishCoinGameState } = await import('../services/teteCoinMatchService');
      const result = await TeteCoinMatchService.timeout(activeMatch.coinMatchId);
      updateTeteCoinBalance(result.balance);
      if (Number.isFinite(result.state?.turnDeadlineAt)) setActiveMatch((prev) => prev?.coinMatchId === activeMatch.coinMatchId ? { ...prev, turnDeadlineAt: result.state.turnDeadlineAt } : prev);
      publishCoinGameState(activeMatch.gameMode, result);
      if (result.status === 'SETTLED') completeCoinAiMatch('opponent');
      return true;
    } catch (error: any) {
      if (error?.status === 409) return false;
      addNotification({ title: 'Turn timeout pending', message: error?.message || 'The server could not settle the expired turn.', type: 'system' });
      return false;
    }
  }, [activeMatch?.coinMatchId, activeMatch?.gameMode, updateTeteCoinBalance, completeCoinAiMatch, addNotification]);

  const startCoinAiMatch = useCallback(async (stake: number, gameMode: GameMode = 'bead16'): Promise<boolean> => {
    if (coinMatchStarting.current) return false;
    if (!localStorage.getItem(STORAGE_KEY_SESSION)) {
      setAuthModalTab('signin');
      setAuthModalOpen(true);
      addNotification({ title: 'Sign in required', message: 'Sign in with a verified account to play for Tete Coins.', type: 'system' });
      return false;
    }
    coinMatchStarting.current = true;
    try {
      const { startTeteCoinBead16Match } = await import('../services/teteCoinMatchService');
      const { match, activeMatch: newMatch } = await startTeteCoinBead16Match(
        stake,
        user.coinBalance,
        user.username,
        isAuthenticated,
        Boolean(activeMatch?.coinMatchId && activeMatch.status !== 'completed'),
        gameMode
      );
      updateTeteCoinBalance(match.balance);
      clearReplaySteps();
      setActiveMatch(newMatch);
      telegram.triggerHaptic('medium');
      sound.playClick();
      return true;
    } catch (error: any) {
      addNotification({ title: 'Could not start match', message: error?.message || 'The server could not lock your Tete Coins.', type: 'system' });
      return false;
    } finally {
      coinMatchStarting.current = false;
    }
  }, [isAuthenticated, activeMatch?.coinMatchId, activeMatch?.status, user.coinBalance, user.username, addNotification, updateTeteCoinBalance, clearReplaySteps]);

  useEffect(() => {
    if (!activeMatch?.coinMatchId || activeMatch.status === 'completed') return;
    let cancelled = false;
    void import('../services/teteCoinMatchService').then(async ({ TeteCoinMatchService, publishCoinGameState }) => {
      try {
        const current = await TeteCoinMatchService.load(activeMatch.coinMatchId!);
        if (cancelled) return;
        updateTeteCoinBalance(current.balance);
        if (Number.isFinite(current.state?.turnDeadlineAt)) setActiveMatch((prev) => prev?.coinMatchId === activeMatch.coinMatchId ? { ...prev, turnDeadlineAt: current.state.turnDeadlineAt } : prev);
        publishCoinGameState(activeMatch.gameMode, current);
        if (current.status === 'SETTLED' && current.winner) completeCoinAiMatch(current.winner === 'p2' ? 'player' : 'opponent');
      } catch (error) {
        if (!cancelled) console.warn('Could not restore Tete Coin match state:', error);
      }
    });
    return () => { cancelled = true; };
  }, [activeMatch?.coinMatchId, activeMatch?.gameMode, activeMatch?.status, updateTeteCoinBalance, completeCoinAiMatch]);

  const startMatch = useCallback(
    (
      gameMode: GameMode,
      stake: number,
      isPrivate: boolean = false,
      roomCode?: string,
      opponent?: ActiveMatch['opponent'],
      isVsAi?: boolean,
      hostUsernameParam?: string,
      initialStatus: MatchStatus = 'locked_escrow',
      turnMode: TurnMode = gameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual'
    ): boolean => {
      // Strict client-side balance validation check
      if (user.availableBalance < stake) {
        telegram.triggerHaptic('error');
        addNotification({
          title: 'Insufficient Balance',
          message: `Your active balance (₦${user.availableBalance.toLocaleString()}) cannot cover the ₦${stake.toLocaleString()} stake. Please deposit funds first.`,
          type: 'system',
        });
        return false;
      }

      // Prevent self-play (a user playing against their own account)
      if (
        opponent &&
        user &&
        opponent.username &&
        user.username &&
        opponent.username.trim().toLowerCase() === user.username.trim().toLowerCase() &&
        !isVsAi
      ) {
        telegram.triggerHaptic('error');
        addNotification({
          title: 'Self-Play Restricted',
          message: `Self-Play is forbidden. You cannot play against your own account (@${user.username}).`,
          type: 'system',
        });
        return false;
      }

      const pot = Math.round(stake * 1.9); // Gate fee deducted pot
      const fee = Math.round(stake * 0.1);
      const generatedCode = roomCode || `TG-${Math.floor(1000 + Math.random() * 9000)}`;
      const matchIsVsAi = isVsAi !== undefined ? isVsAi : !(isPrivate || roomCode);
      const matchId = roomCode
        ? `M-${roomCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40)}`
        : `M-${Math.random().toString(36).slice(2, 12).toUpperCase()}`;

      const isWaitingForOpponent = initialStatus === 'waiting_for_opponent';

      const opp = opponent || {
        id: isWaitingForOpponent ? 'waiting' : matchIsVsAi ? 'bot_' + Math.random().toString(36).substring(2, 7) : 'opp_' + Math.random().toString(36).substring(2, 7),
        username: isWaitingForOpponent
          ? 'Waiting for Opponent...'
          : isPrivate
          ? 'Challenger'
          : 'odogwuking',
        displayName: isWaitingForOpponent
          ? 'Waiting for Challenger'
          : isPrivate
          ? 'Private Challenger'
          : 'Odogwuking',
        avatarUrl: getDynamicAvatarUrl('odogwuking'),
        winRate: 67.2,
      };

      const gameTypeMapping: Record<GameMode, 'WHOT' | 'LUDO' | 'DRAUGHTS' | 'BEAD16'> = {
        whot: 'WHOT',
        ludo_blitz: 'LUDO',
        ludo_classic: 'LUDO',
        draughts: 'DRAUGHTS',
        bead16: 'BEAD16',
      };

      // Clear live replay step buffer for new match
      clearReplaySteps();

      const escrowRequest = isWaitingForOpponent
        ? EscrowApiService.reserveMatch({
            matchId,
            roomCode: generatedCode,
            gameType: gameTypeMapping[gameMode] || 'WHOT',
            playerId: user.id,
            playerUsername: user.username,
            stakeAmount: stake,
          }).then((res) => ({ player1Balance: res.playerBalance }))
        : EscrowApiService.startMatch({
            matchId,
            roomCode: generatedCode,
            gameType: gameTypeMapping[gameMode] || 'WHOT',
            player1Id: user.id,
            player1Username: user.username,
            player2Id: opp.id,
            player2Username: opp.username,
            stakeAmount: stake,
          });
      escrowRequest
        .then((res) => {
          const balance = res?.player1Balance;
          if (balance) setUser((prev) => ({
              ...prev,
              availableBalance: balance.availableBalance,
              escrowBalance: balance.escrowLockedBalance,
            }));
        })
        .catch((err) => {
          console.error('Backend escrow reservation error:', err);
          setActiveMatch((prev) => prev?.id === matchId ? null : prev);
          addNotification({
            title: 'Stake could not be locked',
            message: err?.message || 'The match was not started because the stake could not be secured.',
            type: 'system',
          });
        });

      // Update active match state
      const newMatch: ActiveMatch = {
        id: matchId,
        roomCode: generatedCode,
        gameMode,
        turnMode,
        turnDeadlineAt: Date.now() + TURN_MODE_SECONDS[turnMode] * 1000,
        stake,
        pot,
        fee,
        status: isWaitingForOpponent ? 'waiting_for_opponent' : 'locked_escrow',
        hostUsername: hostUsernameParam || user.username,
        opponent: opp,
        isPrivate,
        isVsAi: matchIsVsAi,
        isP2P: !matchIsVsAi,
      };

      setActiveMatch(newMatch);
      telegram.triggerHaptic('medium');
      sound.playClick();
      return true;
    },
    [user.availableBalance, user.id, user.username, addNotification]
  );

  const settleMatch = useCallback(
    (winner: 'player' | 'opponent' | 'draw'): string => {
      if (!activeMatch) return '';

      // Prevent double settlement if already settled
      if (activeMatch.status === 'completed' && activeMatch.finalizedTxHash) {
        return activeMatch.finalizedTxHash;
      }

      const { stake, pot, fee, gameMode, opponent, id: matchId } = activeMatch;
      const txHash =
        '0x' + Array.from({ length: 28 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      // Update active match status to completed and store provisional finalizedTxHash
      setActiveMatch((prev) =>
        prev
          ? {
              ...prev,
              status: 'completed',
              finalizedTxHash: txHash,
              settledResult: winner,
              settledAt: new Date().toLocaleTimeString(),
            }
          : null
      );

      const winnerId = winner === 'player' ? user.id : opponent.id;
      const profitGain = pot - stake;

      // Immediately mark active match as completed to prevent double-refund on match exit
      setActiveMatch((prev) => (prev ? { ...prev, status: 'completed' } : null));

      // The server owns stake movement; the client only mirrors the settled wallet.
      const settleRequest = winner === 'draw'
        ? EscrowApiService.refundMatch(matchId, 'Match ended in a draw').then(() =>
            EscrowApiService.fetchUserBalance(user.id, user.username).then((balance) => {
              if (balance) setUser((prev) => ({ ...prev, availableBalance: balance.availableBalance, escrowBalance: balance.escrowLockedBalance }));
              return null;
            })
          )
        : EscrowApiService.verifyAndSettle({
        matchId,
        winnerId,
        reason: `Match won by ${winner === 'player' ? user.username : opponent.username}`,
        evidence: {
          gameMode,
          winner,
          player1Id: user.id,
          player2Id: opponent.id,
          stake,
          pot,
          clientTimestamp: Date.now(),
        },
      });
      settleRequest
        .then((settlementResult) => {
          if (settlementResult) {
            const cleanUser = user.username ? user.username.trim().toLowerCase() : '';
            const myBalance = [settlementResult.winner, settlementResult.loser].find((rec) => {
              if (!rec) return false;
              if (rec.userId && user.id && rec.userId.toLowerCase() === user.id.toLowerCase()) return true;
              if (rec.userId && cleanUser && rec.userId.toLowerCase() === `usr_${cleanUser}`) return true;
              if (rec.username && cleanUser && cleanUser !== 'player' && rec.username.trim().toLowerCase() === cleanUser) return true;
              return false;
            });
            if (myBalance) {
              setUser((prev) => ({
                ...prev,
                availableBalance: myBalance.availableBalance,
                escrowBalance: myBalance.escrowLockedBalance,
              }));
            }
            const earnedCoins = settlementResult.coinRewards?.find((reward) => reward.userId === user.id && typeof reward.balance === 'number');
            if (earnedCoins) setUser((prev) => ({ ...prev, coinBalance: earnedCoins.balance }));
            if (settlementResult.settlementTxHash) {
              setActiveMatch((prev) =>
                prev ? { ...prev, status: 'completed', finalizedTxHash: settlementResult.settlementTxHash } : null
              );
            }
          }
        })
        .catch((err) => {
          console.warn('Backend settlement verification warning:', err);
        });

      if (winner === 'player') {
        // Player won the pot!
        setUser((prev) => {
          const currentStats = prev.gameStats || INITIAL_GAME_STATS;
          const g = currentStats[gameMode] || { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 };
          const nextStreak = g.currentStreak + 1;
          const nextHighest = Math.max(g.highestStreak, nextStreak);

          const nextGameStats = {
            ...currentStats,
            [gameMode]: {
              matches: g.matches + 1,
              won: g.won + 1,
              lost: g.lost,
              profit: g.profit + profitGain,
              currentStreak: nextStreak,
              highestStreak: nextHighest,
            },
          };

          const summary = summarizeGameStats(nextGameStats);

          return {
            ...prev,
            netWinnings: prev.netWinnings + profitGain,
            totalWagers: summary.allMatches,
            winRate: summary.liveWinRate,
            gameStats: nextGameStats,
          };
        });

        setWeeklyPerformance((prev) =>
          prev.map((day) => {
            if (day.isToday) {
              return {
                ...day,
                battles: day.battles + 1,
                won: day.won + 1,
                profit: day.profit + profitGain,
              };
            }
            return day;
          })
        );

        const newTx: EscrowTransaction = {
          id: `tx_${Date.now().toString().slice(-4)}`,
          matchId,
          gameMode,
          stake,
          pot,
          fee,
          opponentUsername: opponent.username,
          result: 'WON',
          txHash,
          timestamp: 'Just now',
          status: 'RELEASED',
        };
        setEscrowHistory((prev) => [newTx, ...prev]);
        telegram.triggerHaptic('success');
      } else if (winner === 'opponent') {
        // Opponent won
        setUser((prev) => {
          const currentStats = prev.gameStats || INITIAL_GAME_STATS;
          const g = currentStats[gameMode] || { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 };

          const nextGameStats = {
            ...currentStats,
            [gameMode]: {
              matches: g.matches + 1,
              won: g.won,
              lost: g.lost + 1,
              profit: g.profit - stake,
              currentStreak: 0,
              highestStreak: g.highestStreak,
            },
          };

          const summary = summarizeGameStats(nextGameStats);

          return {
            ...prev,
            netWinnings: prev.netWinnings - stake,
            totalWagers: summary.allMatches,
            winRate: summary.liveWinRate,
            gameStats: nextGameStats,
          };
        });

        setWeeklyPerformance((prev) =>
          prev.map((day) => {
            if (day.isToday) {
              return {
                ...day,
                battles: day.battles + 1,
                lost: day.lost + 1,
                profit: day.profit - stake,
              };
            }
            return day;
          })
        );

        const newTx: EscrowTransaction = {
          id: `tx_${Date.now().toString().slice(-4)}`,
          matchId,
          gameMode,
          stake,
          pot,
          fee,
          opponentUsername: opponent.username,
          result: 'LOST',
          txHash,
          timestamp: 'Just now',
          status: 'FEE_DEDUCTED',
        };
        setEscrowHistory((prev) => [newTx, ...prev]);
        telegram.triggerHaptic('warning');
      } else {
        // Draw / Refund
        const newTx: EscrowTransaction = {
          id: `tx_${Date.now().toString().slice(-4)}`,
          matchId,
          gameMode,
          stake,
          pot,
          fee: 0,
          opponentUsername: opponent.username,
          result: 'REFUNDED',
          txHash,
          timestamp: 'Just now',
          status: 'REFUNDED',
        };
        setEscrowHistory((prev) => [newTx, ...prev]);
      }

      // Generate & persist replay data for this settled match
      try {
        let finalSteps: ReplayStep[] = [];

        if (recordedStepsRef.current && recordedStepsRef.current.length > 0) {
          finalSteps = recordedStepsRef.current.map((s, idx) => ({
            ...s,
            stepIndex: idx + 1,
          }));

          // Append final Oracle settlement step
          const oracleStep: ReplayStep = {
            stepIndex: finalSteps.length + 1,
            turn: 'player',
            actorName: 'Polygon Escrow Oracle',
            actorAvatar: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150',
            actionTitle: 'Escrow Settlement Finalized (Net Pot Payout)',
            actionDescription: `Oracle verified state outcome on-chain and disbursed ₦${pot.toLocaleString()} net pot to winner. Tx: ${txHash.slice(0, 14)}...`,
            timestampOffset: `${Math.max(1, Math.floor(finalSteps.length * 0.25))}m ${(finalSteps.length * 15) % 60}s`,
            isKeyMoment: true,
          };
          finalSteps.push(oracleStep);
        } else {
          // Comprehensive 10-step full match timeline fallback
          finalSteps = [
            {
              stepIndex: 1,
              turn: 'player',
              actorName: user.displayName,
              actorAvatar: user.avatarUrl,
              actionTitle: 'Match Opening Move',
              actionDescription: `${user.displayName} opened the table with initial placement.`,
              timestampOffset: '0:05',
            },
            {
              stepIndex: 2,
              turn: 'opponent',
              actorName: opponent.displayName,
              actorAvatar: opponent.avatarUrl,
              actionTitle: 'Opponent Opening Counter',
              actionDescription: `${opponent.displayName} matched opening positioning on track.`,
              timestampOffset: '0:22',
            },
            {
              stepIndex: 3,
              turn: 'player',
              actorName: user.displayName,
              actorAvatar: user.avatarUrl,
              actionTitle: 'Strategic Advance',
              actionDescription: `${user.displayName} pushed forward to gain central control.`,
              timestampOffset: '0:45',
            },
            {
              stepIndex: 4,
              turn: 'opponent',
              actorName: opponent.displayName,
              actorAvatar: opponent.avatarUrl,
              actionTitle: 'Mid-Game Attack Pressure',
              actionDescription: `${opponent.displayName} executed offensive attack strategy.`,
              timestampOffset: '1:10',
              isKeyMoment: true,
            },
            {
              stepIndex: 5,
              turn: 'player',
              actorName: user.displayName,
              actorAvatar: user.avatarUrl,
              actionTitle: 'Tactical Defense Counter',
              actionDescription: `${user.displayName} deflected opponent pressure and secured safe ground.`,
              timestampOffset: '1:35',
            },
            {
              stepIndex: 6,
              turn: 'opponent',
              actorName: opponent.displayName,
              actorAvatar: opponent.avatarUrl,
              actionTitle: 'Opponent Tactical Push',
              actionDescription: `${opponent.displayName} advanced pieces towards home lane.`,
              timestampOffset: '2:05',
            },
            {
              stepIndex: 7,
              turn: 'player',
              actorName: user.displayName,
              actorAvatar: user.avatarUrl,
              actionTitle: 'High Stakes Surge',
              actionDescription: `${user.displayName} created check-out opportunity!`,
              timestampOffset: '2:30',
              isKeyMoment: true,
            },
            {
              stepIndex: 8,
              turn: 'opponent',
              actorName: opponent.displayName,
              actorAvatar: opponent.avatarUrl,
              actionTitle: 'Final Defense Struggle',
              actionDescription: `${opponent.displayName} attempted defensive block.`,
              timestampOffset: '2:55',
            },
            {
              stepIndex: 9,
              turn: winner === 'player' ? 'player' : 'opponent',
              actorName: winner === 'player' ? user.displayName : opponent.displayName,
              actorAvatar: winner === 'player' ? user.avatarUrl : opponent.avatarUrl,
              actionTitle: 'MATCH WINNING CHECKOUT / FINISH',
              actionDescription:
                winner === 'player'
                  ? `🏆 ${user.displayName} executed the final match-winning move and claimed victory!`
                  : `🏆 ${opponent.displayName} completed final check-out to claim victory.`,
              timestampOffset: '3:20',
              isKeyMoment: true,
            },
            {
              stepIndex: 10,
              turn: 'player',
              actorName: 'Polygon Escrow Oracle',
              actorAvatar: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=150',
              actionTitle: 'Escrow Settlement Finalized (Net Pot Payout)',
              actionDescription: `Oracle verified state outcome on-chain and disbursed ₦${pot.toLocaleString()} net pot to winner. Tx: ${txHash.slice(0, 14)}...`,
              timestampOffset: '3:45',
              isKeyMoment: true,
            },
          ];
        }

        const generatedReplay: MatchReplayData = {
          id: matchId,
          gameMode,
          roomCode: activeMatch.roomCode,
          stake,
          pot,
          fee,
          winner: winner === 'draw' ? 'player' : winner,
          player1: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
          player2: {
            id: opponent.id,
            username: opponent.username,
            displayName: opponent.displayName,
            avatarUrl: opponent.avatarUrl,
          },
          totalTurns: finalSteps.length,
          duration: `${Math.max(2, Math.floor(finalSteps.length * 0.3))}m 30s`,
          timestamp: 'Just now',
          txHash,
          finalReason:
            winner === 'player'
              ? `${user.displayName} achieved match victory and claimed the ₦${pot.toLocaleString()} pot!`
              : `${opponent.displayName} achieved match victory and claimed the ₦${pot.toLocaleString()} pot!`,
          steps: finalSteps,
        };
        saveReplay(generatedReplay);
      } catch {
        // ignore
      }

      return txHash;
    },
    [activeMatch, user.id, user.username, user.displayName, user.avatarUrl]
  );

  const simulateMatchResult = useCallback(
    (gameMode: GameMode, stake: number, outcome: 'WON' | 'LOST') => {
      // Execute backend-authoritative calculation
      EscrowApiService.simulateSettlement({
        userId: user.id,
        username: user.username,
        gameMode,
        stakeAmount: stake,
        outcome,
      })
        .then((res) => {
          if (res?.user) {
            setUser((prev) => ({
              ...prev,
              availableBalance: res.user.availableBalance,
              escrowBalance: res.user.escrowLockedBalance,
            }));
          }
        })
        .catch((err) => console.warn('Simulation backend error:', err));

      const pot = Math.round(stake * 1.9);
      const fee = Math.round(stake * 0.1);
      const isWin = outcome === 'WON';
      const profitDelta = isWin ? pot - stake : -stake;
      const txHash =
        '0x' + Array.from({ length: 28 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      setUser((prev) => {
        const currentStats = prev.gameStats || INITIAL_GAME_STATS;
        const g = currentStats[gameMode] || { matches: 0, won: 0, lost: 0, profit: 0, currentStreak: 0, highestStreak: 0 };
        const nextStreak = isWin ? g.currentStreak + 1 : 0;
        const nextHighest = Math.max(g.highestStreak, nextStreak);

        const nextGameStats = {
          ...currentStats,
          [gameMode]: {
            matches: g.matches + 1,
            won: isWin ? g.won + 1 : g.won,
            lost: !isWin ? g.lost + 1 : g.lost,
            profit: g.profit + profitDelta,
            currentStreak: nextStreak,
            highestStreak: nextHighest,
          },
        };

        const summary = summarizeGameStats(nextGameStats);

        return {
          ...prev,
          availableBalance: isWin ? prev.availableBalance + pot : prev.availableBalance,
          escrowBalance: Math.max(0, prev.escrowBalance - stake),
          netWinnings: prev.netWinnings + profitDelta,
          totalWagers: summary.allMatches,
          winRate: summary.liveWinRate,
          gameStats: nextGameStats,
        };
      });

      setWeeklyPerformance((prev) =>
        prev.map((day) => {
          if (day.isToday) {
            return {
              ...day,
              battles: day.battles + 1,
              won: isWin ? day.won + 1 : day.won,
              lost: !isWin ? day.lost + 1 : day.lost,
              profit: day.profit + profitDelta,
            };
          }
          return day;
        })
      );

      const newTx: EscrowTransaction = {
        id: `tx_${Date.now().toString().slice(-4)}`,
        matchId: `M-${Math.floor(1000 + Math.random() * 9000)}`,
        gameMode,
        stake,
        pot: isWin ? pot : 0,
        fee,
        opponentUsername: isWin ? 'LagosStaker' : 'AbujaViper',
        result: isWin ? 'WON' : 'LOST',
        txHash,
        timestamp: 'Just now',
        status: isWin ? 'RELEASED' : 'FEE_DEDUCTED',
      };
      setEscrowHistory((prev) => [newTx, ...prev]);

      const modeLabels: Record<GameMode, string> = {
        whot: 'Naija Whot',
        ludo_classic: 'Classic Ludo',
        ludo_blitz: 'Ludo Blitz',
        draughts: 'Draughts Duel',
        bead16: 'Bead 16 Tactics',
      };

      if (isWin) {
        addNotification({
          title: `+₦${pot.toLocaleString()} Escrow Payout Released`,
          message: `Live duel settled in ${modeLabels[gameMode]}. Escrow portfolio win rate and weekly net increased!`,
          type: 'escrow',
          amount: pot,
        });
        sound.playWin();
        telegram.triggerHaptic('success');
      } else {
        addNotification({
          title: `-₦${stake.toLocaleString()} Escrow Deducted`,
          message: `Duel settled in ${modeLabels[gameMode]}. Live portfolio telemetry and game skill matrix updated.`,
          type: 'match',
        });
        sound.playClick();
        telegram.triggerHaptic('warning');
      }
    },
    [user.id, user.username, addNotification]
  );

  const resetLiveTelemetry = useCallback(() => {
    setUser((prev) => ({
      ...prev,
      winRate: 68.3,
      totalWagers: 142,
      netWinnings: 184500,
      gameStats: INITIAL_GAME_STATS,
    }));
    setWeeklyPerformance(buildWeeklyData());
    addNotification({
      title: 'Telemetry Baseline Restored',
      message: 'Escrow portfolio win rate, weekly performance, and game skill matrix returned to baseline benchmark.',
      type: 'system',
    });
    sound.playClick();
    telegram.triggerHaptic('medium');
  }, [addNotification]);

  const forfeitMatch = useCallback(() => {
    if (activeMatch && activeMatch.status !== 'completed') {
      if (activeMatch.coinMatchId) {
        import('../services/teteCoinMatchService').then(({ TeteCoinMatchService }) => TeteCoinMatchService.forfeit(activeMatch.coinMatchId!)).then((result) => {
          updateTeteCoinBalance(result.balance);
          const outcome = result.winner === 'p2' ? 'player' : 'opponent';
          setActiveMatch((prev) => prev ? { ...prev, status: 'completed', settledResult: outcome, settledAt: new Date().toLocaleTimeString() } : null);
          addNotification({ title: 'Match Forfeited', message: `You forfeited the Bead 16 match and lost ${activeMatch.stake} Tete Coins.`, type: 'match' });
        }).catch((error) => addNotification({ title: 'Could not forfeit match', message: error?.message || 'Try again when your connection is restored.', type: 'system' }));
        return;
      }
      const oppUsername = activeMatch.opponent.username;
      const stakeAmt = activeMatch.stake;
      settleMatch('opponent');
      addNotification({
        title: 'Match Forfeited',
        message: `You forfeited the duel against @${oppUsername}. ₦${stakeAmt.toLocaleString()} stake transferred to opponent.`,
        type: 'match',
      });
    } else {
      setActiveMatch(null);
    }
  }, [activeMatch, settleMatch, addNotification, updateTeteCoinBalance]);

  const cancelMatch = useCallback(() => {
    if (activeMatch && activeMatch.status === 'waiting_for_opponent') {
      const refundStake = activeMatch.stake;
      setUser((prev) => ({
        ...prev,
        availableBalance: prev.availableBalance + refundStake,
        escrowBalance: Math.max(0, prev.escrowBalance - refundStake),
      }));

      // Release locked funds on backend and restore available balance
      EscrowApiService.refundMatch(activeMatch.id, 'Table cancelled before opponent joined')
        .then(() => {
          EscrowApiService.fetchUserBalance(user.id, user.username).then((b) => {
            if (b) {
              setUser((prev) => ({
                ...prev,
                availableBalance: b.availableBalance,
                escrowBalance: b.escrowLockedBalance,
              }));
            }
          });
        })
        .catch((err) => console.warn('Backend refund error:', err));
    }
    setActiveMatch(null);
    telegram.triggerHaptic('light');
  }, [activeMatch, user.id, user.username]);

  const deposit = useCallback(
    (amount: number, method: string) => {
      const newTx: WalletTransaction = {
        id: `wtx_${Date.now().toString().slice(-6)}`,
        type: 'deposit',
        amount,
        amountUsdt: Number((amount / 1500).toFixed(2)),
        method: method.toUpperCase(),
        status: 'successful',
        timestamp: 'Just now',
        reference: `DEP-${Math.floor(10000 + Math.random() * 90000)}`,
      };
      setWalletTransactions((prev) => [newTx, ...prev]);

      const isFiatMethod =
        method.toLowerCase().includes('fiat') ||
        method.toLowerCase().includes('bank') ||
        method.toLowerCase().includes('naira');

      // Backend validates input, credits ledger, and returns authoritative user balance
      EscrowApiService.deposit(user.id, user.username, amount, method)
        .then((res) => {
          if (res?.user) {
            setUser((prev) => ({
              ...prev,
              availableBalance: res.user.availableBalance,
              escrowBalance: res.user.escrowLockedBalance,
              depositCurrency: isFiatMethod
                ? (prev.depositCurrency === 'USDT' ? 'BOTH' : 'FIAT')
                : (prev.depositCurrency === 'FIAT' ? 'BOTH' : 'USDT'),
            }));
          } else {
            setUser((prev) => ({
              ...prev,
              depositCurrency: isFiatMethod
                ? (prev.depositCurrency === 'USDT' ? 'BOTH' : 'FIAT')
                : (prev.depositCurrency === 'FIAT' ? 'BOTH' : 'USDT'),
            }));
          }
          telegram.triggerHaptic('success');
          sound.playWin();
          addNotification({
            title: `+₦${amount.toLocaleString()} Vault Deposit Confirmed`,
            message: `Successfully deposited ₦${amount.toLocaleString()} via ${method.toUpperCase()}. Backend database ledger updated.`,
            type: 'reward',
            amount,
          });
        })
        .catch((err) => {
          console.error('Backend deposit failure:', err);
          telegram.triggerHaptic('error');
          addNotification({
            title: 'Deposit Failed',
            message: err.message || 'Server failed to process deposit.',
            type: 'system',
          });
        });
    },
    [user.id, user.username, addNotification]
  );

  const withdraw = useCallback(
    (amount: number, bank: string, accountNumber: string, bankDetails?: { bankName?: string; accountName?: string }): boolean => {
      // Immediate frontend check
      if (user.availableBalance < amount) {
        telegram.triggerHaptic('error');
        addNotification({
          title: 'Insufficient Balance',
          message: `Cannot withdraw ₦${amount.toLocaleString()}. Active balance is ₦${user.availableBalance.toLocaleString()}.`,
          type: 'system',
        });
        return false;
      }

      const effectiveBank = bankDetails?.bankName || bank;
      const effectiveAccName = bankDetails?.accountName || user.displayName;

      const newTx: WalletTransaction = {
        id: `wtx_${Date.now().toString().slice(-6)}`,
        type: 'withdrawal',
        amount,
        amountUsdt: Number((amount / 1500).toFixed(2)),
        method: effectiveBank,
        status: 'processing',
        timestamp: 'Just now',
        reference: `WD-${Math.floor(10000 + Math.random() * 90000)}`,
      };
      setWalletTransactions((prev) => [newTx, ...prev]);

      // Authoritative Node.js backend validation & deduction
      EscrowApiService.withdraw(user.id, user.username, amount, effectiveBank, accountNumber, bankDetails)
        .then((res) => {
          if (res?.user) {
            setUser((prev) => ({
              ...prev,
              availableBalance: res.user.availableBalance,
              escrowBalance: res.user.escrowLockedBalance,
            }));
          }
          setWalletTransactions((prev) =>
            prev.map((t) => (t.id === newTx.id ? { ...t, status: 'successful', txHash: res.txHash } : t))
          );
          telegram.triggerHaptic('success');
          sound.playClick();
          addNotification({
            title: `₦${amount.toLocaleString()} Withdrawal Submitted`,
            message: `Disbursed to ${effectiveBank} (${accountNumber} - ${effectiveAccName}). Request ID logged.`,
            type: 'escrow',
          });
        })
        .catch((err) => {
          console.error('Backend withdrawal rejection:', err);
          setWalletTransactions((prev) =>
            prev.map((t) => (t.id === newTx.id ? { ...t, status: 'failed' } : t))
          );
          telegram.triggerHaptic('error');
          addNotification({
            title: 'Withdrawal Rejected',
            message: err.message || 'Backend rejected withdrawal. Insufficient funds or invalid details.',
            type: 'system',
          });
        });

      return true;
    },
    [user.availableBalance, user.id, user.username, user.displayName, addNotification]
  );

  const createTable = useCallback((gameMode: GameMode, stake: number, customRoomCode?: string, turnMode: TurnMode = gameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual'): string => {
    const roomCode = customRoomCode || `TG-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTable: OpenTable = {
      id: `tbl_${Date.now()}`,
      roomCode,
      hostName: user.displayName,
      hostUsername: user.username,
      hostUserId: user.id,
      hostAvatar: user.avatarUrl,
      hostWinRate: user.winRate,
      gameMode,
      turnMode,
      stake,
      pot: Math.round(stake * 1.9),
      isPrivate: true,
      createdAt: 'Just now',
    };

    setOpenTables((prev) => {
      const updated = [newTable, ...prev.filter((t) => t.roomCode !== roomCode)];
      try {
        localStorage.setItem('skillstake_open_tables_v1', JSON.stringify(updated));
      } catch {
        // ignore storage quota
      }
      return updated;
    });

    // Register room on central backend server for cross-device room code joining
    EscrowApiService.registerRoom(newTable).catch(() => {});

    return roomCode;
  }, [user]);

  const joinTable = useCallback(
    (table: OpenTable): boolean => {
      if (
        user &&
        table.hostUsername &&
        user.username.trim().toLowerCase() === table.hostUsername.trim().toLowerCase()
      ) {
        telegram.triggerHaptic('error');
        addNotification({
          title: 'Self-Play Restricted',
          message: `You cannot play against yourself (@${user.username}). Please share room code ${table.roomCode} with a different player.`,
          type: 'system',
        });
        return false;
      }

      const opp = {
        id: table.hostUserId || table.hostUsername,
        username: table.hostUsername,
        displayName: table.hostName,
        avatarUrl: table.hostAvatar,
        winRate: table.hostWinRate,
      };
      return startMatch(table.gameMode, table.stake, table.isPrivate, table.roomCode, opp, false, table.hostUsername, 'locked_escrow', table.turnMode);
    },
    [user, startMatch, addNotification]
  );

  const joinByRoomCode = useCallback(
    async (roomCode: string): Promise<boolean> => {
      const cleanCode = roomCode.trim().toUpperCase();

      // 1. Search in-memory state or localStorage
      let existing = openTables.find((t) => t.roomCode.toUpperCase() === cleanCode);
      if (!existing) {
        try {
          const saved = localStorage.getItem('skillstake_open_tables_v1');
          if (saved) {
            const list: OpenTable[] = JSON.parse(saved);
            existing = list.find((t) => t.roomCode.toUpperCase() === cleanCode);
          }
        } catch {
          // ignore
        }
      }

      // 2. Query backend room registry if not found locally
      if (!existing) {
        try {
          const remoteRoom = await EscrowApiService.fetchRoomByCode(cleanCode);
          if (remoteRoom) {
            const hostInfo = remoteRoom.host || {};
            existing = {
              id: remoteRoom.id || `tbl_remote_${cleanCode}`,
              roomCode: cleanCode,
              hostName: remoteRoom.hostName || hostInfo.displayName || 'Table Host',
              hostUsername: remoteRoom.hostUsername || hostInfo.username || 'Staker_Pro',
              hostAvatar: remoteRoom.hostAvatar || hostInfo.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
              hostWinRate: remoteRoom.hostWinRate || hostInfo.winRate || 66.0,
              gameMode: remoteRoom.gameMode || 'whot',
              joinedPlayer: remoteRoom.joinedPlayer || undefined,
              hostUserId: remoteRoom.hostUserId || undefined,
              turnMode: remoteRoom.turnMode || (remoteRoom.gameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual'),
              stake: remoteRoom.stake || 2500,
              pot: remoteRoom.pot || Math.round((remoteRoom.stake || 2500) * 1.9),
              isPrivate: true,
              createdAt: 'Just now',
            };
            setOpenTables((prev) => [existing!, ...prev.filter((t) => t.roomCode !== cleanCode)]);
          }
        } catch {
          // ignore remote error
        }
      }

      if (existing && user?.username) {
        const isHost = user.username.trim().toLowerCase() === String(existing.hostUsername || '').trim().toLowerCase();
        const joinedPlayer = existing.joinedPlayer;
        const isJoinedPlayer = user.username.trim().toLowerCase() === String(joinedPlayer?.username || '').trim().toLowerCase();
        if (isHost || isJoinedPlayer) {
          const hostIsHere = isHost;
          const other = hostIsHere ? joinedPlayer : {
            id: existing.hostUserId || 'host_' + cleanCode,
            username: existing.hostUsername || existing.hostName || 'Table Host',
            displayName: existing.hostName || existing.hostUsername || 'Table Host',
            avatarUrl: existing.hostAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
            winRate: existing.hostWinRate || 66,
          };
          const gameMode = existing.gameMode || 'whot';
          const turnMode = existing.turnMode || (gameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual');
          const stake = Number(existing.stake) || 2500;
          setActiveMatch({
            id: `M-${cleanCode.replace(/[^A-Z0-9_-]/g, '').slice(0, 40)}`,
            roomCode: cleanCode,
            gameMode,
            turnMode,
            turnDeadlineAt: Date.now() + TURN_MODE_SECONDS[turnMode] * 1000,
            stake,
            pot: Number(existing.pot) || Math.round(stake * 1.9),
            fee: Math.round(stake * 0.1),
            status: joinedPlayer ? 'locked_escrow' : 'waiting_for_opponent',
            hostUsername: existing.hostUsername,
            opponent: other || {
              id: 'waiting', username: 'Waiting for Opponent...', displayName: 'Waiting for Challenger', avatarUrl: '', winRate: 0,
            },
            isPrivate: true,
            isVsAi: false,
            isP2P: true,
          });
          return true;
        }
      }
      // Always register player 2 joining room on central backend server
      EscrowApiService.joinRoom(cleanCode, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        winRate: user.winRate,
      }).catch(() => {});

      if (existing) {
        if (
          user &&
          existing.hostUsername &&
          user.username.trim().toLowerCase() === existing.hostUsername.trim().toLowerCase()
        ) {
          telegram.triggerHaptic('error');
          addNotification({
            title: 'Self-Play Restricted',
            message: `You cannot join room ${cleanCode} because you are the host (@${user.username}).`,
            type: 'system',
          });
          return false;
        }
        return joinTable(existing);
      }

      let inferredGameMode: GameMode = 'whot';
      if (cleanCode.includes('BD') || cleanCode.includes('BEAD') || cleanCode.includes('BD16')) {
        inferredGameMode = 'bead16';
      } else if (cleanCode.includes('DRG') || cleanCode.includes('DRAUGHT')) {
        inferredGameMode = 'draughts';
      } else if (cleanCode.includes('LUD') || cleanCode.includes('BLITZ')) {
        inferredGameMode = cleanCode.includes('BLITZ') ? 'ludo_blitz' : 'ludo_classic';
      } else if (cleanCode.includes('WHT') || cleanCode.includes('WHOT')) {
        inferredGameMode = 'whot';
      }

      const fallbackTable: OpenTable = {
        id: `tbl_dyn_${cleanCode}`,
        roomCode: cleanCode,
        hostName: 'Table Host',
        hostUsername: 'Staker_Pro',
        hostAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        hostWinRate: 66.0,
        gameMode: inferredGameMode,
        turnMode: inferredGameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual',
        stake: 2500,
        pot: 4750,
        isPrivate: true,
        createdAt: 'Just now',
      };
      return joinTable(fallbackTable);
    },
    [openTables, joinTable, user]
  );

  // Periodically poll backend for joining player updates if activeMatch is waiting for challenger
  const activeRoomCode = activeMatch?.roomCode;
  const activeMatchStatus = activeMatch?.status;
  const activeOpponentUsername = activeMatch?.opponent?.username;

  useEffect(() => {
    if (!activeRoomCode) return;
    const isWaiting =
      activeMatchStatus === 'waiting_for_opponent' ||
      (activeOpponentUsername && (
        activeOpponentUsername.includes('Challenger') ||
        activeOpponentUsername.includes('Waiting') ||
        ['Odogwu_King', 'odogwuking'].includes(activeOpponentUsername)
      ));

    if (!isWaiting) return;

    const interval = setInterval(() => {
      EscrowApiService.fetchRoomByCode(activeRoomCode).then((room) => {
        if (room && room.joinedPlayer) {
          const jp = room.joinedPlayer;
          if (activeMatchStatus === 'waiting_for_opponent') {
            EscrowApiService.fetchUserBalance(user.id, user.username).then((balance) => {
              if (balance) setUser((prev) => ({ ...prev, availableBalance: balance.availableBalance, escrowBalance: balance.escrowLockedBalance }));
            });
          }
          setActiveMatch((prev) => {
            if (!prev || prev.opponent.username === jp.username) return prev;

            sound.playWin();
            telegram.triggerHaptic('success');
            addNotification({
              title: 'Challenger Joined!',
              message: `@${jp.username} joined room ${activeRoomCode}. Match is now live!`,
              type: 'match',
            });
            return {
              ...prev,
              status: 'locked_escrow',
              opponent: {
                id: jp.id || 'opp_' + Date.now(),
                username: jp.username,
                displayName: jp.displayName || jp.username,
                avatarUrl: jp.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                winRate: jp.winRate || 65.0,
              },
            };
          });
        }
      }).catch(() => {});
    }, 2000);

    return () => clearInterval(interval);
  }, [activeRoomCode, activeMatchStatus, activeOpponentUsername, addNotification, user.id, user.username]);

  // Resume a match opened from a Telegram bot deep link after authentication.
  const handledStartParamRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated || !user?.username) return;
    const startParam = telegram.getStartParam();
    if (!startParam || handledStartParamRef.current === startParam) return;
    const payload = startParam.replace(/^startapp=/i, '').trim();
    const matchInvite = payload.match(/^match_([A-Za-z0-9_-]{1,40})$/i);
    if (!matchInvite) return;
    const code = matchInvite[1].trim().toUpperCase();
    handledStartParamRef.current = startParam;
    if (activeMatch?.roomCode?.trim().toUpperCase() === code) return;
    console.log('Detected Telegram match invite:', code);
    void joinByRoomCode(code);
  }, [joinByRoomCode, isAuthenticated, user?.username, activeMatch?.roomCode]);
  // P2P WebSocket connection for real-time multiplayer moves
  const p2pSocketRef = useRef<WebSocket | null>(null);

  const isP2PMatch = activeMatch?.isVsAi === false && Boolean(activeMatch?.roomCode);
  const p2pRoomCode = activeMatch?.roomCode ? activeMatch.roomCode.trim().toUpperCase() : '';
  const p2pStake = activeMatch?.stake;
  const p2pPot = activeMatch?.pot;
  const p2pGameMode = activeMatch?.gameMode;

  useEffect(() => {
    if (!isP2PMatch || !p2pRoomCode) {
      if (p2pSocketRef.current) {
        p2pSocketRef.current.close();
        p2pSocketRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    p2pSocketRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'join_game_room',
          roomCode: p2pRoomCode,
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          winRate: user.winRate,
          telegramId: user.telegramId,
          stake: p2pStake,
          pot: p2pPot,
          gameMode: p2pGameMode,
          turnMode: activeMatch?.turnMode || 'casual',
        })
      );
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'room_meta_sync' && msg.roomCode === p2pRoomCode) {
          setActiveMatch((prev) => {
            if (!prev) return prev;
            const syncedStake = Number(msg.stake) || prev.stake;
            const syncedPot = Number(msg.pot) || Math.round(syncedStake * 1.9);
            const syncedHost = msg.hostUsername || prev.hostUsername;
            const p2 = msg.joinedPlayer;
            const hasNewOpponent = p2 && p2.username && prev.opponent.username !== p2.username;
            if (prev.stake === syncedStake && prev.pot === syncedPot && prev.hostUsername === syncedHost && !hasNewOpponent) return prev;
            return {
              ...prev,
              stake: syncedStake,
              pot: syncedPot,
              hostUsername: syncedHost,
              ...(p2 ? {
                status: 'locked_escrow' as MatchStatus,
                opponent: {
                  id: p2.id || 'opp_' + Date.now(),
                  username: p2.username,
                  displayName: p2.displayName || p2.username,
                  avatarUrl: p2.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                  winRate: p2.winRate || 65,
                },
              } : {}),
            };
          });
        }        if (msg.type === 'p2p_player_joined' && msg.roomCode === p2pRoomCode && msg.player2) {
          const p2 = msg.player2;
          setActiveMatch((prev) => {
            if (!prev) return prev;
            if (prev.opponent.username === p2.username && prev.status === 'locked_escrow') {
              return prev;
            }

            sound.playWin();
            telegram.triggerHaptic('success');
            addNotification({
              title: 'Challenger Joined!',
              message: `@${p2.username} joined room ${p2pRoomCode}. Match is now live!`,
              type: 'match',
            });

            return {
              ...prev,
              status: 'locked_escrow',
              opponent: {
                id: p2.id || 'opp_' + Date.now(),
                username: p2.username,
                displayName: p2.displayName || p2.username,
                avatarUrl: p2.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                winRate: p2.winRate || 65.0,
              },
            };
          });
        }
        if (msg.type === 'p2p_player_left' && msg.roomCode === p2pRoomCode) {
          sound.playWin();
          telegram.triggerHaptic('success');
          addNotification({
            title: 'Opponent Disconnected',
            message: `@${msg.disconnectedUsername || 'Opponent'} refreshed/disconnected. Match forfeited in your favor!`,
            type: 'match',
          });
          settleMatch('player');
        }
        if (msg.type === 'p2p_voice_signal_relayed' && msg.roomCode === p2pRoomCode) {
          window.dispatchEvent(new CustomEvent('p2p_voice_signal_received', { detail: msg }));
        }
        if (msg.type === 'p2p_game_state_update' && msg.roomCode === p2pRoomCode) {
          if (msg.state) {
            if (Number.isFinite(Number(msg.state.turnDeadlineAt))) {
              setActiveMatch((prev) => prev ? { ...prev, turnDeadlineAt: Number(msg.state.turnDeadlineAt) } : prev);
            }
            if (msg.state.stake || msg.state.pot) {
              setActiveMatch((prev) => {
                if (!prev) return prev;
                const syncedStake = Number(msg.state.stake) || prev.stake;
                const syncedPot = Number(msg.state.pot) || Math.round(syncedStake * 1.9);
                if (prev.stake === syncedStake && prev.pot === syncedPot) {
                  return prev;
                }
                return {
                  ...prev,
                  stake: syncedStake,
                  pot: syncedPot,
                };
              });
            }
            window.dispatchEvent(new CustomEvent('p2p_game_state_update', { detail: msg.state }));
          }
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      p2pSocketRef.current = null;
    };
  }, [
    isP2PMatch,
    p2pRoomCode,
    user.id,
    user.username,
    user.displayName,
    user.avatarUrl,
    user.winRate,
    p2pStake,
    p2pPot,
    p2pGameMode,
    activeMatch?.turnMode,
    addNotification,
  ]);

  const sendP2pStateUpdate = useCallback(
    (stateData: any) => {
      if (p2pSocketRef.current?.readyState === WebSocket.OPEN && activeMatch?.roomCode) {
        const turnDeadlineAt = Date.now() + TURN_MODE_SECONDS[activeMatch.turnMode || 'casual'] * 1000;
        setActiveMatch((prev) => prev ? { ...prev, turnDeadlineAt } : prev);
        p2pSocketRef.current.send(
          JSON.stringify({
            type: 'p2p_game_state',
            roomCode: activeMatch.roomCode.trim().toUpperCase(),
            senderId: user.id,
            state: {
              ...stateData,
              turnDeadlineAt,
              stake: activeMatch.stake,
              pot: activeMatch.pot,
            },
          })
        );
      }
    },
    [activeMatch, user.id]
  );

  const sendP2pVoiceSignal = useCallback(
    (signalData: any) => {
      if (p2pSocketRef.current?.readyState === WebSocket.OPEN && activeMatch?.roomCode) {
        p2pSocketRef.current.send(
          JSON.stringify({
            type: 'p2p_voice_signal',
            roomCode: activeMatch.roomCode.trim().toUpperCase(),
            senderId: user.id,
            signal: signalData,
          })
        );
      }
    },
    [activeMatch?.roomCode, user.id]
  );

  return (
    <GameContext.Provider
      value={{
        user,
        isAuthenticated,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        loginWithTelegram,
        loginAsDemo,
        logout,
        activeTab,
        setActiveTab,
        activeMatch,
        openTables,
        escrowHistory,
        walletTransactions,
        startMatch,
        startCoinAiMatch,
        submitCoinAiAction,
        timeoutCoinAiMatch,
        updateTeteCoinBalance,
        completeCoinAiMatch,
        settleMatch,
        cancelMatch,
        forfeitMatch,
        deposit,
        withdraw,
        createTable,
        joinTable,
        joinByRoomCode,
        spectatingMatchId,
        setSpectatingMatchId,
        isTelegram: telegram.isTelegram(),
        notifications,
        unreadNotificationsCount,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearNotifications,
        addNotification,
        updateUserProfile,
        bindTelegram,
        unbindTelegram,
        refreshLocation,
        isProfileMenuOpen,
        openProfileMenu,
        closeProfileMenu,
        weeklyPerformance,
        gameSkillMatrix,
        simulateMatchResult,
        resetLiveTelemetry,
        activeReplay,
        openReplay,
        closeReplay,
        recordReplayStep,
        clearReplaySteps,
        sendP2pStateUpdate,
        sendP2pVoiceSignal,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

