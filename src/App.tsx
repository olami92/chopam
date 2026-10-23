import React, { Suspense, lazy, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameProvider, useGame } from './context/GameContext';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { AuthModal } from './components/AuthModal';
const LandingPage = lazy(() => import('./screens/LandingPage').then((module) => ({ default: module.LandingPage })));
const ArenaScreen = lazy(() => import('./screens/ArenaScreen').then((module) => ({ default: module.ArenaScreen })));
const LobbyScreen = lazy(() => import('./screens/LobbyScreen').then((module) => ({ default: module.LobbyScreen })));
const WalletScreen = lazy(() => import('./screens/WalletScreen').then((module) => ({ default: module.WalletScreen })));
const AnalyticsScreen = lazy(() => import('./screens/AnalyticsScreen').then((module) => ({ default: module.AnalyticsScreen })));
const AdminDashboardScreen = lazy(() => import('./screens/AdminDashboardScreen').then((module) => ({ default: module.AdminDashboardScreen })));
const WhotGameScreen = lazy(() => import('./screens/WhotGameScreen').then((module) => ({ default: module.WhotGameScreen })));
const LudoGameScreen = lazy(() => import('./screens/LudoGameScreen').then((module) => ({ default: module.LudoGameScreen })));
const DraughtsGameScreen = lazy(() => import('./screens/DraughtsGameScreen').then((module) => ({ default: module.DraughtsGameScreen })));
const Bead16GameScreen = lazy(() => import('./screens/Bead16GameScreen').then((module) => ({ default: module.Bead16GameScreen })));
const WaitingRoomModal = lazy(() => import('./components/WaitingRoomModal').then((module) => ({ default: module.WaitingRoomModal })));
const GameReplayModal = lazy(() => import('./components/replay/GameReplayModal').then((module) => ({ default: module.GameReplayModal })));
const LiveChatWidget = lazy(() => import('./components/LiveChatWidget').then((module) => ({ default: module.LiveChatWidget })));

const ScreenLoading: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400" role="status">
    Loading game…
  </div>
);

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
    return <Suspense fallback={<ScreenLoading />}><AdminDashboardScreen onExitAdmin={handleExitAdmin} /></Suspense>;
  }

  // 1. If not authenticated, present the Web Landing Page
  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={<ScreenLoading />}>
        <LandingPage
          onOpenAuth={(tab) => openAuthModal(tab)}
          onOpenAdmin={() => setIsStandaloneAdminOpen(true)}
        />
        </Suspense>
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
          <Suspense fallback={<ScreenLoading />}>
            <MainAppContent />
          </Suspense>
      </main>

      {/* Mobile & Telegram Mini App Bottom Navigation (hidden on desktop md+) */}
      <BottomNav />

      {/* Global Auth Modal */}
      <AuthModal />

      {/* Game Replay Modal */}
      {activeReplay && <Suspense fallback={null}><GameReplayModal replay={activeReplay} onClose={closeReplay} /></Suspense>}
    </div>
  );
};

export default function App() {
  return (
    <GameProvider>
      <AppRoot />
      <Suspense fallback={null}><LiveChatWidget /></Suspense>
    </GameProvider>
  );
}
