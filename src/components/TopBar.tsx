import React, { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import {
  Plus,
  Send,
  Flame,
  Swords,
  Wallet,
  BarChart3,
  ShieldCheck,
  Coins,
} from 'lucide-react';
import { sound } from '../services/audio';
import { EscrowApiService } from '../services/escrowService';
import { UserProfileMenu } from './UserProfileMenu';
import { TabType } from '../types';

const DepositModal = lazy(() => import('./DepositModal').then((module) => ({ default: module.DepositModal })));

export const TopBar: React.FC = () => {
  const {
    user,
    isTelegram,
    activeTab,
    setActiveTab,
    openProfileMenu,
  } = useGame();
  const [showDeposit, setShowDeposit] = useState(false);
  const [teteCoinBalance, setTeteCoinBalance] = useState(user.coinBalance || 0);

  useEffect(() => {
    let isMounted = true;
    const refreshTeteCoins = () => {
      EscrowApiService.fetchPlatformCoinProfile(user.id, user.username).then((profile) => {
        if (isMounted && profile) setTeteCoinBalance(profile.balance);
      });
    };

    refreshTeteCoins();
    const interval = window.setInterval(refreshTeteCoins, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [user.id, user.username]);

  useEffect(() => {
    if (typeof user.coinBalance === 'number') setTeteCoinBalance(user.coinBalance);
  }, [user.coinBalance]);

  const navTabs: { id: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'arena', label: 'Arena', icon: Flame },
    { id: 'lobby', label: 'Open Tables', icon: Swords },
    { id: 'wallet', label: 'Escrow Vault', icon: Wallet },
    { id: 'analytics', label: 'Leaderboard & Stats', icon: BarChart3 },
  ];

  return (
    <>
      <header
        id="top-bar"
        className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 w-full"
      >
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          {/* Brand Logo & User profile */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Desktop Brand Mark */}
            <div className="hidden lg:flex items-center gap-2.5 mr-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-black text-sm text-white tracking-tight">Tete Arena</span>
            </div>

            {/* User Profile Pill (Interactive click to view user profile & notification center) */}
            <motion.button
              id="btn-user-profile-avatar"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={openProfileMenu}
              title="Click to view User Profile & Notification Center"
              className="flex items-center gap-2.5 min-w-0 p-1 -ml-1 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer text-left group"
            >
              <div className="relative shrink-0">
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-400/80 p-0.5 bg-indigo-500/20 group-hover:ring-amber-400 transition-all"
                />
                {isTelegram && (
                  <div
                    title="Telegram Connected"
                    className="absolute -bottom-0.5 -right-0.5 bg-sky-500 rounded-full p-0.5 ring-1 ring-slate-900"
                  >
                    <Send className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>

              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs tracking-tight text-white group-hover:text-amber-400 transition-colors truncate max-w-[110px] sm:max-w-none">
                    @{user.username}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 block truncate">
                  {user.actualName || user.displayName}
                </span>
              </div>
            </motion.button>
          </div>

          {/* Desktop Navigation Tabs (shown on md+ screens) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-white/10">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    sound.playClick();
                    setActiveTab(tab.id);
                  }}
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    isActive ? 'text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="topbar-active-pill"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className="absolute inset-0 bg-amber-500 rounded-xl shadow-md shadow-amber-500/25"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10" />
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* Right Action Group: Cash and Tete Coin balances */}
          <div className="flex items-center gap-2">
            {/* Balance Pill */}
            <button
              id="top-balance-pill"
              onClick={() => setShowDeposit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-amber-500/30 shadow-inner group transition-all cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="font-black text-xs text-amber-500 tracking-tight">
                ₦{user.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
              <div className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Plus className="w-3 h-3 stroke-[3]" />
              </div>
            </button>

            {/* Tete Coin balance */}
            <div
              id="top-tete-coin-balance"
              role="img"
              aria-label={`Tete Coin balance: ${teteCoinBalance.toLocaleString()} coins`}
              title="Tete Coin balance"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/25 text-amber-300"
            >
              <Coins className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="font-black text-xs tabular-nums">{teteCoinBalance.toLocaleString()}</span>
            </div>

          </div>
        </div>
      </header>

      {showDeposit && <Suspense fallback={null}><DepositModal onClose={() => setShowDeposit(false)} /></Suspense>}
      <UserProfileMenu />
    </>
  );
};
