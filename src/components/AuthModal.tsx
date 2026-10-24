import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  X,
  Lock,
  Mail,
  User,
  Phone,
  ShieldCheck,
  Send,
  Zap,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { sound } from '../services/audio';

export const AuthModal: React.FC = () => {
  const { authModalOpen, authModalTab, closeAuthModal, login, register, loginWithTelegram, loginAsDemo } = useGame();

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>(authModalTab || 'signin');

  // Sign In state
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // UI status
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!authModalOpen) return null;

  const handleTelegramAuth = async (customUser?: { id: number; username: string; first_name: string }) => {
    setError(null);
    setIsLoading(true);
    sound.playClick();

    const res = await loginWithTelegram(
      customUser
        ? {
            user: {
              id: customUser.id,
              username: customUser.username,
              first_name: customUser.first_name,
            },
          }
        : undefined
    );

    setIsLoading(false);
    if (!res.success) {
      setError(res.error || 'Telegram sign in failed.');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!signInIdentifier.trim()) {
      setError('Please enter your username or email');
      return;
    }
    if (!signInPassword.trim()) {
      setError('Please enter your account password');
      return;
    }

    setIsLoading(true);
    sound.playClick();

    const res = await login(signInIdentifier.trim(), signInPassword.trim());
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Invalid username/email or password.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const username = (regUsername.trim() || regName.trim()).replace(/\s+/g, '_').toLowerCase();
    if (!username || username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    if (!regPassword.trim() || regPassword.trim().length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }

    setIsLoading(true);
    sound.playClick();

    const res = await register({
      displayName: regName.trim() || username,
      username: username,
      email: regEmail.trim() || `${username}@skillstake.ng`,
      phone: regPhone.trim(),
      password: regPassword.trim(),
    });
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Registration failed.');
    }
  };

  return (
    <div
      id="auth-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="auth-modal"
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Header with Title & Close */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white">Tete Arena</h2>
              <p className="text-xs text-slate-400">Telegram & Web P2P Skill Gaming</p>
            </div>
          </div>

          <button
            id="close-auth-modal"
            onClick={() => {
              sound.playClick();
              closeAuthModal();
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Telegram Login Option */}
        <div className="space-y-2">
          <button
            type="button"
            id="btn-telegram-auth"
            disabled={isLoading}
            onClick={() => handleTelegramAuth()}
            className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2.5 cursor-pointer transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Continue with Telegram</span>
          </button>

          {/* Quick Telegram Demo Accounts for Browser Testing */}
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
              Or test with sample Telegram profiles:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() =>
                  handleTelegramAuth({
                    id: 9918231,
                    username: 'demo_player',
                    first_name: 'Tete Arena Player',
                  })
                }
                className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 px-2.5 py-1 rounded-lg border border-sky-500/20 transition-colors cursor-pointer"
              >
                @demo_player
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTelegramAuth({
                    id: 8820194,
                    username: 'whot_master',
                    first_name: 'Emeka Rolls',
                  })
                }
                className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors cursor-pointer"
              >
                @whot_master
              </button>
              <button
                type="button"
                onClick={() =>
                  handleTelegramAuth({
                    id: 7719283,
                    username: 'ludo_queen',
                    first_name: 'Zainab King',
                  })
                }
                className="text-[11px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors cursor-pointer"
              >
                @ludo_queen
              </button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            or password sign in
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Tab Switcher: Sign In vs Register */}
        <div className="flex p-1 bg-slate-950/80 rounded-2xl border border-white/10 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('signin');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab('register');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Username or Email</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="signin-identifier-input"
                  type="text"
                  value={signInIdentifier}
                  onChange={(e) => setSignInIdentifier(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Password</label>
                <span className="text-[10px] text-amber-400 hover:underline cursor-pointer">
                  Forgot Password?
                </span>
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="signin-password-input"
                  type="password"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              id="btn-submit-signin"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Enter Arena Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        )}

        {/* REGISTER FORM */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            {/* Starter Bonus Banner */}


            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Full Name</label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="reg-fullname-input"
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Babatunde Lawal"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Username</label>
              <div className="relative flex items-center">
                <span className="text-slate-400 text-xs font-mono absolute left-3 pointer-events-none">@</span>
                <input
                  id="reg-username-input"
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. LagosSniper"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Email</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    id="reg-email-input"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Phone (+234)</label>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                  <input
                    id="reg-phone-input"
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="08012345678"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  id="reg-password-input"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <button
              id="btn-submit-register"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-[10px] text-slate-500 text-center">
          By signing in, you agree to Tete Arena Terms and confirm you are 18+ years of age.
        </p>
      </div>
    </div>
  );
};

