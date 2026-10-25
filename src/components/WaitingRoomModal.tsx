import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { Copy, Check, Share2, Swords, X, Loader2, ShieldCheck, Flame, AlertCircle } from 'lucide-react';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';

export const WaitingRoomModal: React.FC = () => {
  const { activeMatch, cancelMatch, user } = useGame();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!activeMatch) return null;

  const gameModeTitles: Record<string, string> = {
    whot: 'Naija Whot! Pro',
    ludo_classic: 'Classic Ludo Master',
    ludo_blitz: 'Ludo Blitz Fast-Track',
    draughts: '10x10 International Draughts',
  };

  const gameTitle = gameModeTitles[activeMatch.gameMode] || 'Tete Arena Match';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeMatch.roomCode);
    setCopiedCode(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShareTelegram = () => {
    sound.playClick();
    telegram.shareInvite(activeMatch.roomCode, gameTitle, activeMatch.stake);
  };

  const handleCopyInviteLink = () => {
    const inviteText = `🎮 Join my ${gameTitle} wager match on Tete Arena!\nStake: ₦${activeMatch.stake.toLocaleString()} | Pot: ₦${activeMatch.pot.toLocaleString()}\nRoom Code: ${activeMatch.roomCode}\n\nEnter code ${activeMatch.roomCode} in Tete Arena to play against @${user.username}!`;
    navigator.clipboard.writeText(inviteText);
    setCopiedLink(true);
    sound.playClick();
    telegram.triggerHaptic('medium');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCancel = () => {
    sound.playClick();
    telegram.triggerHaptic('warning');
    cancelMatch();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md select-none">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 15 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="w-full max-w-md bg-slate-900/95 border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-slate-100 relative overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-20 -left-20 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white leading-tight">Private Duel Waiting Room</h2>
              <span className="text-xs font-semibold text-amber-400">{gameTitle}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCancel}
            title="Cancel Table"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stake & Pot Escrow Summary */}
        <div className="grid grid-cols-2 gap-3 bg-slate-950/80 border border-white/5 p-3.5 rounded-2xl">
          <div className="flex flex-col items-center justify-center border-r border-white/10 pr-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Match Stake</span>
            <span className="text-base font-black text-white">₦{activeMatch.stake.toLocaleString()}</span>
          </div>
          <div className="flex flex-col items-center justify-center pl-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Winner Takes Pot</span>
            <span className="text-base font-black text-amber-400">₦{activeMatch.pot.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-cyan-500/5 px-3 py-2 text-[11px]">
          <span className="font-bold text-cyan-200">{activeMatch.turnMode === 'async' ? 'Async match' : 'Live match'}</span>
          <span className="text-slate-400">{activeMatch.turnMode === 'async' ? '1 hour per turn' : '60 seconds per turn'}</span>
        </div>

        {/* Escrow Status Banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <p className="text-[11px] leading-tight">
            Stake is held in your vault. <strong>No escrow deduction occurs</strong> until an opponent enters the room code and joins!
          </p>
        </div>

        {/* Room Code Showcase */}
        <div className="flex flex-col gap-2 bg-slate-950/90 border border-amber-500/30 p-4 rounded-2xl text-center shadow-inner relative">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Share Room Code With Opponent</span>
          <div className="flex items-center justify-center gap-3 py-1">
            <span className="text-2xl font-black font-mono tracking-widest text-amber-300 drop-shadow-md">
              {activeMatch.roomCode}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-400">Opponent can enter this code in the Lobby search bar</span>
        </div>

        {/* Action Share Buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleShareTelegram}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer transition-transform active:scale-98"
          >
            <Share2 className="w-4 h-4" />
            <span>Send Telegram Challenge Invite</span>
          </button>

          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-white/10 cursor-pointer transition-colors"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            <span>{copiedLink ? 'Full Invite Copied to Clipboard!' : 'Copy Full Invite Text'}</span>
          </button>
        </div>

        {/* Pulsing Status Radar */}
        <div className="flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-2xl bg-slate-950 border border-white/10">
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
          <span className="text-xs font-bold text-slate-200 animate-pulse">
            Waiting for opponent to enter room code...
          </span>
        </div>

        {/* Footer Cancel Action */}
        <div className="pt-1 text-center">
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline underline-offset-4 cursor-pointer transition-colors"
          >
            Cancel Table & Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
