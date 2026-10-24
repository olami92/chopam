import React from 'react';
import { useGame } from '../context/GameContext';
import {
  ShieldCheck,
  Zap,
  Trophy,
  ArrowRight,
  Layers,
  Dices,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Send,
  Smartphone,
  Laptop,
  Users,
  CreditCard,
  ChevronDown,
  HelpCircle,
  Swords,
} from 'lucide-react';
import { sound } from '../services/audio';

interface LandingPageProps {
  onOpenAuth: (tab: 'signin' | 'register') => void;
  onOpenAdmin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onOpenAdmin }) => {
  const { loginAsDemo, loginWithTelegram } = useGame();

  const handleStartDemo = () => {
    sound.playClick();
    loginAsDemo();
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-amber-500 selection:text-slate-950 flex flex-col relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed -top-32 left-1/4 w-[500px] h-[500px] bg-indigo-500/15 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed top-1/2 -right-32 w-[450px] h-[450px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-32 left-1/3 w-[500px] h-[500px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-black tracking-tight text-white">Tete Arena</span>
              <span className="hidden sm:inline text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                P2P Arena
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              Nigeria’s Premier P2P Skill-Wagering Platform
            </p>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
          <a href="#games" className="hover:text-amber-400 transition-colors">
            Battlegrounds
          </a>
          <a href="#escrow" className="hover:text-amber-400 transition-colors">
            Escrow Protocol
          </a>
          <a href="#multidevice" className="hover:text-amber-400 transition-colors">
            Web & Telegram
          </a>
          <a href="#faq" className="hover:text-amber-400 transition-colors">
            FAQ
          </a>
        </nav>

        {/* Right CTA Group */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleStartDemo}
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-bold text-slate-200 border border-white/10 transition-colors cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Instant Demo</span>
          </button>

          <button
            id="btn-nav-signin"
            onClick={() => onOpenAuth('signin')}
            className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-bold text-white border border-white/10 transition-colors cursor-pointer"
          >
            Sign In
          </button>

          <button
            id="btn-nav-register"
            onClick={() => onOpenAuth('register')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 text-xs font-black tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            Register Free
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative px-4 sm:px-8 pt-12 sm:pt-20 pb-16 max-w-6xl mx-auto w-full text-center flex flex-col items-center">
        {/* Ticker Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-white/10 shadow-lg mb-6 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[11px] font-bold text-slate-300">
            ₦48,250,000+ Escrow Settled Today • 45,000+ Active Stakers
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight max-w-4xl leading-[1.12]">
          Play Nigerian Classics. <br className="hidden sm:block" />
          <span className="text-amber-400">Wager Your Skill.</span> Win Real Escrow Cash.
        </h1>

        <p className="mt-5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
          The provably fair P2P wager platform for <strong>Naija Whot</strong>,{' '}
          <strong>Authentic 15x15 Ludo</strong>, and <strong>Tactical Draughts</strong>. Automated smart
          contract escrow, zero house advantage, and instant Nigerian bank payouts.
        </p>

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-xl">
          <button
            id="hero-btn-telegram"
            onClick={() => {
              sound.playClick();
              loginWithTelegram();
            }}
            className="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-sky-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Play on Telegram</span>
          </button>

          <button
            id="hero-btn-register"
            onClick={() => onOpenAuth('register')}
            className="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <span>Web Register</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            id="hero-btn-demo"
            onClick={handleStartDemo}
            className="w-full sm:w-auto flex-1 py-4 px-6 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-sm border border-white/10 shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Free Demo</span>
          </button>
        </div>

        {/* Telegram Quick Badge */}
        <div className="mt-4 flex items-center gap-2 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3.5 py-1.5 rounded-full">
          <Send className="w-3.5 h-3.5" />
          <span>Launch seamlessly as a Telegram Mini App (@SkillStakeBot) • Instant Bank Payouts</span>
        </div>

        {/* Trust Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-12 sm:mt-16 w-full max-w-5xl">
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Total Winnings Paid
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 block">
              ₦184,500,000+
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Instant bank withdrawals</span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Active Stakers
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-400 mt-1 block">
              45,200+
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Across all 36 states</span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Escrow Protocol
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-400 mt-1 block">
              100% Automated
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Zero human touch or bias</span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 text-left">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block">
              Disbursement Speed
            </span>
            <span className="text-xl sm:text-2xl font-black text-white mt-1 block">
              Instant
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Polygon USDT Smart Escrow</span>
          </div>
        </div>
      </section>

      {/* BATTLEGROUNDS GAMES SHOWCASE */}
      <section id="games" className="px-4 sm:px-8 py-14 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30 px-3 py-1 rounded-full">
            The Battlegrounds
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            Skill-Based Nigerian Arena Games
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            No luck, no algorithms, no casino tricks. Play real opponents head-to-head for real stakes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {/* Card 1: Naija Whot */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-indigo-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                  Flagship 🇳🇬
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Naija Whot</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                The undisputed Nigerian card duel. Master Hold On (1), Pick Two (2), General Market (14),
                and Whot 20 shape requests.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Min Stake: <strong className="text-white">₦1,000</strong></span>
                <span className="text-emerald-400 font-bold">48 Tables</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 space-y-2">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Play Whot Match</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleStartDemo}
                className="w-full py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Demo · Tete Coins</span>
              </button>
            </div>
          </div>

          {/* Card 2: Classic Ludo */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-emerald-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Dices className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  15x15 Board
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Classic Ludo</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Authentic 15x15 street board geometry. Roll 6 to deploy from yard, hunt tokens along safe
                star tracks, and capture for bonus turns.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Min Stake: <strong className="text-white">₦1,000</strong></span>
                <span className="text-emerald-400 font-bold">34 Tables</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 space-y-2">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Play Classic Ludo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleStartDemo}
                className="w-full py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Demo · Tete Coins</span>
              </button>
            </div>
          </div>

          {/* Card 3: Ludo Blitz */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-amber-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  High Skill
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Ludo Blitz</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Dice replaced by strategic movement hands. Choose exact step cards to orchestrate precision
                knockouts without random roll frustration.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Min Stake: <strong className="text-white">₦2,500</strong></span>
                <span className="text-emerald-400 font-bold">29 Tables</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 space-y-2">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Play Ludo Blitz</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleStartDemo}
                className="w-full py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Demo · Tete Coins</span>
              </button>
            </div>
          </div>

          {/* Card 4: Draughts Duel */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-rose-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Trophy className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                  10x10 Eat-Up
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Draughts Duel</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Authentic 10x10 Nigerian & International draughts tactics with mandatory compulsory capture (eat-up),
                chain multi-jumps, and King piece coronations.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Min Stake: <strong className="text-white">₦1,500</strong></span>
                <span className="text-emerald-400 font-bold">22 Tables</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 space-y-2">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Play Draughts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleStartDemo}
                className="w-full py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Demo · Tete Coins</span>
              </button>
            </div>
          </div>

          {/* Card 5: Bead 16 Tactics */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-cyan-500/50 rounded-3xl p-5 flex flex-col justify-between transition-all group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Swords className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                  16-Bead Duel
                </span>
              </div>
              <h3 className="text-lg font-black text-white">Bead 16 Tactics</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Traditional 37-node Sholo Guti board with 16 vs 16 bead captures, diagonal lines, and chain multi-jumps.
              </p>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                <span>Min Stake: <strong className="text-white">₦500</strong></span>
                <span className="text-cyan-400 font-bold">18 Tables</span>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5 space-y-2">
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Play Bead 16</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleStartDemo}
                className="w-full py-1.5 rounded-xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 border border-cyan-400/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Demo · Tete Coins</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* HOW THE ESCROW PROTOCOL WORKS */}
      <section id="escrow" className="px-4 sm:px-8 py-16 bg-slate-950/60 border-y border-white/10 relative">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
              Automated Escrow Protocol
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
              How Your Money is Protected
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Every match is backed by automated smart escrow. Neither player nor Tete Arena can alter the outcome.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-purple-500 text-white font-black text-sm flex items-center justify-center mb-3">
                1
              </span>
              <h4 className="text-sm font-bold text-white">Deposit Polygon USDT</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Fund your escrow wallet via 1-click Web3 wallet (MetaMask, Trust) or direct USDT transfer from any crypto exchange.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-indigo-500 text-white font-black text-sm flex items-center justify-center mb-3">
                2
              </span>
              <h4 className="text-sm font-bold text-white">Lock Escrow Stakes</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Both players lock matching stakes (e.g. ₦2,500 each) into an isolated smart contract pot.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black text-sm flex items-center justify-center mb-3">
                3
              </span>
              <h4 className="text-sm font-bold text-white">Head-to-Head Battle</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Play in real-time. Every move is verified on the game engine with anti-cheat timeout rules.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-5 relative">
              <span className="w-8 h-8 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center mb-3">
                4
              </span>
              <h4 className="text-sm font-bold text-white">Instant 95% Payout</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                The winner receives 95% of the gross pot directly into their available balance, withdrawable instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MULTI-DEVICE SECTION: WEB + MOBILE + TELEGRAM */}
      <section id="multidevice" className="px-4 sm:px-8 py-16 max-w-6xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full">
            Play Anywhere
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
            Designed for Desktop, Mobile Web & Telegram
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Seamless cross-platform gaming with a single unified account and shared escrow wallet.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4">
              <Laptop className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-white">Desktop Web Dashboard</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Full-featured widescreen dashboard with multi-column battleground selection, open tables lobby,
              in-depth analytics, and high-resolution game boards.
            </p>
            <span className="mt-4 text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-3 py-1 rounded-full">
              Optimized for Chrome & Safari
            </span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
              <Smartphone className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-white">Mobile Browser View</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Touch-optimized responsive mobile interface with thumb-friendly controls, quick card swiping,
              and low-latency 60fps game rendering on any smartphone.
            </p>
            <span className="mt-4 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full">
              iOS & Android Responsive
            </span>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center mb-4">
              <Send className="w-7 h-7" />
            </div>
            <h3 className="text-base font-black text-white">Telegram Mini App</h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Launch directly inside Telegram via @SkillStakeBot. Native haptic feedback, 1-click friend invites,
              and seamless deep links to join private tables in seconds.
            </p>
            <span className="mt-4 text-[10px] font-bold text-sky-300 bg-sky-500/20 px-3 py-1 rounded-full">
              Zero Install Needed
            </span>
          </div>
        </div>
      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="px-4 sm:px-8 py-16 bg-slate-950/60 border-t border-white/10">
        <div className="max-w-4xl mx-auto w-full">
          <div className="text-center mb-10">
            <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-white/10">
              Got Questions?
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3.5">
            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                Is Tete Arena legal in Nigeria?
              </h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed pl-6">
                Yes. Tete Arena operates strictly as a skill-based P2P competition platform where the outcome of games
                like Whot, Ludo, and Draughts depends on mental strategy and player dexterity, not chance.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                How are payouts handled and how fast are withdrawals?
              </h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed pl-6">
                Withdrawals are strictly processed in Polygon USDT via our smart contract oracle directly to any
                Polygon (ERC-20) address or crypto exchange (Binance, Bybit, KuCoin, Roqqu, etc.). Transfers confirm in seconds.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                Can I play with my friends on Telegram?
              </h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed pl-6">
                Absolutely! You can click "Create Private Table" in the dashboard, set your custom stake, and share the
                generated room link or room code directly to your WhatsApp or Telegram chat.
              </p>
            </div>

            <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-4 sm:p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-rose-400 shrink-0" />
                What happens if an opponent disconnects during a match?
              </h4>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed pl-6">
                Our smart engine provides a 45-second reconnection grace period. If the disconnected player does not return,
                they forfeit the round and the escrow pot is awarded to the connected player.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CALL TO ACTION BOTTOM BANNER */}
      <section className="px-4 sm:px-8 py-14 max-w-5xl mx-auto w-full text-center">
        <div className="bg-gradient-to-r from-amber-500/20 via-indigo-500/20 to-emerald-500/20 border border-amber-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Ready to Prove Your Skills?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto mt-2.5">
            Create an account in 30 seconds and receive a <strong>₦25,000 Signup Trial Bank</strong> to test
            your tactics across all battlegrounds.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
            >
              Claim ₦25,000 & Register
            </button>
            <button
              onClick={handleStartDemo}
              className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs border border-white/10 transition-colors cursor-pointer"
            >
              Try Instant Demo
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto border-t border-white/10 bg-slate-950 px-4 sm:px-8 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white text-sm">Tete Arena</span>
          </div>

          <div className="flex items-center gap-6 text-[11px] text-slate-400 flex-wrap justify-center">
            <span>Provably Fair Escrow</span>
            <span>Zero House Edge</span>
            <span>18+ Responsible Gaming</span>
            <span>Instant Monnify Payouts</span>
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="text-purple-400 hover:text-purple-300 font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Platform Owner Portal Login"
              >
                <Lock className="w-3 h-3" />
                <span>Admin Hub</span>
              </button>
            )}
          </div>

          <p className="text-[11px]">
            © 2026 Tete Arena. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};
