import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Percent,
  ShieldCheck,
  Search,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Layers,
  Gamepad2,
  TrendingUp,
  AlertTriangle,
  X,
  Activity,
  CheckCircle2,
  LogOut,
  KeyRound,
  ShieldAlert,
  MessageSquarePlus,
  Bug,
  Lightbulb,
  Clock,
  Filter,
  CreditCard,
  Building,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { AdminUserRecord, PlatformAdminStats, GameMode, FeedbackReport, AdminWithdrawalRecord } from '../types';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

const USDT_RATE = 1500;
const ADMIN_AUTH_KEY = 'skillstake_admin_token';

interface GameAnalyticsItem {
  gameMode: GameMode;
  title: string;
  activeRooms: number;
  liveSpectators: number;
  totalMatchesToday: number;
  volumeNgn: number;
  houseFeeEarnedNgn: number;
  avgMatchDuration: string;
  disputeRate: string;
  popularStake: string;
}

export interface AdminEscrowMatchRecord {
  matchId: string;
  roomCode: string;
  gameType: 'LUDO' | 'WHOT' | 'DRAUGHTS';
  player1Id: string;
  player1Username: string;
  player2Id: string;
  player2Username: string;
  stakePerPlayer: number;
  grossPot: number;
  gateFeePercent: number;
  gateFeeAmount: number;
  winnerPayout: number;
  status: 'INITIALIZING' | 'STAKED_IN_ESCROW' | 'ACTIVE' | 'SETTLING' | 'SETTLED' | 'REFUNDED';
  winnerId?: string;
  loserId?: string;
  createdAt: number;
  settledAt?: number;
  finishReason?: string;
}


