import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { ShieldCheck, Share2, LogOut, Copy, Check, BookOpen } from 'lucide-react';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';
import { GameRulesModal } from './GameRulesModal';
import { LiveVoiceChatWidget } from './LiveVoiceChatWidget';

interface EscrowBannerProps {
  gameTitle: string;
}

export const EscrowBanner: React.FC<EscrowBannerProps> = ({ gameTitle }) => {
  const { activeMatch, forfeitMatch } = useGame();
  const [copied, setCopied] = useState(false);
  const [showConfirmQuit, setShowConfirmQuit] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  if (!activeMatch) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeMatch.roomCode);
    setCopied(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    telegram.shareInvite(activeMatch.roomCode, gameTitle, activeMatch.stake);
    sound.playClick();
  };

  const handleSurrender = () => {
    sound.playClick();
    setShowConfirmQuit(false);
    forfeitMatch();
  };

  const handleOpenRules = () => {
    sound.playClick();
    telegram.triggerHaptic('selection');
    setShowRulesModal(true);
  };

  return (
    <>
      <div
        id="in-game-escrow-banner"
        className="w-full bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-md"
      >
        {/* Left: Escrow & Pot info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
            {activeMatch.status === 'completed' ? (
              <>
                <Check className="w-3 h-3" />
                <span>{activeMatch.coinMatchId ? 'TETE COINS SETTLED' : 'ESCROW SETTLED'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3" />
                <span>{activeMatch.coinMatchId ? 'TETE COINS STAKED' : 'ESCROW LOCKED'}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 min-w-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Pot:</span>
            <span className="text-xs font-black text-amber-500 tracking-tight">
              {activeMatch.coinMatchId ? `◉ ${activeMatch.pot.toLocaleString()}` : `₦${activeMatch.pot.toLocaleString()}`}
            </span>
          </div>
        </div>

        {/* Right: Rules, Room & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleOpenRules}
            title="View Game Rules & Mechanics"
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold border border-amber-500/30 shadow-sm cursor-pointer transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline">Rules</span>
          </button>

          <button
            onClick={handleCopyCode}
            title="Copy Room Code"
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-[10px] font-mono text-slate-300 border border-white/10 cursor-pointer"
          >
            <span>{activeMatch.roomCode}</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
          </button>

          {!activeMatch.coinMatchId && <button
            onClick={handleShare}
            title="Invite Telegram Friend"
            className="p-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>}

          <button
            onClick={() => setShowConfirmQuit(true)}
            title="Leave Match"
            className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live WebRTC P2P Voice Chat Bar */}
      <LiveVoiceChatWidget />

      {/* Game Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        initialMode={activeMatch.gameMode}
      />

      {/* Forfeit Confirm Modal */}
      {showConfirmQuit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs bg-slate-900 border border-rose-500/30 rounded-2xl p-4 text-center space-y-3">
            <h3 className="text-sm font-bold text-white">Forfeit Match?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeMatch.coinMatchId
                ? `Exiting will forfeit your ${activeMatch.stake.toLocaleString()} Tete Coin stake.`
                : `Exiting will forfeit your ₦${activeMatch.stake.toLocaleString()} escrow stake to the opponent.`}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowConfirmQuit(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                Continue Play
              </button>
              <button
                onClick={handleSurrender}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white hover:bg-rose-500"
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
