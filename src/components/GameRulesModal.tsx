import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GameMode } from '../types';
import {
  X,
  BookOpen,
  Trophy,
  Layers,
  Dices,
  Sparkles,
  Flame,
  ShieldAlert,
  Crown,
  Zap,
  Star,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  Circle,
  Triangle,
  Plus,
  Square,
  Swords,
  Info,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

interface GameRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: GameMode;
}

export const GameRulesModal: React.FC<GameRulesModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'draughts',
}) => {
  const [activeTab, setActiveTab] = useState<GameMode>(initialMode);

  // Sync tab with initialMode whenever opened
  React.useEffect(() => {
    if (isOpen && initialMode) {
      setActiveTab(initialMode);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleTabChange = (mode: GameMode) => {
    setActiveTab(mode);
    sound.playClick();
    telegram.triggerHaptic('selection');
  };

  const handleClose = () => {
    sound.playClick();
    telegram.triggerHaptic('light');
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                  <span>Official Skill Rules & Guide</span>
                </h3>
                <p className="text-[11px] text-slate-400">P2P competitive mechanics and wagering laws</p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Game Tabs */}
          <div className="px-3 pt-3 pb-2 grid grid-cols-5 gap-1.5 bg-slate-950/30 border-b border-white/5 shrink-0">
            <button
              type="button"
              onClick={() => handleTabChange('bead16')}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                activeTab === 'bead16'
                  ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate">Bead 16</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('draughts')}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                activeTab === 'draughts'
                  ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate">Draughts</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('whot')}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                activeTab === 'whot'
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate">Naija Whot</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('ludo_classic')}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                activeTab === 'ludo_classic'
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              <Dices className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate">Classic Ludo</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('ludo_blitz')}
              className={`py-2 px-1 rounded-xl text-center flex flex-col items-center gap-1 transition-all ${
                activeTab === 'ludo_blitz'
                  ? 'bg-purple-500/20 border border-purple-500/50 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                  : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate">Ludo Blitz</span>
            </button>
          </div>

          {/* Tab Content Body (Scrollable) */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-200">
            {/* 1. DRAUGHTS DUEL (10x10 with Compulsory Eat-Up) */}
            {activeTab === 'draughts' && (
              <div className="space-y-3.5 animate-in fade-in">
                {/* Highlight Banner: Compulsory Capture */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-rose-500/15 to-transparent border border-amber-500/40 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Flame className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Compulsory Capture (Eat-Up) Rule
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    If an opponent's piece can be jumped and captured by any of your pieces,{' '}
                    <strong className="text-amber-300 font-bold">the jump is strictly mandatory</strong>. You{' '}
                    <span className="underline decoration-rose-500 font-semibold">cannot bypass a capture</span> to
                    make a quiet diagonal step. Pieces with mandatory jumps will pulse with an amber ring.
                  </p>
                </div>

                {/* Core Rules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Swords className="w-3.5 h-3.5 text-rose-400" />
                      <span>10x10 Board & 20 Pieces</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Played on a full 100-square grid. Each player commands 20 pieces (Gold vs Crimson) positioned on
                      the 4 dark baseline rows.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Multi-Jump Chaining</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      If your piece makes a capture and can immediately jump another enemy piece from its landing
                      square, you must continue chaining captures in the same turn.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Crown className="w-3.5 h-3.5 text-amber-300" />
                      <span>King Coronation (👑)</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Advancing a draught to the opponent's farthest row (Row 0 for Gold, Row 9 for Crimson) crowns it
                      into a King with bidirectional diagonal movement and flying jumps.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                      <span>Backwards Jumping</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      In 10x10 rules, standard pieces step forward diagonally, but{' '}
                      <strong className="text-white">can jump and capture backwards</strong> over adjacent opponent
                      pieces.
                    </p>
                  </div>
                </div>

                {/* Win Conditions & Timer */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    <span className="text-[11px] text-slate-300">
                      <strong>Victory:</strong> Capture all 20 enemy pieces or block all opponent moves.
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono font-bold shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>15s/turn</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. NAIJA WHOT */}
            {activeTab === 'whot' && (
              <div className="space-y-3.5 animate-in fade-in">
                {/* Overview */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-300">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Objective & Matching</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Empty your hand first to call <strong className="text-amber-300">"Check Up"</strong>. Match cards
                    on the discard pile by <strong className="text-white">Shape</strong> (Circle, Triangle, Cross,
                    Square, Star) or <strong className="text-white">Number</strong> (1–14).
                  </p>
                </div>

                {/* Special Action Cards Cheat-Sheet */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Special Action Cards</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-amber-400">Card 1</span>
                        <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                          Hold On
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">Play again immediately without passing turn.</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-rose-400">Card 2</span>
                        <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                          Pick Two
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">Opponent draws 2 from market (can be defended with a 2).</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-rose-400">Card 5</span>
                        <span className="text-[9px] font-bold bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                          Pick Three
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">Opponent draws 3 from market (defendable with a 5).</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sky-400">Card 8</span>
                        <span className="text-[9px] font-bold bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">
                          Suspension
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">Skips opponent's next turn completely.</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-purple-400">Card 14</span>
                        <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                          Gen Market
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">All opponents must draw 1 penalty card.</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-purple-500/30 space-y-1 bg-purple-950/30">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-purple-300">Card 20</span>
                        <span className="text-[9px] font-bold bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded">
                          WHOT / Wild
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">Plays on any card; declares the next required shape.</p>
                    </div>
                  </div>
                </div>

                {/* Market & Defend notes */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] space-y-1 text-slate-300">
                  <p>
                    🛡️ <strong className="text-white">Defend Penalty:</strong> Counter Pick 2 or Pick 3 attacks by
                    playing the same number to pass the stacked draw to the opponent!
                  </p>
                  <p>
                    🛒 <strong className="text-white">Market Draw:</strong> If you have no matching card, tap the
                    Market deck to draw 1 card.
                  </p>
                </div>
              </div>
            )}

            {/* 3. CLASSIC LUDO */}
            {activeTab === 'ludo_classic' && (
              <div className="space-y-3.5 animate-in fade-in">
                {/* Overview */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Dices className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Classic 15x15 Dice Battle</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Roll the 3D dice, unlock your tokens from the base yard, navigate the full 52-tile circuit, and
                    pilot <strong className="text-emerald-300">4 tokens safely Home</strong> to claim the escrow pot!
                  </p>
                </div>

                {/* Key Ludo Rules */}
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      6
                    </div>
                    <div>
                      <h5 className="font-bold text-white">Opening 6 & Extra Roll</h5>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Roll a 6 to deploy a locked token from your base to your start square. Rolling a 6 also awards an
                        immediate bonus dice roll.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      ⚔️
                    </div>
                    <div>
                      <h5 className="font-bold text-white">Knockout Captures</h5>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Landing exactly on an opponent's token knocks it off the track and sends it all the way back to
                        their base yard!
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold shrink-0 mt-0.5">
                      ⭐
                    </div>
                    <div>
                      <h5 className="font-bold text-white">Safe Star Zones</h5>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Tokens positioned on Globe/Star tiles are shielded in Sanctuary and cannot be captured or
                        knocked out by opponents.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Match format */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-300">
                    <strong>P2P Pace:</strong> First to get 4 tokens into Home wins immediately.
                  </span>
                  <span className="text-[11px] text-emerald-400 font-mono font-bold">20s Clock</span>
                </div>
              </div>
            )}

            {/* 4. LUDO BLITZ */}
            {activeTab === 'ludo_blitz' && (
              <div className="space-y-3.5 animate-in fade-in">
                {/* Overview */}
                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-300">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-xs font-black uppercase tracking-wider">Tactical Card-Driven Ludo</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Eliminate dice luck! In <strong className="text-purple-300">Ludo Blitz</strong>, you are dealt a
                    hand of 3 tactical movement cards. Pick the exact card value each turn to execute pinpoint
                    knockouts and calculate your sprint to Home.
                  </p>
                </div>

                {/* Blitz Mechanics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span>Deterministic Movement</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Choose which card value (1 to 6) to play each turn. New cards replenish automatically from your
                      tactical deck.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Calculated Escapes</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Hold safe-range cards to hop directly into Star safe zones or bypass opponent ambush positions.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Swords className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sniper Knockouts</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Use exact card distances to strike opponent tokens and send them back to base yard without
                      waiting for random rolls.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>High Skill Escrow</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Built for high-stakes wager duels where pure strategy and card management determine the champion.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bead 16 Rules Tab */}
            {activeTab === 'bead16' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-start gap-2.5">
                  <Swords className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <span className="font-bold block text-white">Bead 16 (Sholo Guti) Overview</span>
                    <p className="text-slate-300">
                      A classic 2-player strategic board game played on a 37-node graph with 16 Red vs 16 Blue beads.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">Tactical Rules</h4>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Step Movement</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Slide a bead along connected board lines into any adjacent empty node.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span>Capture Jumps & Chains</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Jump over an adjacent opponent bead along a straight line onto an empty space to capture it. Multiple jumps in a single turn are allowed!
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-white">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Victory Condition</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Capture all 16 opponent beads or trap your opponent so they have 0 valid moves remaining to claim the escrow pot!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Escrow contracts enforce all rules automatically</span>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Got It, Play!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
