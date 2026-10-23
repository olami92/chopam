import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { GameMode, TurnMode } from '../types';
import {
  X,
  Sparkles,
  Send,
  Swords,
  Dices,
  Layers,
  Trophy,
  Coins,
  AlertCircle,
  ShieldCheck,
  Copy,
  Check,
} from 'lucide-react';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';

interface CreateRoomModalProps {
  onClose: () => void;
  initialGame?: GameMode;
}

const STAKE_PRESETS = [500, 1000, 2500, 5000, 10000];
const MIN_STAKE = 100;

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ onClose, initialGame = 'whot' }) => {
  const { user, startMatch, createTable } = useGame();
  const [selectedGame, setSelectedGame] = useState<GameMode>(initialGame);
  const [turnMode, setTurnMode] = useState<TurnMode>(initialGame === 'ludo_blitz' ? 'fast_blitz' : 'casual');
  const [selectedStake, setSelectedStake] = useState<number>(2500);
  const [stakeInputValue, setStakeInputValue] = useState<string>('2500');
  const [randomId] = useState(() => Math.floor(1000 + Math.random() * 9000));
  
  const getPrefix = (mode: GameMode) => {
    if (mode === 'bead16') return 'BD16';
    if (mode === 'draughts') return 'DRG';
    if (mode === 'ludo_classic' || mode === 'ludo_blitz') return 'LUD';
    return 'WHT';
  };

  const roomCode = `${getPrefix(selectedGame)}-${randomId}`;
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const pot = Math.round((selectedStake || 0) * 1.9);
  const platformFee = Math.round((selectedStake || 0) * 2 * 0.05);

  const gameOptions = [
    { id: 'whot' as GameMode, title: 'Naija Whot', subtitle: 'Nigerian flagship card duel', icon: Layers, badge: 'Popular' },
    { id: 'ludo_classic' as GameMode, title: 'Classic Ludo', subtitle: 'Authentic 3D dice board', icon: Dices, badge: 'Classic' },
    { id: 'ludo_blitz' as GameMode, title: 'Ludo Blitz', subtitle: 'Tactical card-driven movement', icon: Sparkles, badge: 'High Skill' },
    { id: 'draughts' as GameMode, title: 'Draughts Duel', subtitle: '10x10 international draughts', icon: Trophy, badge: 'Pro Stakes' },
    { id: 'bead16' as GameMode, title: 'Bead 16 Tactics', subtitle: '37-node 16 vs 16 bead captures', icon: Swords, badge: 'Tactical' },
  ];

  const MIN_STAKE = 500;

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyFullInvite = () => {
    const gameTitle = gameOptions.find((g) => g.id === selectedGame)?.title || 'Game';
    const text = `🎮 Join my private SkillStake match!\nGame: ${gameTitle}\nStake: ₦${selectedStake.toLocaleString()}\nRoom Code: ${roomCode}\n\nOpen the match: ${telegram.getMatchDeepLink(roomCode)}`;
    navigator.clipboard.writeText(text);
    setCopiedFull(true);
    sound.playClick();
    telegram.triggerHaptic('medium');
    setTimeout(() => setCopiedFull(false), 2500);
  };

  const handleSelectPreset = (amt: number) => {
    setSelectedStake(amt);
    setStakeInputValue(amt.toString());
    sound.playClick();
    telegram.triggerHaptic('light');
  };

  const handleCustomStakeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setStakeInputValue(raw);
    const parsed = parseInt(raw, 10);
    setSelectedStake(isNaN(parsed) ? 0 : parsed);
  };

  const handleQuickAdd = (addAmt: number) => {
    const current = selectedStake || 0;
    const nextVal = current + addAmt;
    setSelectedStake(nextVal);
    setStakeInputValue(nextVal.toString());
    sound.playClick();
    telegram.triggerHaptic('selection');
  };

  const handleMaxStake = () => {
    const max = Math.max(MIN_STAKE, Math.floor(user.availableBalance));
    setSelectedStake(max);
    setStakeInputValue(max.toString());
    sound.playClick();
    telegram.triggerHaptic('medium');
  };

  const isInsufficient = user.availableBalance < selectedStake;
  const isBelowMin = selectedStake < MIN_STAKE;
  const isValidStake = selectedStake >= MIN_STAKE && !isInsufficient;

  const handleCreateAndPlay = () => {
    if (!isValidStake) return;
    sound.playClick();
    try {
      navigator.clipboard.writeText(roomCode);
    } catch {}
    if (createTable) {
      createTable(selectedGame, selectedStake, roomCode, turnMode);
    }
    const success = startMatch(
      selectedGame,
      selectedStake,
      true,
      roomCode,
      undefined,
      false,
      user.username,
      'waiting_for_opponent',
      turnMode
    );
    if (success) {
      onClose();
    }
  };

  const handleShareInvite = () => {
    const gameTitle = gameOptions.find((g) => g.id === selectedGame)?.title || 'Game';
    telegram.shareInvite(roomCode, gameTitle, selectedStake);
    sound.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        id="create-room-modal"
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Create Private Table</h2>
              <p className="text-[11px] text-slate-400">Lock escrow and challenge an opponent</p>
            </div>
          </div>
          <button
            id="close-create-room"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Game Mode Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">Select Arena</label>
          <div className="grid grid-cols-2 gap-2">
            {gameOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedGame === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  onClick={() => {
                    setSelectedGame(opt.id);
                    sound.playClick();
                  }}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/15 ring-1 ring-amber-400/40'
                      : 'bg-slate-800/60 border-white/5 text-slate-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-5 h-5 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-amber-300">
                      {opt.badge}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">{opt.title}</h4>
                    <p className="text-[10px] text-slate-400 truncate">{opt.subtitle}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Stake Configuration (Presets + Custom Input) */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">Turn Timer</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'casual' as TurnMode, title: 'Casual', detail: '1 hour per turn' },
              { id: 'fast_blitz' as TurnMode, title: 'Fast Blitz', detail: '45 seconds per turn' },
            ]).map((option) => (
              <button key={option.id} type="button" onClick={() => setTurnMode(option.id)}
                className={`rounded-xl border p-3 text-left ${turnMode === option.id ? 'border-amber-400 bg-amber-500/15 text-white' : 'border-white/10 bg-slate-800/60 text-slate-300'}`}>
                <span className="block text-xs font-bold">{option.title}</span>
                <span className="block text-[10px] text-slate-400">{option.detail}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stake Configuration (Presets + Custom Input) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Stake Amount</span>
            </label>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span>Balance:</span>
              <span className="text-emerald-400 font-bold font-mono">₦{user.availableBalance.toLocaleString()}</span>
              <button
                type="button"
                id="btn-stake-max"
                onClick={handleMaxStake}
                className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 cursor-pointer"
                title="Stake all available funds"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-5 gap-1.5">
            {STAKE_PRESETS.map((amt) => {
              const isSelected = selectedStake === amt;
              return (
                <motion.button
                  key={amt}
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  onClick={() => handleSelectPreset(amt)}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/70 border-white/5 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  ₦{(amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1)}k
                </motion.button>
              );
            })}
          </div>

          {/* Custom Stake Amount Input Box */}
          <div className="space-y-1.5">
            <div className="relative flex items-center">
              <span className="absolute left-3 text-base font-black text-amber-400 select-none">
                ₦
              </span>
              <input
                id="input-custom-stake"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={stakeInputValue}
                onChange={handleCustomStakeChange}
                placeholder="Enter custom stake (e.g. 3500)"
                className="w-full bg-slate-950/80 border border-white/10 focus:border-amber-500 rounded-xl py-2.5 pl-8 pr-28 text-white font-mono font-bold text-sm tracking-wide focus:outline-none transition-colors"
              />
              <div className="absolute right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(500)}
                  className="px-1.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(1000)}
                  className="px-1.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer"
                >
                  +1k
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(5000)}
                  className="px-1.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-bold border border-white/5 cursor-pointer"
                >
                  +5k
                </button>
              </div>
            </div>

            {/* Live Pot & Escrow Breakdown */}
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Estimated Winner Pot</span>
                <span className="text-emerald-400 font-bold font-mono text-xs">
                  ₦{pot.toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px]">Gate Fee</span>
                <span className="text-slate-300 font-mono">
                  ₦{platformFee.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Code Pill & Copy Options */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Private Room Code
              </span>
              <span className="text-base font-mono font-black text-amber-400 tracking-wider">
                {roomCode}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                id="btn-copy-room-code"
                onClick={handleCopyRoomCode}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
              </button>
              <button
                type="button"
                onClick={handleShareInvite}
                title="Share via Telegram"
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-xs font-semibold border border-sky-500/30 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Telegram</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            id="btn-copy-full-invite"
            onClick={handleCopyFullInvite}
            className="w-full text-center text-[10px] font-medium text-slate-400 hover:text-amber-300 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            {copiedFull ? '✓ Full Invite Message Copied to Clipboard!' : '📋 Copy Full Invite Text (WhatsApp / SMS / Any App)'}
          </button>
        </div>

        {/* Validation Warnings */}
        {isBelowMin && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Minimum stake amount is ₦{MIN_STAKE.toLocaleString()}</span>
          </div>
        )}

        {isInsufficient && !isBelowMin && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Insufficient balance (₦{user.availableBalance.toLocaleString()} available). Please deposit.</span>
          </div>
        )}

        {/* Action Button */}
        <motion.button
          id="btn-start-table"
          disabled={!isValidStake}
          whileHover={{ scale: isValidStake ? 1.02 : 1 }}
          whileTap={{ scale: isValidStake ? 0.97 : 1 }}
          onClick={handleCreateAndPlay}
          className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <span>
            {isValidStake
              ? `Lock ₦${selectedStake.toLocaleString()} & Launch Table`
              : isBelowMin
              ? `Enter At Least ₦${MIN_STAKE}`
              : `Insufficient Balance`}
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
};

