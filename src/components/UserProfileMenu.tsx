import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import {
  X,
  User,
  ShieldCheck,
  Send,
  MapPin,
  Bell,
  Check,
  Copy,
  Edit2,
  CheckCircle2,
  ExternalLink,
  Award,
  Wallet,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Trash2,
  Lock,
  LogOut,
  Mail,
  Phone,
  MessageSquarePlus,
  Bug,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { FeedbackForm } from './FeedbackForm';
import { getDynamicAvatarUrl } from '../utils/avatar';

export const UserProfileMenu: React.FC = () => {
  const {
    user,
    isProfileMenuOpen,
    closeProfileMenu,
    updateUserProfile,
    bindTelegram,
    unbindTelegram,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,
    logout,
  } = useGame();

  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(user.username);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [tempLocation, setTempLocation] = useState(user.location || 'Lagos, Nigeria');
  const [isRebindingTelegram, setIsRebindingTelegram] = useState(false);
  const [tempTelegramId, setTempTelegramId] = useState(user.telegramId ? String(user.telegramId) : '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // KYC Email & Phone state
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [tempEmail, setTempEmail] = useState(user.email || 'player@example.invalid');

  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneOtpInput, setPhoneOtpInput] = useState('');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState(user.phone || '');

  const [avatarSeedIndex, setAvatarSeedIndex] = useState(0);

  const currentAvatarUrl = React.useMemo(() => {
    if (avatarSeedIndex > 0) {
      return getDynamicAvatarUrl(`${user.username || 'player'}_v${avatarSeedIndex}`);
    }
    if (user.avatarUrl && !user.avatarUrl.includes('unsplash.com')) {
      return user.avatarUrl;
    }
    return getDynamicAvatarUrl(user.username || user.displayName || 'player');
  }, [user.avatarUrl, user.username, user.displayName, avatarSeedIndex]);

  const handleShuffleAvatar = () => {
    const nextIdx = avatarSeedIndex + 1;
    setAvatarSeedIndex(nextIdx);
    const newAvatar = getDynamicAvatarUrl(`${user.username || 'player'}_v${nextIdx}`);
    updateUserProfile({ avatarUrl: newAvatar });
    sound.playClick();
    telegram.triggerHaptic('light');
  };

  if (!isProfileMenuOpen && !showFeedbackModal) return null;

  const handleCopy = (text: string, fieldName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      sound.playClick();
      telegram.triggerHaptic('light');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleSaveUsername = () => {
    const clean = tempUsername.trim().replace(/^@/, '');
    if (clean) {
      updateUserProfile({ username: clean });
      setIsEditingUsername(false);
      sound.playClick();
    }
  };

  const handleConfirmEmailVerification = () => {
    updateUserProfile({ emailVerified: true });
    setIsVerifyingEmail(false);
    setEmailOtpInput('');
    sound.playWin();
    telegram.triggerHaptic('success');
  };

  const handleConfirmPhoneVerification = () => {
    updateUserProfile({ phoneVerified: true });
    setIsVerifyingPhone(false);
    setPhoneOtpInput('');
    sound.playWin();
    telegram.triggerHaptic('success');
  };

  const handleVerifyBothInstant = () => {
    updateUserProfile({ emailVerified: true, phoneVerified: true });
    setIsVerifyingEmail(false);
    setIsVerifyingPhone(false);
    sound.playWin();
    telegram.triggerHaptic('success');
  };

  const handleResetKyc = () => {
    updateUserProfile({ emailVerified: false, phoneVerified: false });
    setIsVerifyingEmail(false);
    setIsVerifyingPhone(false);
    sound.playClick();
  };

  const handleSaveEmail = () => {
    const clean = tempEmail.trim();
    if (clean) {
      updateUserProfile({ email: clean, emailVerified: false });
      setIsEditingEmail(false);
      sound.playClick();
    }
  };

  const handleSavePhone = () => {
    const clean = tempPhone.trim();
    if (clean) {
      updateUserProfile({ phone: clean, phoneVerified: false });
      setIsEditingPhone(false);
      sound.playClick();
    }
  };

  const handleSaveLocation = () => {
    const clean = tempLocation.trim();
    if (clean) {
      updateUserProfile({ location: clean });
      setIsEditingLocation(false);
      sound.playClick();
    }
  };

  const handleSaveTelegramId = () => {
    const parsed = parseInt(tempTelegramId.trim(), 10);
    if (!isNaN(parsed) && parsed > 0) {
      bindTelegram(parsed, user.telegramBotUsername || 'SkillStakeBot');
      setIsRebindingTelegram(false);
    }
  };

  return (
    <AnimatePresence>
      {isProfileMenuOpen && (
      <div
        id="user-profile-menu-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm"
        onClick={closeProfileMenu}
      >
        <motion.div
          id="user-profile-menu-container"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-white/10 bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img
                  src={currentAvatarUrl}
                  alt={user.displayName}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded-2xl object-cover bg-slate-800"
                />
                <button
                  type="button"
                  onClick={handleShuffleAvatar}
                  className="absolute -bottom-1 -right-1 rounded-full bg-slate-800 p-1.5 text-slate-300 hover:text-amber-300 border border-white/10"
                  title="Change avatar"
                  aria-label="Change avatar"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-white">{user.actualName || user.displayName}</h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                  <button
                    onClick={() => handleCopy(`@${user.username}`, 'username')}
                    className="flex items-center gap-1 hover:text-amber-300"
                  >
                    <span>@{user.username}</span>
                    {copiedField === 'username' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                  <span className="text-slate-600">·</span>
                  <span>{user.tier}</span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Rank</div>
                <div className="mt-0.5 font-semibold text-amber-300">#{user.rank}</div>
              </div>
              <button
                onClick={() => {
                  sound.playClick();
                  closeProfileMenu();
                }}
                className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close profile"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3 text-center">
              <div>
                <div className="text-[10px] text-slate-500">Matches</div>
                <div className="mt-1 text-sm font-semibold text-white">{user.totalWagers}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Win rate</div>
                <div className="mt-1 text-sm font-semibold text-emerald-300">{user.winRate}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500">Balance</div>
                <div className="mt-1 text-sm font-semibold text-amber-300">₦{user.availableBalance.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Segmented Tab Switcher with Animated Indicator */}
          <div className="px-4 py-3 bg-slate-900 border-b border-white/10 flex gap-2">
            <button
              onClick={() => {
                setActiveTab('profile');
                sound.playClick();
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                activeTab === 'profile'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Player Profile</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('notifications');
                sound.playClick();
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative z-10 ${
                activeTab === 'notifications'
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Alerts</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

          </div>

          {/* Tab 1: Profile & Identity View */}
          {activeTab === 'profile' && (
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Identity Detail Grid */}
              <div className="space-y-3">
                {/* 1. Username field */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-amber-400" />
                      <span>Username</span>
                    </span>
                    {!isEditingUsername ? (
                      <button
                        onClick={() => {
                          setTempUsername(user.username);
                          setIsEditingUsername(true);
                        }}
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveUsername}
                          className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setIsEditingUsername(false)}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditingUsername ? (
                    <div className="flex items-center justify-between font-mono font-bold text-white text-sm">
                      <span>@{user.username}</span>
                      <button
                        onClick={() => handleCopy(`@${user.username}`, 'username')}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Copy username"
                      >
                        {copiedField === 'username' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-2.5 text-slate-500 font-mono">@</span>
                        <input
                          type="text"
                          value={tempUsername}
                          onChange={(e) => setTempUsername(e.target.value)}
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl pl-7 pr-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                          placeholder="username"
                          autoFocus
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Name field (Permanent Non-Editable) */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Legal Identity</span>
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1 font-medium">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>Non-editable</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-bold text-white text-sm">
                    <span>{user.actualName || user.displayName}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Permanent ID Record
                    </span>
                  </div>
                </div>

                {/* 3. KYC Verification Status Card (Email & Phone Verification) */}
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 space-y-3.5 ${
                    user.isVerified
                      ? 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_24px_rgba(16,185,129,0.12)]'
                      : 'bg-slate-950/70 border-amber-500/30'
                  }`}
                >
                  {/* Telegram Status Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-sky-500/20 text-sky-400 border border-sky-500/40">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-white text-xs uppercase tracking-wider">
                          Telegram Identity & Verification
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          KYC verification is bypassed for Telegram users. Your account is authenticated via Telegram with full access to gameplay and bank withdrawals.
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>VERIFIED</span>
                      </span>
                    </div>
                  </div>

                  {/* Verification Rows */}
                  <div className="space-y-2.5 pt-1">
                    {/* A. Email Verification Row */}
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-sky-400" />
                          <span>1. Email Address</span>
                        </span>
                        {user.emailVerified ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </div>

                      {!isEditingEmail ? (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-white text-xs font-semibold">{user.email || 'player@example.invalid'}</span>
                          <div className="flex items-center gap-1.5">
                            {!user.emailVerified ? (
                              <button
                                onClick={() => {
                                  setIsVerifyingEmail(true);
                                  setIsVerifyingPhone(false);
                                  sound.playClick();
                                }}
                                className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-sm"
                              >
                                Verify Email
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  updateUserProfile({ emailVerified: false });
                                  sound.playClick();
                                }}
                                className="text-[10px] text-slate-500 hover:text-slate-300 font-medium cursor-pointer"
                                title="Reset email verification to test KYC"
                              >
                                Unverify
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setTempEmail(user.email || 'player@example.invalid');
                                setIsEditingEmail(true);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Email"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="email"
                            value={tempEmail}
                            onChange={(e) => setTempEmail(e.target.value)}
                            className="flex-1 bg-slate-950 border border-sky-500/40 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 font-mono"
                            placeholder="email@example.com"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEmail}
                            className="px-2.5 py-1 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditingEmail(false)}
                            className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Inline Email Verification Prompt */}
                      {isVerifyingEmail && !user.emailVerified && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-indigo-950/50 border border-indigo-500/30 p-2.5 rounded-xl space-y-2 mt-2"
                        >
                          <div className="flex items-center justify-between text-[11px] text-indigo-200">
                            <span>Enter 4-digit code sent to inbox:</span>
                            <span className="font-mono font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-500/30">
                              Demo OTP: 4821
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={emailOtpInput}
                              onChange={(e) => setEmailOtpInput(e.target.value)}
                              placeholder="Enter 4821"
                              className="flex-1 bg-slate-950 border border-indigo-500/40 rounded-xl px-3 py-1.5 text-white font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                              autoFocus
                            />
                            <button
                              onClick={handleConfirmEmailVerification}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm</span>
                            </button>
                            <button
                              onClick={() => setIsVerifyingEmail(false)}
                              className="px-2 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* B. Phone Verification Row */}
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-amber-400" />
                          <span>2. Phone Number</span>
                        </span>
                        {user.phoneVerified ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Unverified</span>
                          </span>
                        )}
                      </div>

                      {!isEditingPhone ? (
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-white text-xs font-semibold">{user.phone || ''}</span>
                          <div className="flex items-center gap-1.5">
                            {!user.phoneVerified ? (
                              <button
                                onClick={() => {
                                  setIsVerifyingPhone(true);
                                  setIsVerifyingEmail(false);
                                  sound.playClick();
                                }}
                                className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow-sm"
                              >
                                Verify Phone
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  updateUserProfile({ phoneVerified: false });
                                  sound.playClick();
                                }}
                                className="text-[10px] text-slate-500 hover:text-slate-300 font-medium cursor-pointer"
                                title="Reset phone verification to test KYC"
                              >
                                Unverify
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setTempPhone(user.phone || '');
                                setIsEditingPhone(true);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Edit Phone"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="tel"
                            value={tempPhone}
                            onChange={(e) => setTempPhone(e.target.value)}
                            className="flex-1 bg-slate-950 border border-amber-500/40 rounded-xl px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                            placeholder="+234..."
                            autoFocus
                          />
                          <button
                            onClick={handleSavePhone}
                            className="px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditingPhone(false)}
                            className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* Inline Phone Verification Prompt */}
                      {isVerifyingPhone && !user.phoneVerified && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-xl space-y-2 mt-2"
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-200">
                            <span>Enter 4-digit SMS code:</span>
                            <span className="font-mono font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30">
                              SMS OTP: 7392
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              maxLength={6}
                              value={phoneOtpInput}
                              onChange={(e) => setPhoneOtpInput(e.target.value)}
                              placeholder="Enter 7392"
                              className="flex-1 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 text-white font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
                              autoFocus
                            />
                            <button
                              onClick={handleConfirmPhoneVerification}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Confirm</span>
                            </button>
                            <button
                              onClick={() => setIsVerifyingPhone(false)}
                              className="px-2 py-1.5 text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Testing helper shortcuts */}
                  <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                    <span>
                      {user.isVerified
                        ? '✓ Verified KYC unlocked across all game modes'
                        : 'KYC status updates automatically once both are verified'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!user.isVerified ? (
                        <button
                          onClick={handleVerifyBothInstant}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                        >
                          Verify Both (1-Click)
                        </button>
                      ) : (
                        <button
                          onClick={handleResetKyc}
                          className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer underline"
                        >
                          Reset KYC (Test Flow)
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Telegram ID Binded from Telegram Bot */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-sky-500/20 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-sky-400" />
                      <span>Telegram Bot Binding</span>
                    </span>
                    <span className="text-[10px] font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      <span>{user.telegramBindStatus === 'bound' ? 'Active & Synced' : 'Unlinked'}</span>
                    </span>
                  </div>

                  {!isRebindingTelegram ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono font-black text-white text-sm flex items-center gap-1.5">
                            <span>ID: {user.telegramId || 'Not Bound'}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>Bot: @{user.telegramBotUsername || 'SkillStakeBot'}</span>
                            <CheckCircle2 className="w-3 h-3 text-sky-400" />
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {user.telegramId && (
                            <button
                              onClick={() => handleCopy(String(user.telegramId), 'tgId')}
                              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                              title="Copy Telegram ID"
                            >
                              {copiedField === 'tgId' ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setTempTelegramId(user.telegramId ? String(user.telegramId) : '');
                              setIsRebindingTelegram(true);
                            }}
                            className="px-2.5 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-[11px] cursor-pointer"
                          >
                            {user.telegramId ? 'Rebind' : 'Bind Bot'}
                          </button>
                        </div>
                      </div>

                      <div className="bg-sky-950/40 border border-sky-500/15 p-2 rounded-xl text-[10px] text-sky-200/80 flex items-start gap-2">
                        <Send className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          Bound to official Telegram Bot. Wager invitations, escrow receipts, and winning withdrawals are pushed directly to your Telegram chat.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={tempTelegramId}
                          onChange={(e) => setTempTelegramId(e.target.value)}
                          className="flex-1 bg-slate-900 border border-sky-500/40 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
                          placeholder="e.g. 729104882"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveTelegramId}
                          className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Bind
                        </button>
                        <button
                          onClick={() => setIsRebindingTelegram(false)}
                          className="px-2 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Enter your Telegram Numeric ID or launch @SkillStakeBot in Telegram to auto-authenticate.
                      </p>
                    </div>
                  )}
                </div>

                {/* 4. Location */}
                <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Location</span>
                    </span>
                    {!isEditingLocation ? (
                      <button
                        onClick={() => {
                          setTempLocation(user.location || 'Lagos, Nigeria');
                          setIsEditingLocation(true);
                        }}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSaveLocation}
                          className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={() => setIsEditingLocation(false)}
                          className="text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {!isEditingLocation ? (
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{user.location || 'Lagos, Nigeria'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Regional escrow node routing for lowest network latency.
                      </p>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={tempLocation}
                      onChange={(e) => setTempLocation(e.target.value)}
                      className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 mt-1"
                      placeholder="e.g. Lagos, Nigeria"
                      autoFocus
                    />
                  )}
                </div>
              </div>

              {/* Bug Report & Feature Request Direct Trigger Card */}
              <div className="p-3.5 bg-slate-950/40 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <MessageSquarePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Help Us Build Tete Arena</h4>
                    <p className="text-[10px] text-slate-400">Found a bug or have an awesome feature idea?</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setShowFeedbackModal(true);
                    closeProfileMenu();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                >
                  <span>Give Feedback</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-white/5">
                <button
                  onClick={() => {
                    sound.playClick();
                    closeProfileMenu();
                    logout();
                  }}
                  className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1.5 cursor-pointer text-xs transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    closeProfileMenu();
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Notification Center View */}
          {activeTab === 'notifications' && (
            <div className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
              {/* Notification Controls Bar */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">All Alerts ({notifications.length})</span>
                  {unreadNotificationsCount > 0 && (
                    <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                      {unreadNotificationsCount} unread
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-indigo-400 hover:text-indigo-300 font-bold text-[11px] cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearNotifications}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                      title="Clear notifications"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Notification Cards List */}
              {notifications.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-slate-400 font-semibold">No notifications right now</p>
                  <p className="text-[11px] text-slate-500">
                    Match challenge requests, escrow payouts, and Telegram alerts will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif) => {
                    const isEscrow = notif.type === 'escrow';
                    const isTelegram = notif.type === 'telegram';
                    const isMatch = notif.type === 'match';
                    const isReward = notif.type === 'reward';

                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => markNotificationAsRead(notif.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                          notif.read
                            ? 'bg-slate-950/40 border-white/5 text-slate-300'
                            : 'bg-slate-950/80 border-indigo-500/30 shadow-md text-white'
                        }`}
                      >
                        {!notif.read && (
                          <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-indigo-400 ring-4 ring-indigo-400/20" />
                        )}

                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border ${
                              isEscrow
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : isTelegram
                                ? 'bg-sky-500/20 border-sky-500/40 text-sky-400'
                                : isMatch
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                : isReward
                                ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                                : 'bg-slate-800 border-white/10 text-slate-300'
                            }`}
                          >
                            {isEscrow ? (
                              <Wallet className="w-4 h-4" />
                            ) : isTelegram ? (
                              <Send className="w-4 h-4" />
                            ) : isMatch ? (
                              <Sparkles className="w-4 h-4" />
                            ) : (
                              <Award className="w-4 h-4" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-xs truncate">{notif.title}</h4>
                              {notif.amount && (
                                <span className="text-[10px] font-mono font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                                  +₦{notif.amount.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {notif.message}
                            </p>
                            <span className="text-[10px] text-slate-500 font-mono mt-1.5 block">
                              {notif.timestamp}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </motion.div>
      </div>
      )}

      {showFeedbackModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
          onClick={() => setShowFeedbackModal(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 id="feedback-modal-title" className="text-base font-semibold text-white">Support & Feedback</h2>
                <p className="mt-1 text-xs text-slate-400">Tell us what happened or what you’d like to see next.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close feedback"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <div>
                  <h3 className="text-xs font-semibold text-white">ChopAm Live Help & Support</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    Get help with deposits, withdrawals, and game rules through live chat. Use the form below to report a problem or suggest a feature.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    window.dispatchEvent(new CustomEvent('open_live_chat'));
                  }}
                  className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-white/5"
                >
                  Live chat
                </button>
              </div>

              <FeedbackForm
                user={{ id: user.id || 'usr_current', username: user.username, email: user.email }}
                onSuccess={() => setShowFeedbackModal(false)}
                onCancel={() => setShowFeedbackModal(false)}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

