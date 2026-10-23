import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveSpectateMatch, SpectatorReaction } from '../types';
import { SpectatorLudoBoard } from '../components/spectator/SpectatorLudoBoard';
import { SpectatorDraughtsBoard } from '../components/spectator/SpectatorDraughtsBoard';
import { SpectatorWhotBoard } from '../components/spectator/SpectatorWhotBoard';
import {
  ArrowLeft,
  ShieldCheck,
  Radio,
  Users,
  Wifi,
  Copy,
  Check,
  Flame,
  Award,
  Clock,
  Sparkles,
  Swords,
} from 'lucide-react';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';

interface SpectatorScreenProps {
  match: LiveSpectateMatch;
  spectatorCount: number;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  latency: number | null;
  reactions: SpectatorReaction[];
  onExit: () => void;
  onSendCheer: (emoji: string) => void;
}

const CHEER_EMOJIS = ['🔥', '👏', '😱', '👑', '🎯', '💯'];

export const SpectatorScreen: React.FC<SpectatorScreenProps> = ({
  match,
  spectatorCount,
  connectionStatus,
  latency,
  reactions,
  onExit,
  onSendCheer,
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  const isWhot = match.gameMode === 'whot';
  const isLudo = match.gameMode === 'ludo_classic' || match.gameMode === 'ludo_blitz';
  const isDraughts = match.gameMode === 'draughts';
  const isBead16 = match.gameMode === 'bead16';

  const handleCopyHash = () => {
    try {
      navigator.clipboard.writeText(match.escrowTxHash);
      setCopiedHash(true);
      telegram.triggerHaptic('light');
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleCheer = (emoji: string) => {
    sound.playClick();
    telegram.triggerHaptic('light');
    onSendCheer(emoji);
  };

  return (
    <div
      id="spectator-screen-root"
      className="flex-1 flex flex-col justify-between bg-slate-950 text-slate-100 select-none pb-4 overflow-hidden relative"
    >
      {/* Floating Spectator Reactions Layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        <AnimatePresence>
          {reactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 30, scale: 0.6, x: Math.random() * 80 - 40 }}
              animate={{ opacity: 1, y: -160, scale: 1.2 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 2.2, ease: 'easeOut' }}
              className="absolute bottom-24 right-8 flex items-center gap-1.5 bg-slate-900/90 border border-white/20 backdrop-blur-md px-3 py-1.5 rounded-full shadow-2xl"
            >
              <span className="text-2xl">{r.emoji}</span>
              <span className="text-[10px] font-bold text-slate-300">@{r.username}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top Header: Spectator Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-lg">
        {/* Left: Exit & Mode badge */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 flex items-center gap-1.5 text-xs font-bold cursor-pointer transition-colors"
            title="Return to Lobby"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Lobby</span>
          </motion.button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold tracking-wider">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>LIVE SPECTATE</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" />
            <span>Read-Only • ₦0 Wager</span>
          </div>
        </div>

        {/* Right: Live Viewers & WebSocket status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-white/10 text-slate-300 text-xs font-bold">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>{spectatorCount}</span>
            <span className="text-[10px] text-slate-400 font-normal hidden xs:inline">watching</span>
          </div>

          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-mono font-bold ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
            title={`WebSocket: ${connectionStatus}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            <Wifi className="w-3 h-3" />
            <span>{latency ? `${latency}ms` : connectionStatus}</span>
          </div>
        </div>
      </div>

      {/* Main Spectator Stage */}
      <div className="flex-1 flex flex-col p-3 max-w-xl mx-auto w-full space-y-3 overflow-y-auto">
        {/* Pot & Escrow Details Bar */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Match Escrow Locked
              </div>
              <div className="text-sm font-black text-amber-400 font-mono tracking-tight">
                ₦{match.pot.toLocaleString()} Pot
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">Stake: ₦{match.stake.toLocaleString()}</span>
              <button
                onClick={handleCopyHash}
                className="text-[9px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer bg-slate-800/80 px-2 py-0.5 rounded border border-white/5"
              >
                <span>{match.escrowTxHash.slice(0, 8)}...</span>
                {copiedHash ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Players Versus Duel Card */}
        <div className="grid grid-cols-2 gap-2 relative bg-slate-900/40 p-2.5 rounded-2xl border border-white/5">
          {/* Player 1 Profile */}
          <div
            className={`p-2 rounded-xl transition-all flex items-center gap-2.5 ${
              match.turn === 'player1'
                ? 'bg-indigo-500/15 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                : 'bg-slate-900/30 border border-transparent'
            }`}
          >
            <div className="relative shrink-0">
              <img
                src={match.player1.avatarUrl}
                alt={match.player1.displayName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-400/80"
              />
              {match.turn === 'player1' && (
                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded-full animate-bounce">
                  TURN
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">@{match.player1.username}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>{match.player1.winRate}% WR</span>
                {match.player1.cardCount !== undefined && (
                  <span className="text-amber-400 font-bold">• {match.player1.cardCount} cards</span>
                )}
              </div>
            </div>
          </div>

          {/* Versus Center Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-950 border border-white/20 flex items-center justify-center text-[9px] font-black text-amber-400 z-10 shadow-lg">
            VS
          </div>

          {/* Player 2 Profile */}
          <div
            className={`p-2 rounded-xl transition-all flex items-center justify-end gap-2.5 text-right ${
              match.turn === 'player2'
                ? 'bg-indigo-500/15 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                : 'bg-slate-900/30 border border-transparent'
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">@{match.player2.username}</div>
              <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                {match.player2.cardCount !== undefined && (
                  <span className="text-amber-400 font-bold">{match.player2.cardCount} cards •</span>
                )}
                <span>{match.player2.winRate}% WR</span>
              </div>
            </div>
            <div className="relative shrink-0">
              <img
                src={match.player2.avatarUrl}
                alt={match.player2.displayName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-rose-400/80"
              />
              {match.turn === 'player2' && (
                <div className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 text-[8px] font-black px-1 rounded-full animate-bounce">
                  TURN
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Action Ticker Banner */}
        <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
            <span className="font-semibold truncate">{match.lastAction}</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 shrink-0">
            <Clock className="w-3 h-3" />
            <span>{match.turnTimeLeft}s</span>
          </div>
        </div>

        {/* Dynamic Game Specific Arena View */}
        {isWhot && match.whotState && (
          <SpectatorWhotBoard
            whotState={match.whotState}
            player1={match.player1}
            player2={match.player2}
            turn={match.turn}
            lastAction={match.lastAction}
          />
        )}

        {/* Ludo Spectator Arena with Authentic 15x15 Board */}
        {isLudo && match.ludoState && (
          <SpectatorLudoBoard
            ludoState={match.ludoState}
            player1={match.player1}
            player2={match.player2}
            turn={match.turn}
            lastAction={match.lastAction}
          />
        )}

        {/* Draughts Spectator Arena with Authentic 10x10 Board */}
        {isDraughts && match.draughtsState && (
          <SpectatorDraughtsBoard
            draughtsState={match.draughtsState}
            player1={match.player1}
            player2={match.player2}
            turn={match.turn}
            lastAction={match.lastAction}
          />
        )}

        {/* Bead 16 Spectator Arena */}
        {isBead16 && (
          <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 text-center space-y-2 shadow-lg">
            <div className="flex items-center justify-center gap-2 text-cyan-400 font-bold text-xs">
              <Swords className="w-4 h-4" />
              <span>BEAD 16 LIVE SPECTATOR DUEL</span>
            </div>
            <p className="text-[11px] text-slate-400">
              16 Red vs 16 Blue bead tactical battle in progress on 37-node Sholo Guti board.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Spectator Cheer Bar & Read-Only Notice */}
      <div className="bg-slate-900/95 backdrop-blur-xl border-t border-white/10 p-3 flex flex-col items-center gap-2 max-w-xl mx-auto w-full">
        {/* Quick Spectator Cheer Reaction Chips */}
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Cheer Match</span>
          </span>

          <div className="flex gap-2">
            {CHEER_EMOJIS.map((emoji) => (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => handleCheer(emoji)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-white/10 flex items-center justify-center text-sm shadow-md cursor-pointer transition-colors"
                title={`Cheer ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Read-Only Guarantee Footer */}
        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Read-only stream over WebSocket. No wagering or game move permissions.</span>
        </div>
      </div>
    </div>
  );
};