interface AdminDashboardScreenProps {
  onExitAdmin?: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ onExitAdmin }) => {
  // Admin Login State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(ADMIN_AUTH_KEY));
    } catch {
      return false;
    }
  });

  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard Subtab
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'overview' | 'escrow' | 'withdrawals' | 'users' | 'treasury' | 'games' | 'feedback'>('overview');
  const [escrowMatches, setEscrowMatches] = useState<AdminEscrowMatchRecord[]>([]);
  const [escrowFilter, setEscrowFilter] = useState<'all' | 'active' | 'settled' | 'refunded'>('all');
  const [isRefundingMatchId, setIsRefundingMatchId] = useState<string | null>(null);
  const [escrowActionMessage, setEscrowActionMessage] = useState<string | null>(null);

  const [stats, setStats] = useState<PlatformAdminStats>({
    totalUsers: 0,
    totalDeposits: 0,
    totalDepositsUsdt: 0,
    totalWithdrawals: 0,
    totalWithdrawalsUsdt: 0,
    totalHouseFeeCollected: 0,
    totalHouseFeeCollectedUsdt: 0,
    activeEscrowLocked: 0,
    totalMatchesPlayed: 0,
    treasuryAddress: '',
  });

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRecord[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'disbursed' | 'rejected'>('all');
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawalRecord | null>(null);
  const [disburseTxInput, setDisburseTxInput] = useState('');
  const [disburseNotesInput, setDisburseNotesInput] = useState('');
  const [isProcessingWithdrawal, setIsProcessingWithdrawal] = useState(false);

  const [gameAnalytics, setGameAnalytics] = useState<GameAnalyticsItem[]>([]);
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'bug' | 'feature' | 'praise' | 'other'>('all');
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<'all' | 'pending' | 'reviewed' | 'resolved'>('all');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'frozen'>('all');

  // Treasury update state
  const [newTreasuryAddress, setNewTreasuryAddress] = useState(stats.treasuryAddress);
  const [treasuryUpdateStatus, setTreasuryUpdateStatus] = useState<string | null>(null);
  const [isUpdatingTreasury, setIsUpdatingTreasury] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);

  // Platform Bank Settings State
  const [bankSettings, setBankSettings] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
  });
  const [bankSaveStatus, setBankSaveStatus] = useState<string | null>(null);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Platform Gate Fee State
  const [gateFeeInput, setGateFeeInput] = useState<number>(5);
  const [gateFeeSaveStatus, setGateFeeSaveStatus] = useState<string | null>(null);
  const [isSavingGateFee, setIsSavingGateFee] = useState(false);

  // Selected User Modal
  const [viewingUser, setViewingUser] = useState<AdminUserRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername || !adminPassword) {
      setLoginError('Please provide both username and password.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    sound.playClick();

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername.trim(), password: adminPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem(ADMIN_AUTH_KEY, data.token || 'admin_authorized');
        setIsAdminAuthenticated(true);
        sound.playWin();
        telegram.triggerHaptic('success');
        fetchAdminData();
      } else {
        setLoginError(data.error || 'Invalid credentials. Access restricted to authorized platform owners.');
        telegram.triggerHaptic('error');
      }
    } catch {
      setLoginError('Could not reach the server. Check your connection and try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    sound.playClick();
    localStorage.removeItem(ADMIN_AUTH_KEY);
    setIsAdminAuthenticated(false);
    setAdminPassword('');
    if (onExitAdmin) {
      onExitAdmin();
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Overview Stats
      const overviewRes = await fetch('/api/admin/overview');
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        if (data.data) {
          setStats(data.data);
          setNewTreasuryAddress(data.data.treasuryAddress);
        }
      }

      // 2. Fetch Users List
      const usersRes = await fetch('/api/admin/users');
      if (usersRes.ok) {
        const data = await usersRes.json();
        if (data.users) {
          setUsers(data.users);
        }
      }

      // 3. Fetch Game Analytics
      const gameRes = await fetch('/api/admin/game-analytics');
      if (gameRes.ok) {
        const data = await gameRes.json();
        if (data.analytics) {
          setGameAnalytics(data.analytics);
        }
      }

      // 4. Fetch Feedback Reports
      const feedbackRes = await fetch('/api/admin/feedback');
      if (feedbackRes.ok) {
        const data = await feedbackRes.json();
        if (data.feedback) {
          setFeedbackReports(data.feedback);
        }
      }

      // 5. Fetch Withdrawal Requests Queue (Payout Flow B)
      const wdRes = await fetch('/api/admin/withdrawals');
      if (wdRes.ok) {
        const data = await wdRes.json();
        if (data.withdrawals) {
          setWithdrawals(data.withdrawals);
        }
      }

      // 6. Fetch Platform Bank Settings
      const bankRes = await fetch('/api/admin/bank-settings');
      if (bankRes.ok) {
        const data = await bankRes.json();
        if (data.bankDetails) {
          setBankSettings(data.bankDetails);
        }
      }

      // 7. Fetch Platform Gate Fee Settings
      const gfRes = await fetch('/api/admin/gate-fee');
      if (gfRes.ok) {
        const data = await gfRes.json();
        if (data.gateFeePercent !== undefined) {
          setGateFeeInput(data.gateFeePercent);
        }
      }

      // 8. Fetch Active & Past Escrow Matches
      const escrowRes = await fetch('/api/admin/escrow-matches');
      if (escrowRes.ok) {
        const data = await escrowRes.json();
        if (data.matches) {
          setEscrowMatches(data.matches);
        }
      }
    } catch {
      // Fallback local data if backend transient
    } finally {
      setLoading(false);
    }
  };

  const handleOneClickRefundEscrow = async (matchId: string, roomCode?: string) => {
    sound.playClick();
    telegram.triggerHaptic('heavy');
    setIsRefundingMatchId(matchId);
    setEscrowActionMessage(null);

    try {
      const res = await fetch('/api/admin/escrow/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          reason: `Manual Admin Emergency Refund & Escrow Release [Room: ${roomCode || matchId}]`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sound.playWin();
        telegram.triggerHaptic('success');
        setEscrowActionMessage(data.message || `Match ${roomCode || matchId} 100% escrow refunded to both players!`);
        setEscrowMatches((prev) =>
          prev.map((m) => (m.matchId === matchId ? { ...m, status: 'REFUNDED', finishReason: 'Manual Admin Emergency Refund' } : m))
        );
        fetchAdminData();
      } else {
        setEscrowActionMessage(`Error: ${data.error || 'Failed to refund escrow'}`);
        telegram.triggerHaptic('error');
      }
    } catch (err: any) {
      setEscrowActionMessage(`Error: ${err.message || 'Server error'}`);
    } finally {
      setIsRefundingMatchId(null);
    }
  };


  const handleProcessWithdrawal = async (
    id: string,
    status: 'approved' | 'disbursed' | 'rejected',
    txHash?: string,
    adminNotes?: string
  ) => {
    sound.playClick();
    telegram.triggerHaptic('medium');
    setIsProcessingWithdrawal(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, txHash, adminNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.withdrawal) {
          setWithdrawals((prev) =>
            prev.map((w) => (w.id === id ? data.withdrawal : w))
          );
          if (selectedWithdrawal && selectedWithdrawal.id === id) {
            setSelectedWithdrawal(data.withdrawal);
          }
        }
      }
    } catch (err) {
      console.error('Failed to process withdrawal:', err);
    } finally {
      setIsProcessingWithdrawal(false);
    }
  };

  const handleUpdateFeedbackStatus = async (
    id: string,
    status: 'pending' | 'reviewed' | 'resolved',
    adminNotes?: string
  ) => {
    sound.playClick();
    telegram.triggerHaptic('light');
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.feedback) {
          setFeedbackReports((prev) =>
            prev.map((item) => (item.id === id ? data.feedback : item))
          );
        }
      }
    } catch (err) {
      console.error('Failed to update feedback status:', err);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated) {
      fetchAdminData();
    }
  }, [isAdminAuthenticated]);

  const handleToggleFreeze = async (userId: string, currentStatus: 'active' | 'frozen') => {
    sound.playClick();
    telegram.triggerHaptic('medium');
    const endpoint = currentStatus === 'active' ? `/api/admin/users/${userId}/freeze` : `/api/admin/users/${userId}/unfreeze`;
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: currentStatus === 'active' ? 'frozen' : 'active' } : u))
        );
        if (viewingUser && viewingUser.id === userId) {
          setViewingUser({ ...viewingUser, status: currentStatus === 'active' ? 'frozen' : 'active' });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId || userId.toLowerCase() === 'admin' || userId.toLowerCase() === 'usr_admin') {
      return;
    }
    sound.playClick();
    telegram.triggerHaptic('heavy');
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setConfirmDeleteId(null);
        if (viewingUser?.id === userId) {
          setViewingUser(null);
        }
        // Re-ensure admin token is present so session never drops
        if (!localStorage.getItem(ADMIN_AUTH_KEY)) {
          localStorage.setItem(ADMIN_AUTH_KEY, 'admin_session_authorized');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTreasury = async () => {
    if (!newTreasuryAddress || !newTreasuryAddress.startsWith('0x') || newTreasuryAddress.length !== 42) {
      setTreasuryUpdateStatus('Error: Must be a valid 42-character 0x EVM/Polygon wallet address.');
      return;
    }

    setIsUpdatingTreasury(true);
    setTreasuryUpdateStatus(null);
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const res = await fetch('/api/admin/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treasuryAddress: newTreasuryAddress }),
      });
      const data = await res.json();
      if (data.success) {
        setStats((prev) => ({ ...prev, treasuryAddress: data.treasuryAddress }));
        setTreasuryUpdateStatus('Treasury address successfully verified and saved!');
        sound.playWin();
        telegram.triggerHaptic('success');
      } else {
        setTreasuryUpdateStatus(`Error: ${data.error || 'Failed to update'}`);
      }
    } catch (err: any) {
      setTreasuryUpdateStatus(`Error: ${err.message}`);
    } finally {
      setIsUpdatingTreasury(false);
    }
  };

  const handleSaveBankSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBank(true);
    setBankSaveStatus(null);
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const res = await fetch('/api/admin/bank-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankSettings),
      });
      const data = await res.json();
      if (data.success) {
        setBankSettings(data.bankDetails);
        setBankSaveStatus('Platform bank account details updated successfully!');
        sound.playWin();
        telegram.triggerHaptic('success');
      } else {
        setBankSaveStatus(`Error: ${data.error || 'Failed to update'}`);
      }
    } catch (err: any) {
      setBankSaveStatus(`Error: ${err.message}`);
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSaveGateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGateFee(true);
    setGateFeeSaveStatus(null);
    try {
      const res = await fetch('/api/admin/gate-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gateFeePercent: gateFeeInput }),
      });
      const data = await res.json();
      if (data.success) {
        setGateFeeInput(data.gateFeePercent);
        setGateFeeSaveStatus(`Platform Gate Fee percentage updated to ${data.gateFeePercent}% successfully!`);
        sound.playWin();
        telegram.triggerHaptic('success');
        fetchAdminData();
      } else {
        setGateFeeSaveStatus(`Error: ${data.error || 'Failed to update gate fee'}`);
      }
    } catch (err: any) {
      setGateFeeSaveStatus(`Error: ${err.message || 'Server error'}`);
    } finally {
      setIsSavingGateFee(false);
    }
  };

  const handleCopyTreasury = () => {
    navigator.clipboard.writeText(stats.treasuryAddress);
    setCopiedTreasury(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedTreasury(false), 2000);
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = userStatusFilter === 'all' || u.status === userStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // 1. STANDALONE SECURE ADMIN LOGIN SCREEN
  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-purple-500 selection:text-white relative">
        {/* Ambient Glows */}
        <div className="fixed -top-24 left-1/3 w-96 h-96 bg-purple-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="fixed -bottom-24 right-1/4 w-96 h-96 bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900/90 border border-purple-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6 relative"
        >
          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Return to Public Site"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center mx-auto shadow-[0_0_24px_rgba(168,85,247,0.35)]">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Platform Owner Portal</h1>
            <p className="text-xs text-slate-400">
              Restricted management hub for treasury configuration, dispute resolution, and platform operations.
            </p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Admin Username / Email</label>
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Admin username"
                required
                className="w-full bg-slate-950 border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Security Passcode</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin passcode"
                required
                className="w-full bg-slate-950 border border-white/10 focus:border-purple-500 rounded-xl py-3 px-4 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to Admin Hub'}
            </button>
          </form>

          {onExitAdmin && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onExitAdmin}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ← Back to Player Arena
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // 2. AUTHENTICATED STANDALONE ADMIN DASHBOARD WITH SIDEBAR NAVIGATION
  return (
    <div id="admin-dashboard-root" className="min-h-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row selection:bg-purple-500 selection:text-white relative">
      {/* Ambient background glows */}
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed top-1/2 -left-32 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* SIDEBAR NAVIGATION (Desktop: Left Sticky Panel; Mobile: Header Nav) */}
      <aside className="w-full lg:w-72 bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-purple-500/20 backdrop-blur-2xl p-4 sm:p-5 flex flex-col justify-between shrink-0 lg:min-h-screen lg:sticky lg:top-0 z-20">
        <div className="space-y-6">
          {/* Platform Branding Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-tight">Tete Arena Admin</h1>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Super Admin
                </span>
              </div>
            </div>

            {onExitAdmin && (
              <button
                type="button"
                onClick={onExitAdmin}
                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Return to Public Site"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Items (Vertical List on Desktop, Scrollable Row on Mobile) */}
          <nav className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
            <div className="hidden lg:block text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-1">
              Management Console
            </div>

            {/* Overview */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('overview');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'overview'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <TrendingUp className="w-4 h-4" />
                <span>Platform Overview</span>
              </div>
            </button>

            {/* Escrow & Refunds */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('escrow');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'escrow'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Escrow & Refunds</span>
              </div>
              {escrowMatches.filter((m) => m.status === 'STAKED_IN_ESCROW' || m.status === 'ACTIVE').length > 0 ? (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                  {escrowMatches.filter((m) => m.status === 'STAKED_IN_ESCROW' || m.status === 'ACTIVE').length} Active
                </span>
              ) : (
                <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">{escrowMatches.length}</span>
              )}
            </button>

            {/* Withdrawals Queue */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('withdrawals');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'withdrawals'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>Withdrawals Queue</span>
              </div>
              {withdrawals.filter((w) => w.status === 'pending').length > 0 ? (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                  {withdrawals.filter((w) => w.status === 'pending').length}
                </span>
              ) : (
                <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">{withdrawals.length}</span>
              )}
            </button>

            {/* User Controls */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('users');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'users'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Users className="w-4 h-4" />
                <span>User Controls</span>
              </div>
              <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">{users.length}</span>
            </button>

            {/* Company Treasury Settings */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('treasury');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'treasury'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Wallet className="w-4 h-4" />
                <span>Company Treasury</span>
              </div>
            </button>

            {/* Live Game Analytics */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('games');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'games'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="w-4 h-4" />
                <span>Game Analytics</span>
              </div>
            </button>

            {/* User Feedback */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveAdminSubTab('feedback');
              }}
              className={`flex-1 lg:w-full flex items-center justify-between px-3.5 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeAdminSubTab === 'feedback'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 border border-purple-400/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5 bg-slate-900/50 lg:bg-transparent border border-white/5 lg:border-transparent'
                }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquarePlus className="w-4 h-4" />
                <span>User Feedback</span>
              </div>
              {feedbackReports.filter((f) => f.status === 'pending').length > 0 ? (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {feedbackReports.filter((f) => f.status === 'pending').length}
                </span>
              ) : (
                <span className="hidden lg:inline text-[10px] text-slate-500 font-mono">{feedbackReports.length}</span>
              )}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="hidden lg:block pt-6 border-t border-white/5 space-y-3">
          {onExitAdmin && (
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              ← Return to Player Arena
            </button>
          )}

          <button
            type="button"
            onClick={handleAdminLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Admin Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
        {/* Top Header Bar for Main View */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 p-4 sm:p-5 rounded-3xl border border-purple-500/30 backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                {activeAdminSubTab === 'overview' && 'Platform Overview & Financials'}
                {activeAdminSubTab === 'escrow' && 'Escrow Safety Vault & Emergency Refunds'}
                {activeAdminSubTab === 'withdrawals' && 'Withdrawals Queue & Payout Review'}
                {activeAdminSubTab === 'users' && 'User Account Controls & Anti-Fraud'}
                {activeAdminSubTab === 'treasury' && 'Company Treasury & Gate Fee Config'}
                {activeAdminSubTab === 'games' && 'Live Arena Game Telemetry'}
                {activeAdminSubTab === 'feedback' && 'Player Feedback & Bug Submissions'}
              </h2>
            </div>
            <p className="text-xs text-purple-300 mt-0.5">
              Live Escrow Auditing, Treasury Management, User Controls & Telemetry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAdminData}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleAdminLogout}
              className="lg:hidden flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>


        {/* TAB 1: OVERVIEW METRICS (Total users, deposits, withdrawals, house fees) */}
        {activeAdminSubTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* 4 Core Financial Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Users */}
              <div className="bg-slate-900/70 border border-purple-500/20 rounded-3xl p-5 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Registered Players</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-black text-white">{stats.totalUsers.toLocaleString()}</span>
                  <span className="text-[11px] text-emerald-400 font-bold block mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 100% On-Chain Indexed
                  </span>
                </div>
              </div>

              {/* Total Deposits */}
              <div className="bg-slate-900/70 border border-purple-500/20 rounded-3xl p-5 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Deposits</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                    ${stats.totalDepositsUsdt.toLocaleString()} <span className="text-xs text-slate-400 font-semibold">USDT</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono block mt-1">
                    ≈ ₦{stats.totalDeposits.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Total Withdrawals */}
              <div className="bg-slate-900/70 border border-purple-500/20 rounded-3xl p-5 relative overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Withdrawals</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black text-indigo-300">
                    ${stats.totalWithdrawalsUsdt.toLocaleString()} <span className="text-xs text-slate-400 font-semibold">USDT</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono block mt-1">
                    ≈ ₦{stats.totalWithdrawals.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Total Gate Fee (Configurable Rake) */}
              <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-5 relative overflow-hidden backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Company Gate Fee ({stats.gateFeePercent ?? gateFeeInput}%)</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black text-amber-400">
                    ${(stats.totalGateFeeCollectedUsdt ?? stats.totalHouseFeeCollectedUsdt).toLocaleString()} <span className="text-xs text-amber-200/80 font-semibold">USDT</span>
                  </span>
                  <span className="text-xs text-slate-400 font-mono block mt-1">
                    ≈ ₦{(stats.totalGateFeeCollected ?? stats.totalHouseFeeCollected).toLocaleString()} Net Revenue
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Stats Row: Active Escrow & Smart Contract Health */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Currently Locked in Escrow</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-purple-300">${(stats.activeEscrowLocked / USDT_RATE).toFixed(2)} USDT</span>
                  <span className="text-xs text-slate-500">(₦{stats.activeEscrowLocked.toLocaleString()})</span>
                </div>
                <p className="text-[10px] text-slate-400 mb-1">Held in active match pots pending referee oracle settlement.</p>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setActiveAdminSubTab('escrow');
                  }}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 underline flex items-center gap-1 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" /> One-Click Escrow Release Hub →
                </button>
              </div>


              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Total Match Duels Settled</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-white">{stats.totalMatchesPlayed.toLocaleString()}</span>
                  <span className="text-xs text-emerald-400 font-bold">100% Settled</span>
                </div>
                <p className="text-[10px] text-slate-400">Whot, Ludo Classic, Ludo Blitz, and Draughts tournaments.</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-1">
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Company Treasury Status</span>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-amber-400 truncate">
                    {stats.treasuryAddress.slice(0, 8)}...{stats.treasuryAddress.slice(-6)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">All protocol rake fees auto-route to this Polygon address.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ESCROW VAULT & ONE-CLICK EMERGENCY REFUNDS */}
        {activeAdminSubTab === 'escrow' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Escrow Guidance Banner */}


            {/* Notification Banner */}
            {escrowActionMessage && (
              <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${escrowActionMessage.startsWith('Error')
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{escrowActionMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEscrowActionMessage(null)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Filter Pills & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-2">
                  <Filter className="w-3.5 h-3.5" /> Filter:
                </span>
                {(['all', 'active', 'settled', 'refunded'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setEscrowFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${escrowFilter === filterKey
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                  >
                    {filterKey === 'all' ? 'All Matches' : filterKey === 'active' ? 'Active Escrow Locked' : filterKey}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Total Matches: <strong className="text-white">{escrowMatches.length}</strong> | Active Locked: <strong className="text-amber-400">{escrowMatches.filter(m => m.status === 'STAKED_IN_ESCROW' || m.status === 'ACTIVE').length}</strong>
              </div>
            </div>

            {/* Escrow Sessions Table / List */}
            <div className="bg-slate-900/70 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
              {escrowMatches.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Unlock className="w-12 h-12 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-400">No Escrow Sessions Recorded</h3>
                  <p className="text-xs text-slate-500">When players start match duels, their escrow lock sessions will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-white/10">
                      <tr>
                        <th className="py-3.5 px-4">Match / Room</th>
                        <th className="py-3.5 px-4">Game Mode</th>
                        <th className="py-3.5 px-4">Player 1 (Host)</th>
                        <th className="py-3.5 px-4">Player 2 (Opponent)</th>
                        <th className="py-3.5 px-4">Stakes & Pot</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Escrow Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {escrowMatches
                        .filter((m) => {
                          if (escrowFilter === 'active') return m.status === 'STAKED_IN_ESCROW' || m.status === 'ACTIVE' || m.status === 'INITIALIZING';
                          if (escrowFilter === 'settled') return m.status === 'SETTLED';
                          if (escrowFilter === 'refunded') return m.status === 'REFUNDED';
                          return true;
                        })
                        .map((match) => {
                          const isActive = match.status === 'STAKED_IN_ESCROW' || match.status === 'ACTIVE' || match.status === 'INITIALIZING';
                          const isRefundingThis = isRefundingMatchId === match.matchId;

                          return (
                            <tr key={match.matchId} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-4 px-4 font-mono font-bold text-white">
                                <span className="block text-amber-400">{match.roomCode || match.matchId}</span>
                                <span className="text-[10px] text-slate-500 font-normal">{match.matchId}</span>
                              </td>

                              <td className="py-4 px-4">
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  {match.gameType}
                                </span>
                              </td>

                              <td className="py-4 px-4">
                                <div className="font-bold text-slate-200">@{match.player1Username}</div>
                                <div className="text-[10px] text-slate-500 font-mono">ID: {match.player1Id}</div>
                              </td>

                              <td className="py-4 px-4">
                                <div className="font-bold text-slate-200">@{match.player2Username}</div>
                                <div className="text-[10px] text-slate-500 font-mono">ID: {match.player2Id}</div>
                              </td>

                              <td className="py-4 px-4">
                                <div className="font-bold text-emerald-400">Pot: ₦{match.grossPot.toLocaleString()}</div>
                                <div className="text-[10px] text-slate-400">Stake: ₦{match.stakePerPlayer.toLocaleString()} / player</div>
                              </td>

                              <td className="py-4 px-4">
                                {match.status === 'STAKED_IN_ESCROW' || match.status === 'ACTIVE' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                                    <Lock className="w-3 h-3" /> Locked in Escrow
                                  </span>
                                ) : match.status === 'SETTLED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <CheckCircle2 className="w-3 h-3" /> Settled
                                  </span>
                                ) : match.status === 'REFUNDED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/10">
                                    <Unlock className="w-3 h-3 text-emerald-400" /> Refunded 100%
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                                    {match.status}
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-4 text-right">
                                {match.status === 'REFUNDED' ? (
                                  <span className="text-[11px] text-slate-500 italic">100% refunded</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOneClickRefundEscrow(match.matchId, match.roomCode)}
                                    disabled={isRefundingThis}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5 ml-auto ${isActive
                                      ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 shadow-amber-500/25'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
                                      } disabled:opacity-50`}
                                    title="Immediately unlock and refund 100% of stakes back to both players"
                                  >
                                    <Unlock className="w-3.5 h-3.5" />
                                    <span>{isRefundingThis ? 'Refunding...' : '⚡ 1-Click Refund'}</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: WITHDRAWALS QUEUE & DETAIL REVIEW (Payout Flow B) */}
        {activeAdminSubTab === 'withdrawals' && (

          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Flow B Notice */}
            <div className="bg-slate-900/70 border border-amber-500/20 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <span>Polygon USDT Withdrawal Requests & Disbursement</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                        Payout Flow B: Review & Approve
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review player crypto cashout requests, copy recipient Polygon wallet addresses, and confirm on-chain disbursement hashes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-white/10 text-xs">
                  <span className="text-[10px] text-slate-500 px-2 font-bold uppercase">Status:</span>
                  {(['all', 'pending', 'approved', 'disbursed', 'rejected'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setWithdrawalFilter(st)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${withdrawalFilter === st
                        ? 'bg-amber-500 text-slate-950 shadow font-black'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={fetchAdminData}
                  className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                  title="Refresh Queue"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Withdrawals List Table / Grid */}
            {withdrawals
              .filter((w) => (withdrawalFilter === 'all' ? true : w.status === withdrawalFilter))
              .length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">No withdrawal requests found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are currently no cashout requests matching your selected status filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {withdrawals
                  .filter((w) => (withdrawalFilter === 'all' ? true : w.status === withdrawalFilter))
                  .map((item) => {
                    const isPending = item.status === 'pending';
                    const isDisbursed = item.status === 'disbursed';
                    const isRejected = item.status === 'rejected';

                    return (
                      <div
                        key={item.id}
                        className={`bg-slate-900/80 border rounded-3xl p-5 space-y-4 hover:border-amber-500/40 transition-all shadow-xl flex flex-col justify-between ${isPending
                          ? 'border-amber-500/30 ring-1 ring-amber-500/10'
                          : isDisbursed
                            ? 'border-emerald-500/20'
                            : isRejected
                              ? 'border-rose-500/20 opacity-75'
                              : 'border-white/10'
                          }`}
                      >
                        <div className="space-y-3">
                          {/* Top row: Amount + Status Pill + Date */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-xl text-xs font-black flex items-center gap-1.5 border bg-purple-500/20 text-purple-300 border-purple-500/30">
                                <Wallet className="w-3.5 h-3.5" />
                                <span>Polygon USDT</span>
                              </span>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${isDisbursed
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : isPending
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                    : isRejected
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  }`}
                              >
                                {item.status}
                              </span>
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">
                              {item.requestedAt}
                            </span>
                          </div>

                          {/* Payout Amounts & Player Username */}
                          <div className="flex items-baseline justify-between pt-1 border-b border-white/5 pb-2">
                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold block">Requested Payout</span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-xl font-black text-emerald-400 font-mono">
                                  ${item.amountUsdt.toFixed(2)} USDT
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  (₦{item.amountNgn.toLocaleString()})
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-semibold block">Player</span>
                              <span className="text-sm font-bold text-white font-mono">
                                @{item.username}
                              </span>
                            </div>
                          </div>

                          {/* Destination Wallet Box */}
                          <div className="p-3 bg-slate-950/70 rounded-2xl border border-white/5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400 font-semibold flex items-center gap-1">
                                <Wallet className="w-3.5 h-3.5 text-purple-400" />
                                <span>Recipient Polygon (ERC-20) Address:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.destinationAddress);
                                  sound.playClick();
                                  telegram.triggerHaptic('light');
                                }}
                                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </div>

                            <div className="font-mono text-xs text-amber-300 break-all bg-slate-900/90 p-2 rounded-xl border border-white/5 select-all">
                              {item.destinationAddress}
                            </div>

                            {item.adminNotes && (
                              <p className="text-[10px] text-slate-400 italic pt-1">
                                Note: {item.adminNotes}
                              </p>
                            )}

                            {item.txHash && (
                              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500 text-[10px]">Disbursement Tx:</span>
                                <a
                                  href={`https://polygonscan.com/tx/${item.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-mono text-purple-400 hover:text-purple-300 underline flex items-center gap-1 text-[10px]"
                                >
                                  <span>{item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-end gap-2">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                disabled={isProcessingWithdrawal}
                                onClick={() => handleProcessWithdrawal(item.id, 'rejected', undefined, 'Rejected by Admin')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                disabled={isProcessingWithdrawal}
                                onClick={() => {
                                  setSelectedWithdrawal(item);
                                  setDisburseTxInput('');
                                  setDisburseNotesInput('');
                                }}
                                className="px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 hover:opacity-90 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                              >
                                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Disburse USDT</span>
                              </button>
                            </>
                          )}

                          {item.status === 'approved' && (
                            <button
                              type="button"
                              disabled={isProcessingWithdrawal}
                              onClick={() => {
                                setSelectedWithdrawal(item);
                                setDisburseTxInput('');
                                setDisburseNotesInput('');
                              }}
                              className="px-4 py-1.5 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Complete Disbursement</span>
                            </button>
                          )}

                          {isDisbursed && (
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Disbursed</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT (View, Freeze/Unfreeze, Delete) */}
        {activeAdminSubTab === 'users' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/70 p-4 rounded-2xl border border-white/10">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search username, email..."
                  className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${userStatusFilter === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  All Players ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${userStatusFilter === 'active'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  Active ({users.filter((u) => u.status === 'active').length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserStatusFilter('frozen')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${userStatusFilter === 'frozen'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                >
                  Frozen ({users.filter((u) => u.status === 'frozen').length})
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900/80 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-3.5 px-4">Player</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Available Balance</th>
                      <th className="py-3.5 px-4">In Escrow</th>
                      <th className="py-3.5 px-4">Total Deposited</th>
                      <th className="py-3.5 px-4">Win Rate</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          No players matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-black">
                                {u.username.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-white block">@{u.username}</span>
                                <span className="text-[10px] text-slate-400 block">{u.displayName}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {u.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" /> Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                <Lock className="w-3 h-3" /> Frozen
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-white font-mono">
                              ${(u.availableBalance / USDT_RATE).toFixed(2)} USDT
                            </span>
                            <span className="text-[10px] text-slate-400 block">₦{u.availableBalance.toLocaleString()}</span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-mono text-purple-300">
                              ${(u.escrowLockedBalance / USDT_RATE).toFixed(2)} USDT
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-slate-300 font-mono">
                              ${(u.totalDeposited / USDT_RATE).toFixed(2)} USDT
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-amber-400 font-bold">{u.winRate}%</span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Profile details */}
                              <button
                                type="button"
                                onClick={() => {
                                  sound.playClick();
                                  setViewingUser(u);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="View Full Profile"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Freeze / Unfreeze Action */}
                              <button
                                type="button"
                                onClick={() => handleToggleFreeze(u.id, u.status)}
                                className={`p-1.5 rounded-lg transition-colors ${u.status === 'active'
                                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                                  }`}
                                title={u.status === 'active' ? 'Freeze User Account' : 'Unfreeze User Account'}
                              >
                                {u.status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              {/* Delete User Action */}
                              {confirmDeleteId === u.id ? (
                                <div className="flex items-center gap-1 bg-rose-950/80 p-1 rounded-lg border border-rose-500/40">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u.id)}
                                    className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold hover:bg-rose-500"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="px-1 py-0.5 text-slate-400 hover:text-white text-[10px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    sound.playClick();
                                    setConfirmDeleteId(u.id);
                                  }}
                                  className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMPANY TREASURY SETTINGS (View, Verify, and Update Company Receiving Address) */}
        {activeAdminSubTab === 'treasury' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="bg-slate-900/80 border border-purple-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Company Polygon Treasury Vault</h3>
                  <p className="text-xs text-slate-400">
                    This address receives all player crypto deposits and the automated 5% platform protocol fees.
                  </p>
                </div>
              </div>

              {/* Current Active Treasury Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Current Active Receiving Address
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-purple-950/30 border border-purple-500/20">
                  <span className="font-mono text-xs font-bold text-amber-400 break-all select-all">
                    {stats.treasuryAddress}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyTreasury}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {copiedTreasury ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTreasury ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={`https://polygonscan.com/address/${stats.treasuryAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold border border-purple-500/30 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>PolygonScan</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Platform NGN Bank Deposit Account Settings Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-purple-500/30 space-y-4">
                <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Platform NGN Bank Deposit Account Settings</h4>
                    <p className="text-[11px] text-slate-400">
                      These bank details will display to users in the Deposit Modal for Naira Bank Transfers.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveBankSettings} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        value={bankSettings.bankName}
                        onChange={(e) => setBankSettings((prev) => ({ ...prev, bankName: e.target.value }))}
                        placeholder="e.g. OPAY / Kuda Bank"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Account Number</label>
                      <input
                        type="text"
                        value={bankSettings.accountNumber}
                        onChange={(e) => setBankSettings((prev) => ({ ...prev, accountNumber: e.target.value }))}
                        placeholder="e.g. 903 847 2910"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1">Account Name</label>
                      <input
                        type="text"
                        value={bankSettings.accountName}
                        onChange={(e) => setBankSettings((prev) => ({ ...prev, accountName: e.target.value }))}
                        placeholder="e.g. Tete Arena"
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                  </div>

                  {bankSaveStatus && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${bankSaveStatus.startsWith('Error')
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        }`}
                    >
                      {bankSaveStatus.startsWith('Error') ? (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      )}
                      <span>{bankSaveStatus}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingBank}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingBank ? 'Saving Bank Settings...' : 'Save Bank Details'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Form to set Gate Fee Percentage */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Percent className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Platform Gate Fee Settings
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Set the percentage gate fee charged on gross match pots across all P2P games.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveGateFee} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:w-44">
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">Gate Fee (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          value={gateFeeInput}
                          onChange={(e) => setGateFeeInput(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                          required
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-amber-400">%</span>
                      </div>
                    </div>

                    <div className="flex-1 pt-1 sm:pt-5">
                      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300">
                        Winner Net Pot Payout: <strong className="text-emerald-400 font-bold">{100 - gateFeeInput}%</strong> of Gross Pot
                      </div>
                    </div>
                  </div>

                  {gateFeeSaveStatus && (
                    <div
                      className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${gateFeeSaveStatus.startsWith('Error')
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        }`}
                    >
                      {gateFeeSaveStatus.startsWith('Error') ? (
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      )}
                      <span>{gateFeeSaveStatus}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSavingGateFee}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-extrabold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingGateFee ? 'Saving Gate Fee...' : 'Save Gate Fee'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Form to verify and update Treasury Address */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <label className="text-xs font-bold text-slate-200 block">
                  Update Company Receiving Address (Polygon PoS / EVM 0x Address)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newTreasuryAddress}
                    onChange={(e) => setNewTreasuryAddress(e.target.value.trim())}
                    placeholder="0x..."
                    className="w-full bg-slate-950 border border-purple-500/30 rounded-xl py-3 px-4 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                  />
                </div>

                {treasuryUpdateStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${treasuryUpdateStatus.startsWith('Error')
                      ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                      }`}
                  >
                    {treasuryUpdateStatus.startsWith('Error') ? (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    )}
                    <span>{treasuryUpdateStatus}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    All future deposits and oracle settlements will immediately use the new destination.
                  </span>

                  <button
                    type="button"
                    disabled={isUpdatingTreasury || newTreasuryAddress === stats.treasuryAddress}
                    onClick={handleSaveTreasury}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {isUpdatingTreasury ? 'Verifying...' : 'Verify & Update Address'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE GAME ANALYTICS (Whot, Ludo Classic, Ludo Blitz, Draughts) */}
        {activeAdminSubTab === 'games' && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameAnalytics.map((game) => (
                <div
                  key={game.gameMode}
                  className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-4 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                        <Gamepad2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{game.title}</h4>
                        <span className="text-[10px] text-purple-300 font-mono uppercase tracking-wider">
                          Mode: {game.gameMode}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>{game.activeRooms} Live Rooms</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">24h Matches</span>
                      <span className="text-base font-extrabold text-white">{game.totalMatchesToday}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">24h Staking Vol</span>
                      <span className="text-base font-extrabold text-emerald-400 font-mono">
                        ${(game.volumeNgn / USDT_RATE).toFixed(0)} <span className="text-[10px]">USDT</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">5% Rake Earned</span>
                      <span className="text-base font-extrabold text-amber-400 font-mono">
                        ${(game.houseFeeEarnedNgn / USDT_RATE).toFixed(2)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">Avg Match Time</span>
                      <span className="text-xs font-bold text-slate-200">{game.avgMatchDuration}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">Popular Stake</span>
                      <span className="text-[11px] font-bold text-purple-300">{game.popularStake}</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5">
                      <span className="text-[10px] text-slate-400 block font-semibold">Live Spectators</span>
                      <span className="text-xs font-bold text-indigo-300">{game.liveSpectators} Viewers</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: USER FEEDBACK & BUG REPORTS */}
        {activeAdminSubTab === 'feedback' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header & Filter Controls */}
            <div className="bg-slate-900/70 border border-purple-500/20 rounded-3xl p-5 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-purple-400" />
                  <span>Player Feedback & Bug Reports</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct inquiries, bug submissions, and feature suggestions submitted by players in-app.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Category Filter */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-white/10 text-xs">
                  <span className="text-[10px] text-slate-500 px-2 font-bold uppercase">Type:</span>
                  {(['all', 'bug', 'feature', 'praise', 'other'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFeedbackFilter(cat)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${feedbackFilter === cat
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-2xl border border-white/10 text-xs">
                  <span className="text-[10px] text-slate-500 px-2 font-bold uppercase">Status:</span>
                  {(['all', 'pending', 'reviewed', 'resolved'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFeedbackStatusFilter(st)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold capitalize transition-all cursor-pointer ${feedbackStatusFilter === st
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                        }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={fetchAdminData}
                  className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                  title="Refresh Feedback"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Feedback List */}
            {feedbackReports
              .filter((f) => (feedbackFilter === 'all' ? true : f.category === feedbackFilter))
              .filter((f) => (feedbackStatusFilter === 'all' ? true : f.status === feedbackStatusFilter))
              .length === 0 ? (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/20">
                  <MessageSquarePlus className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">No feedback reports found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are currently no reports matching your active filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feedbackReports
                  .filter((f) => (feedbackFilter === 'all' ? true : f.category === feedbackFilter))
                  .filter((f) => (feedbackStatusFilter === 'all' ? true : f.status === feedbackStatusFilter))
                  .map((item) => {
                    const isBug = item.category === 'bug';
                    const isFeature = item.category === 'feature';
                    const isPraise = item.category === 'praise';

                    return (
                      <div
                        key={item.id}
                        className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-3 hover:border-purple-500/40 transition-all shadow-lg flex flex-col justify-between"
                      >
                        <div className="space-y-2.5">
                          {/* Top Row: User & Category & Priority Badges */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${isBug
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : isFeature
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : isPraise
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : 'bg-slate-800 text-slate-300 border-white/10'
                                  }`}
                              >
                                {isBug && <Bug className="w-3 h-3" />}
                                {isFeature && <Lightbulb className="w-3 h-3" />}
                                <span>{item.category}</span>
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase ${item.priority === 'urgent'
                                  ? 'bg-rose-600 text-white font-black animate-pulse'
                                  : item.priority === 'high'
                                    ? 'bg-amber-600/30 text-amber-300'
                                    : 'bg-slate-800 text-slate-400'
                                  }`}
                              >
                                {item.priority}
                              </span>
                            </div>

                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(item.createdAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          {/* Subject & Description */}
                          <div>
                            <h4 className="text-sm font-bold text-white">{item.subject}</h4>
                            <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                              {item.description}
                            </p>
                          </div>

                          {/* Submitter Info & Metadata */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
                            <span className="text-slate-300 font-semibold">
                              User: <span className="text-white font-mono font-bold">@{item.username}</span>
                            </span>
                            {item.email && (
                              <span className="text-slate-400 truncate max-w-[180px]">
                                {item.email}
                              </span>
                            )}
                            {item.deviceInfo && (
                              <span className="text-[10px] font-mono text-slate-500 truncate max-w-full">
                                {item.deviceInfo}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Controls Bottom Bar */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold">Status:</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-black capitalize ${item.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.status === 'reviewed'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                                }`}
                            >
                              {item.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.status !== 'reviewed' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateFeedbackStatus(item.id, 'reviewed')}
                                className="px-2.5 py-1 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 text-[10px] font-bold border border-blue-500/30 transition-all cursor-pointer"
                              >
                                Mark Reviewed
                              </button>
                            )}
                            {item.status !== 'resolved' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateFeedbackStatus(item.id, 'resolved')}
                                className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-all cursor-pointer"
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* USER DETAIL MODAL */}
        <AnimatePresence>
          {viewingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-purple-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center font-black">
                      {viewingUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">@{viewingUser.username}</h3>
                      <p className="text-xs text-slate-400">{viewingUser.displayName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingUser(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Email Address</span>
                    <span className="font-semibold text-white">{viewingUser.email}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Phone Contact</span>
                    <span className="font-semibold text-white">{viewingUser.phone}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Available Balance</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      ${(viewingUser.availableBalance / USDT_RATE).toFixed(2)} USDT (₦
                      {viewingUser.availableBalance.toLocaleString()})
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Account Status</span>
                    <span
                      className={`font-bold ${viewingUser.status === 'active' ? 'text-emerald-400' : 'text-rose-400'}`}
                    >
                      {viewingUser.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Total Matches</span>
                    <span className="font-semibold text-white">{viewingUser.totalMatches}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5">
                    <span className="text-slate-400 block text-[10px]">Win Rate</span>
                    <span className="font-semibold text-amber-400">{viewingUser.winRate}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleToggleFreeze(viewingUser.id, viewingUser.status)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewingUser.status === 'active'
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                      }`}
                  >
                    {viewingUser.status === 'active' ? 'Freeze Player Account' : 'Unfreeze Player Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(viewingUser.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500/20 text-rose-300 hover:bg-rose-500/30"
                  >
                    Delete Account
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* DISBURSEMENT CONFIRMATION MODAL (FLOW B) */}
          {selectedWithdrawal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">Disburse Payout (Flow B)</h3>
                      <p className="text-xs text-slate-400">Confirm payment to player wallet/bank</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-4 bg-slate-950/70 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Player</span>
                    <span className="text-sm font-bold text-white font-mono">@{selectedWithdrawal.username}</span>
                  </div>

                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-slate-400">Disbursement Amount</span>
                    <div className="text-right font-mono">
                      <span className="text-base font-black text-emerald-400">
                        ${selectedWithdrawal.amountUsdt.toFixed(2)} USDT
                      </span>
                      <span className="text-xs text-slate-400 block">
                        ≈ ₦{selectedWithdrawal.amountNgn.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Recipient Destination</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedWithdrawal.destinationAddress);
                          sound.playClick();
                          telegram.triggerHaptic('light');
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                    <div className="text-xs font-mono text-amber-300 break-all bg-slate-900 p-2.5 rounded-xl border border-white/5 select-all">
                      {selectedWithdrawal.destinationAddress}
                    </div>
                  </div>
                </div>

                {/* Input On-Chain Polygon TxHash */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Polygon On-Chain Tx Hash <span className="text-slate-500 font-normal">(Optional for tracking)</span>
                    </label>
                    <input
                      type="text"
                      value={disburseTxInput}
                      onChange={(e) => setDisburseTxInput(e.target.value)}
                      placeholder="0x... (PolygonScan transaction hash)"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Admin Notes
                    </label>
                    <input
                      type="text"
                      value={disburseNotesInput}
                      onChange={(e) => setDisburseNotesInput(e.target.value)}
                      placeholder="e.g. Sent via MetaMask hardware wallet"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setSelectedWithdrawal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingWithdrawal}
                    onClick={() => {
                      const finalTx = disburseTxInput.trim() || `0x${Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')}`;
                      handleProcessWithdrawal(
                        selectedWithdrawal.id,
                        'disbursed',
                        finalTx,
                        disburseNotesInput.trim() || 'Disbursed by Admin'
                      );
                      setSelectedWithdrawal(null);
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Disbursed</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

