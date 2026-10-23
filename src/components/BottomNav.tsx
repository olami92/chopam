import React from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { TabType } from '../types';
import { Flame, Swords, Wallet, BarChart3, User } from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'arena', label: 'Arena', icon: Flame },
  { id: 'lobby', label: 'Lobby', icon: Swords },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export const BottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeMatch,
    openProfileMenu,
    unreadNotificationsCount,
  } = useGame();

  // If in an active match, hide bottom bar to focus on the game board
  if (activeMatch) return null;

  const handleTabClick = (tab: TabType) => {
    if (tab !== activeTab) {
      sound.playClick();
      telegram.triggerHaptic('selection');
      setActiveTab(tab);
    }
  };

  const handleProfileClick = () => {
    sound.playClick();
    telegram.triggerHaptic('selection');
    openProfileMenu();
  };

  return (
    <nav
      id="bottom-navigation-bar"
      className="md:hidden sticky bottom-0 z-30 flex items-center justify-around px-3 py-2 bg-slate-900/90 backdrop-blur-md border-t border-white/10"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const Icon = item.icon;

        return (
          <motion.button
            key={item.id}
            id={`nav-tab-${item.id}`}
            whileTap={{ scale: 0.88 }}
            onClick={() => handleTabClick(item.id)}
            className={`flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all relative cursor-pointer ${
              isActive ? 'text-white' : 'text-slate-400 opacity-50 hover:opacity-100'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="bottomnav-indicator"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-6 h-1 bg-amber-500 rounded-full mb-1 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
              />
            )}
            <Icon
              className={`w-5 h-5 transition-transform duration-200 ${
                isActive ? 'scale-110 text-amber-400 stroke-[2.4]' : 'scale-100 stroke-[1.8]'
              }`}
            />
            <span
              className={`text-[10px] mt-0.5 tracking-tight ${
                isActive ? 'font-bold text-white' : 'font-medium text-slate-400'
              }`}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}

      {/* Mobile Profile Trigger Button */}
      <motion.button
        id="nav-tab-profile"
        whileTap={{ scale: 0.88 }}
        onClick={handleProfileClick}
        className="flex flex-col items-center justify-center w-14 py-1 rounded-xl transition-all relative cursor-pointer text-slate-400 opacity-75 hover:opacity-100"
      >
        <div className="relative">
          <User className="w-5 h-5 stroke-[1.8]" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse" />
          )}
        </div>
        <span className="text-[10px] mt-0.5 tracking-tight font-medium text-slate-400">
          Profile
        </span>
      </motion.button>
    </nav>
  );
};
