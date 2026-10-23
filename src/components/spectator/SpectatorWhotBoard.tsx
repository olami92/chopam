import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveMatchPlayer, WhotCard, WhotShape } from '../../types';
import { Radio, Eye, EyeOff, Sparkles, Layers, ShieldAlert } from 'lucide-react';

interface SpectatorWhotBoardProps {
  whotState: {
    currentShape: WhotShape;
    currentNumber: number | null;
    topCard: WhotCard;
    discardCount: number;
    marketDeckCount: number;
    player1Cards: WhotCard[];
    player2Cards: WhotCard[];
    pendingPenalty?: { type: number; count: number } | null;
  };
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
  turn: 'player1' | 'player2';
  lastAction: string;
}

export const SpectatorWhotBoard: React.FC<SpectatorWhotBoardProps> = ({
  whotState,
  player1,
  player2,
  turn,
  lastAction,
}) => {
  const [showHands, setShowHands] = useState(true);
  const {
    topCard,
    currentShape,
    currentNumber,
    discardCount,
    marketDeckCount,
    player1Cards,
    player2Cards,
    pendingPenalty,
  } = whotState;

  // Render Whot Shape Graphic
  const renderShapeIcon = (shape: WhotShape, sizeClass = 'w-6 h-6') => {
    switch (shape) {
      case 'circle':
        return (
          <div className={`${sizeClass} rounded-full bg-rose-500 ring-2 ring-rose-300 shadow-sm`} />
        );
      case 'triangle':
        return (
          <div
            className={`${sizeClass} flex items-center justify-center text-amber-400 font-black text-lg`}
          >
            ▲
          </div>
        );
      case 'cross':
        return (
          <div
            className={`${sizeClass} flex items-center justify-center text-emerald-400 font-black text-xl`}
          >
            ✚
          </div>
        );
      case 'square':
        return (
          <div className={`${sizeClass} rounded-md bg-sky-500 ring-2 ring-sky-300 shadow-sm`} />
        );
      case 'star':
        return (
          <div
            className={`${sizeClass} flex items-center justify-center text-amber-300 font-black text-xl`}
          >
            ★
          </div>
        );
      case 'whot':
      default:
        return (
          <div className={`${sizeClass} flex items-center justify-center font-black text-xs text-fuchsia-400`}>
            WHOT
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      {/* Narration Strip */}
      <motion.div
        key={lastAction}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full py-1 px-3 rounded-full bg-slate-900/90 border border-white/10 text-center shadow-sm"
      >
        <p className="text-xs font-semibold text-slate-200 truncate flex items-center justify-center gap-1.5">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse shrink-0" />
          <span>{lastAction}</span>
        </p>
      </motion.div>

      {/* Opponent (Player 2) Top Card Hand Ribbon */}
      <div className="w-full max-w-[350px] bg-slate-900/70 border border-white/5 rounded-xl p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-300">{player2.displayName}</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
            {player2Cards.length} cards
          </span>
        </div>

        {/* Hand Cards Preview */}
        <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
          {player2Cards.slice(0, 6).map((card, i) => (
            <div
              key={card.id || i}
              className={`w-7 h-10 rounded-md border shadow-sm flex flex-col items-center justify-center transition-transform hover:-translate-y-1 ${
                showHands
                  ? 'bg-slate-800 border-white/20 text-[10px] font-bold text-white'
                  : 'bg-gradient-to-br from-indigo-900 to-slate-950 border-indigo-500/30'
              }`}
            >
              {showHands ? (
                <>
                  <span className="text-[9px] font-mono leading-none">{card.number}</span>
                  <div className="scale-60 my-0.5">{renderShapeIcon(card.shape, 'w-3 h-3')}</div>
                </>
              ) : (
                <span className="text-[8px] text-indigo-400/60 font-mono">W</span>
              )}
            </div>
          ))}
          {player2Cards.length > 6 && (
            <span className="text-[9px] text-slate-400 pl-2">+{player2Cards.length - 6}</span>
          )}
        </div>
      </div>

      {/* Center Whot Table Felt Arena */}
      <div className="relative w-full max-w-[350px] aspect-[4/3] p-4 bg-gradient-to-b from-[#0b331f] via-[#062414] to-[#041a0e] border-4 border-emerald-900/60 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-around overflow-hidden">
        {/* Subtle Felt Texture Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Market Card Pile */}
        <div className="relative flex flex-col items-center select-none">
          <div className="relative w-18 h-26 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-400/40 rounded-xl shadow-2xl flex flex-col items-center justify-center rotate-[-3deg]">
            {/* Stack effect shadows */}
            <div className="absolute -bottom-1 -right-1 w-full h-full bg-slate-950/80 rounded-xl -z-10" />
            <div className="absolute -bottom-2 -right-2 w-full h-full bg-slate-950/60 rounded-xl -z-20" />

            <span className="text-[10px] font-mono font-black text-indigo-300 tracking-wider">
              WHOT
            </span>
            <span className="text-[9px] font-mono text-indigo-400/80 mt-1">MARKET</span>
            <div className="mt-1 flex items-center gap-1 bg-slate-950/80 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-amber-300 border border-white/10">
              <Layers className="w-2.5 h-2.5 text-amber-400" />
              <span>{marketDeckCount}</span>
            </div>
          </div>
        </div>

        {/* Active Discard Pile with Current Top Card */}
        <div className="relative flex flex-col items-center select-none">
          {/* Active Discard Stack Background */}
          <div className="absolute w-20 h-28 bg-slate-950/50 rounded-xl border border-white/5 rotate-3 -z-10" />

          <AnimatePresence mode="popLayout">
            <motion.div
              key={topCard.id || `${topCard.shape}-${topCard.number}`}
              initial={{ scale: 0.8, y: -20, rotate: -8, opacity: 0 }}
              animate={{ scale: 1, y: 0, rotate: 2, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="relative w-20 h-28 bg-gradient-to-br from-white via-slate-50 to-slate-200 border-2 border-slate-300 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.6)] flex flex-col justify-between p-2 text-slate-900"
            >
              {/* Corner Number */}
              <div className="flex items-center justify-between">
                <span className="font-mono font-black text-xs leading-none">
                  {topCard.number}
                </span>
                <div className="scale-75">{renderShapeIcon(topCard.shape, 'w-3.5 h-3.5')}</div>
              </div>

              {/* Main Center Shape / WHOT 20 */}
              <div className="my-auto flex flex-col items-center justify-center">
                {topCard.shape === 'whot' ? (
                  <div className="text-center">
                    <span className="font-black text-base text-fuchsia-600 block leading-tight font-mono">
                      WHOT
                    </span>
                    <span className="text-[10px] font-black text-amber-600 font-mono">20</span>
                  </div>
                ) : (
                  <div className="transform hover:scale-110 transition-transform">
                    {renderShapeIcon(topCard.shape, 'w-7 h-7')}
                  </div>
                )}
              </div>

              {/* Inverted Corner Number */}
              <div className="flex items-center justify-between rotate-180">
                <span className="font-mono font-black text-xs leading-none">
                  {topCard.number}
                </span>
                <div className="scale-75">{renderShapeIcon(topCard.shape, 'w-3.5 h-3.5')}</div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Current Calling Shape Badge */}
          <div className="mt-2 flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded-full border border-white/10 text-[9px] font-bold text-slate-200">
            <span className="text-slate-400">Match:</span>
            <div className="scale-75">{renderShapeIcon(currentShape, 'w-3 h-3')}</div>
            <span className="uppercase text-emerald-400">{currentShape}</span>
            {currentNumber && <span>({currentNumber})</span>}
          </div>
        </div>
      </div>

      {/* Pending Penalty Alert (Pick 2 / Pick 3 / General Market) */}
      {pendingPenalty && pendingPenalty.count > 0 && (
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="w-full max-w-[350px] bg-rose-500/20 border border-rose-500/40 rounded-xl px-3 py-1.5 flex items-center justify-between text-rose-300 text-xs font-bold"
        >
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>PICK {pendingPenalty.count} DEFENSE ACTIVE!</span>
          </div>
          <span className="text-[10px] font-mono bg-rose-500/30 px-2 py-0.5 rounded text-rose-200">
            +{pendingPenalty.count} CARDS
          </span>
        </motion.div>
      )}

      {/* Player 1 (Bottom) Hand Ribbon & View Toggle */}
      <div className="w-full max-w-[350px] bg-slate-900/70 border border-white/5 rounded-xl p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-300">{player1.displayName}</span>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
            {player1Cards.length} cards
          </span>
        </div>

        {/* Hand Cards Preview */}
        <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
          {player1Cards.slice(0, 6).map((card, i) => (
            <div
              key={card.id || i}
              className={`w-7 h-10 rounded-md border shadow-sm flex flex-col items-center justify-center transition-transform hover:-translate-y-1 ${
                showHands
                  ? 'bg-slate-800 border-white/20 text-[10px] font-bold text-white'
                  : 'bg-gradient-to-br from-indigo-900 to-slate-950 border-indigo-500/30'
              }`}
            >
              {showHands ? (
                <>
                  <span className="text-[9px] font-mono leading-none">{card.number}</span>
                  <div className="scale-60 my-0.5">{renderShapeIcon(card.shape, 'w-3 h-3')}</div>
                </>
              ) : (
                <span className="text-[8px] text-indigo-400/60 font-mono">W</span>
              )}
            </div>
          ))}
          {player1Cards.length > 6 && (
            <span className="text-[9px] text-slate-400 pl-2">+{player1Cards.length - 6}</span>
          )}
        </div>

        {/* Toggle Hands Visibility */}
        <button
          onClick={() => setShowHands((prev) => !prev)}
          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-[10px] flex items-center gap-1 cursor-pointer"
          title="Toggle hand cards reveal"
        >
          {showHands ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};
