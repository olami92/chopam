import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameProvider, useGame } from './context/GameContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './screens/LandingPage';
import { ArenaScreen } from './screens/ArenaScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { WalletScreen } from './screens/WalletScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { AdminDashboardScreen } from './screens/AdminDashboardScreen';
import { WhotGameScreen } from './screens/WhotGameScreen';
import { LudoGameScreen } from './screens/LudoGameScreen';
import { DraughtsGameScreen } from './screens/DraughtsGameScreen';
import { Bead16GameScreen } from './screens/Bead16GameScreen';
import { WaitingRoomModal } from './components/WaitingRoomModal';
import { GameReplayModal } from './components/replay/GameReplayModal';
import { LiveChatWidget } from './components/LiveChatWidget';

const tabVariants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: 'blur(3px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.24,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(2px)',
    transition: {
      duration: 0.16,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const MainAppContent: React.FC = () => {
  const { activeMatch, activeTab } = useGame();

  return (
    <AnimatePresence mode="wait">
      {activeMatch ? (
        <motion.div
          key={`match-${activeMatch.id}`}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto"
        >
          {activeMatch.status === 'waiting_for_opponent' ? (
            <WaitingRoomModal />
          ) : (
            <>
              {activeMatch.gameMode === 'whot' && <WhotGameScreen />}
              {(activeMatch.gameMode === 'ludo_classic' || activeMatch.gameMode === 'ludo_blitz') && (
                <LudoGameScreen />
              )}
              {activeMatch.gameMode === 'draughts' && <DraughtsGameScreen />}
              {activeMatch.gameMode === 'bead16' && <Bead16GameScreen />}
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          key={`tab-${activeTab}`}
          variants={tabVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex-1 flex flex-col min-h-0 w-full max-w-7xl mx-auto"
        >
          {activeTab === 'arena' && <ArenaScreen />}
          {activeTab === 'lobby' && <LobbyScreen />}
          {activeTab === 'wallet' && <WalletScreen />}
          {activeTab === 'analytics' && <AnalyticsScreen />}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const AppRoot: React.FC = () => {
  const { isAuthenticated, openAuthModal, activeReplay, closeReplay } = useGame();
  const [isStandaloneAdminOpen, setIsStandaloneAdminOpen] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('skillstake_admin_token'));
    } catch {
      return false;
    }
  });

  const handleExitAdmin = () => {
    try {
      localStorage.removeItem('skillstake_admin_token');
    } catch {
      // ignore
    }
    setIsStandaloneAdminOpen(false);
  };

  // Standalone Admin Hub View (accessible via footer or secret admin trigger)
  const isAdminActive = isStandaloneAdminOpen || Boolean(typeof window !== 'undefined' && localStorage.getItem('skillstake_admin_token'));
  if (isAdminActive) {
    return <AdminDashboardScreen onExitAdmin={handleExitAdmin} />;
  }

  // 1. If not authenticated, present the Web Landing Page
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage
          onOpenAuth={(tab) => openAuthModal(tab)}
          onOpenAdmin={() => setIsStandaloneAdminOpen(true)}
        />
        <AuthModal />
      </>
    );
  }

  // 2. If authenticated as player/demo, present the responsive Dashboard (Desktop web, Mobile browser, Telegram)
  return (
    <div
      id="skillstake-dashboard-root"
      className="min-h-[var(--app-height)] bg-[#020617] text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 relative overflow-x-hidden"
    >
      {/* Ambient background glows */}
      <div className="fixed -top-24 -right-24 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed top-1/2 -left-32 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-24 right-1/4 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Responsive Top Navigation Header */}
      <TopBar />

      {/* Main Responsive Content Area */}
      <main className="flex-1 flex flex-col min-h-0 relative w-full">
        <MainAppContent />
      </main>

      {/* Mobile & Telegram Mini App Bottom Navigation (hidden on desktop md+) */}
      <BottomNav />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Game Replay Modal */}
      {activeReplay && <GameReplayModal replay={activeReplay} onClose={closeReplay} />}
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <AppRoot />
      <LiveChatWidget />
    </GameProvider>
  );
}
