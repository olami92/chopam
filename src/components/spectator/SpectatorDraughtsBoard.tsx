import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DraughtsPiece, LiveMatchPlayer } from '../../types';
import { Crown, Radio, Shield, Zap } from 'lucide-react';

interface SpectatorDraughtsBoardProps {
  draughtsState: {
    currentTurnColor: 'gold' | 'crimson';
    pieces: DraughtsPiece[];
    capturedGold: number;
    capturedCrimson: number;
    lastMove?: {
      fromRow: number;
      fromCol: number;
      toRow: number;
      toCol: number;
      pieceId: string;
      captured?: boolean;
    };
  };
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
  turn: 'player1' | 'player2';
  lastAction: string;
}

export const SpectatorDraughtsBoard: React.FC<SpectatorDraughtsBoardProps> = ({
  draughtsState,
  player1,
  player2,
  turn,
  lastAction,
}) => {
  const { pieces, capturedGold, capturedCrimson, lastMove } = draughtsState;

  // Algebraic rank and file labels for 10x10
  const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const ranks = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'];

  const goldPiecesCount = pieces.filter((p) => p.color === 'gold').length;
  const crimsonPiecesCount = pieces.filter((p) => p.color === 'crimson').length;

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
          <Radio className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
          <span>{lastAction}</span>
        </p>
      </motion.div>

      {/* 10x10 Draughts Board */}
      <div className="relative w-full max-w-[360px] sm:max-w-[390px] aspect-square p-2 bg-[#1a0f07] border-4 border-amber-950/80 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-center">
        {/* Board Grid */}
        <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[1px] bg-amber-950/60 rounded-xl overflow-hidden p-0.5 border border-amber-800/40">
          {Array.from({ length: 10 }).map((_, r) =>
            Array.from({ length: 10 }).map((__, c) => {
              const isDarkTile = (r + c) % 2 === 1;
              const piece = pieces.find((p) => p.row === r && p.col === c);
              const isLastMoveFrom = lastMove?.fromRow === r && lastMove?.fromCol === c;
              const isLastMoveTo = lastMove?.toRow === r && lastMove?.toCol === c;

              return (
                <div
                  key={`tile-${r}-${c}`}
                  className={`relative flex items-center justify-center transition-colors ${
                    isDarkTile ? 'bg-[#15202b]' : 'bg-[#e2d5be]/15'
                  } ${
                    isLastMoveFrom
                      ? 'ring-1 ring-amber-500/50 bg-amber-950/30'
                      : isLastMoveTo
                      ? 'ring-2 ring-emerald-400 bg-emerald-950/40'
                      : ''
                  }`}
                >
                  {/* File/Rank subtle notation on perimeter */}
                  {c === 0 && (
                    <span className="absolute top-0.5 left-0.5 text-[6px] font-mono text-slate-400/40 pointer-events-none select-none">
                      {ranks[r]}
                    </span>
                  )}
                  {r === 9 && (
                    <span className="absolute bottom-0.5 right-0.5 text-[6px] font-mono text-slate-400/40 pointer-events-none select-none">
                      {files[c]}
                    </span>
                  )}

                  {/* Destination Jump Trail Ping */}
                  {isLastMoveTo && (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 1.4, opacity: 0 }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="absolute inset-1 rounded-full border-2 border-emerald-400 pointer-events-none"
                    />
                  )}

                  {/* Render Piece with Layout Transition */}
                  {piece && (
                    <motion.div
                      layout
                      layoutId={piece.id}
                      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border shadow-lg z-10 select-none ${
                        piece.color === 'gold'
                          ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-amber-200 text-slate-950'
                          : 'bg-gradient-to-br from-rose-500 via-rose-700 to-rose-950 border-rose-300 text-white'
                      } ${
                        lastMove?.pieceId === piece.id
                          ? 'ring-2 ring-white shadow-[0_0_14px_rgba(245,158,11,0.8)] scale-105'
                          : ''
                      }`}
                    >
                      {piece.isKing ? (
                        <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                      ) : (
                        <div
                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-black/20 ${
                            piece.color === 'gold' ? 'bg-amber-200' : 'bg-rose-400'
                          }`}
                        />
                      )}
                    </motion.div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Piece Telemetry & Graveyard Box */}
      <div className="w-full max-w-[360px] bg-slate-900/80 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-md">
        {/* Player 1 (Gold) */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-amber-200" />
            <span className="text-xs font-bold text-amber-300 truncate max-w-[90px]">
              {player1.displayName}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
            <span>Active: <strong className="text-amber-400">{goldPiecesCount}</strong></span>
            <span>Takes: <strong className="text-emerald-400">{capturedCrimson}/20</strong></span>
          </div>
        </div>

        {/* Center Versus Indicator */}
        <div className="px-2 py-1 bg-slate-800 rounded-lg border border-white/10 text-center">
          <span className="text-[9px] font-bold text-slate-400 block uppercase">
            {turn === 'player1' ? 'Gold Turn' : 'Crimson Turn'}
          </span>
          <div className="flex items-center justify-center gap-1 text-[10px] font-black text-amber-400">
            <span>10x10</span>
          </div>
        </div>

        {/* Player 2 (Crimson) */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs font-bold text-rose-300 truncate max-w-[90px]">
              {player2.displayName}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-rose-300" />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-end gap-2 font-mono">
            <span>Takes: <strong className="text-emerald-400">{capturedGold}/20</strong></span>
            <span>Active: <strong className="text-rose-400">{crimsonPiecesCount}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
