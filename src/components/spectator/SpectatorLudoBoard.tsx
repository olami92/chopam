import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LiveMatchPlayer, LudoToken } from '../../types';
import { Ludo3DPawn } from '../Ludo3DPawn';
import {
  useLudoGame,
  LUDO_TRACK_COORDS,
  RED_HOME_STRETCH,
  YELLOW_HOME_STRETCH,
  RED_BASE_COORDS,
  YELLOW_BASE_COORDS,
  SAFE_TRACK_INDICES,
} from '../../hooks/useLudoGame';
import { Star, Target, Dices, Crown, Radio, Sparkles } from 'lucide-react';

interface SpectatorLudoBoardProps {
  ludoState: {
    currentTurnColor: 'red' | 'yellow';
    diceValue: number;
    player1Tokens: LudoToken[];
    player2Tokens: LudoToken[];
    lastRollText?: string;
    lastMovedTokenId?: string;
    isRolling?: boolean;
  };
  player1: LiveMatchPlayer;
  player2: LiveMatchPlayer;
  turn: 'player1' | 'player2';
  lastAction: string;
}

export const SpectatorLudoBoard: React.FC<SpectatorLudoBoardProps> = ({
  ludoState,
  player1,
  player2,
  turn,
  lastAction,
}) => {
  const { player1Tokens, player2Tokens, diceValue, lastMovedTokenId } = ludoState;

  // Track safe stars
  const isStarCell = (r: number, c: number) => {
    return (
      (r === 6 && c === 1) ||
      (r === 8 && c === 13) ||
      (r === 2 && c === 8) ||
      (r === 12 && c === 6)
    );
  };

  // Helper to find all tokens sitting on cell (r, c)
  const getTokensAtCell = (r: number, c: number) => {
    const tokens: { id: string; color: 'red' | 'yellow'; label: string; isRecent: boolean }[] = [];

    // 1. Check bases
    RED_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const pt = player1Tokens.find((t) => t.index === idx && t.step === -1);
        if (pt) {
          tokens.push({
            id: pt.id,
            color: 'red',
            label: `${idx + 1}`,
            isRecent: pt.id === lastMovedTokenId,
          });
        }
      }
    });

    YELLOW_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const ot = player2Tokens.find((t) => t.index === idx && t.step === -1);
        if (ot) {
          tokens.push({
            id: ot.id,
            color: 'yellow',
            label: `${idx + 1}`,
            isRecent: ot.id === lastMovedTokenId,
          });
        }
      }
    });

    // 2. Check track (52 coordinates)
    LUDO_TRACK_COORDS.forEach((coord, trackIdx) => {
      if (coord[0] === r && coord[1] === c) {
        // Red track step 0..50 is trackIdx
        player1Tokens.forEach((pt) => {
          if (pt.step >= 0 && pt.step <= 50 && pt.step % 52 === trackIdx) {
            tokens.push({
              id: pt.id,
              color: 'red',
              label: `${pt.index + 1}`,
              isRecent: pt.id === lastMovedTokenId,
            });
          }
        });

        // Yellow track: starts at 26
        player2Tokens.forEach((ot) => {
          if (ot.step >= 0 && ot.step <= 50 && (26 + ot.step) % 52 === trackIdx) {
            tokens.push({
              id: ot.id,
              color: 'yellow',
              label: `${ot.index + 1}`,
              isRecent: ot.id === lastMovedTokenId,
            });
          }
        });
      }
    });

    // 3. Check home stretch (steps 51 to 55; tokens at step >= 56 are won and counted in Home HUD)
    RED_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        player1Tokens.forEach((pt) => {
          if (pt.step === 51 + stretchIdx && pt.step < 56) {
            tokens.push({
              id: pt.id,
              color: 'red',
              label: `${pt.index + 1}`,
              isRecent: pt.id === lastMovedTokenId,
            });
          }
        });
      }
    });

    YELLOW_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        player2Tokens.forEach((ot) => {
          if (ot.step === 51 + stretchIdx && ot.step < 56) {
            tokens.push({
              id: ot.id,
              color: 'yellow',
              label: `${ot.index + 1}`,
              isRecent: ot.id === lastMovedTokenId,
            });
          }
        });
      }
    });

    return tokens;
  };

  // Cell Background Styling for authentic Ludo board
  const getCellClassName = (r: number, c: number) => {
    // Non-playable inner corner cells adjacent to the center home cross: (6,6), (6,8), (8,6), (8,8)
    // Colored black so tokens turning from arm-to-arm visibly bypass these non-walkable dead zones
    if ((r === 6 && c === 6) || (r === 6 && c === 8) || (r === 8 && c === 6) || (r === 8 && c === 8)) {
      return 'bg-black border border-slate-900';
    }

    // 1. Red Base (Top-Left 6x6)
    if (r < 6 && c < 6) {
      if (r >= 1 && r <= 4 && c >= 1 && c <= 4) {
        const isTargetSpot = (r === 2 && c === 2) || (r === 2 && c === 3) || (r === 3 && c === 2) || (r === 3 && c === 3);
        if (isTargetSpot) return 'bg-red-50 border-2 border-red-500/60 rounded-full shadow-inner';
        return 'bg-white border-slate-200';
      }
      return 'bg-[#dc2626] border border-red-700/60';
    }

    // 2. Green Base (Top-Right 6x6)
    if (r < 6 && c > 8) {
      if (r >= 1 && r <= 4 && c >= 10 && c <= 13) {
        const isTargetSpot = (r === 2 && c === 11) || (r === 2 && c === 12) || (r === 3 && c === 11) || (r === 3 && c === 12);
        if (isTargetSpot) return 'bg-emerald-50 border-2 border-emerald-500/60 rounded-full shadow-inner';
        return 'bg-white border-slate-200';
      }
      return 'bg-[#059669] border border-emerald-700/60';
    }

    // 3. Blue Base (Bottom-Left 6x6)
    if (r > 8 && c < 6) {
      if (r >= 10 && r <= 13 && c >= 1 && c <= 4) {
        const isTargetSpot = (r === 11 && c === 2) || (r === 11 && c === 3) || (r === 12 && c === 2) || (r === 12 && c === 3);
        if (isTargetSpot) return 'bg-blue-50 border-2 border-blue-500/60 rounded-full shadow-inner';
        return 'bg-white border-slate-200';
      }
      return 'bg-[#2563eb] border border-blue-700/60';
    }

    // 4. Yellow Base (Bottom-Right 6x6)
    if (r > 8 && c > 8) {
      if (r >= 10 && r <= 13 && c >= 10 && c <= 13) {
        const isTargetSpot = (r === 11 && c === 11) || (r === 11 && c === 12) || (r === 12 && c === 11) || (r === 12 && c === 12);
        if (isTargetSpot) return 'bg-amber-50 border-2 border-amber-500/60 rounded-full shadow-inner';
        return 'bg-white border-slate-200';
      }
      return 'bg-[#eab308] border border-amber-600/60';
    }

    // Center Home (7,7)
    if (r === 7 && c === 7) return 'bg-[#18181b]';

    // Home Stretches
    if (r === 7 && c >= 1 && c <= 6) return 'bg-[#dc2626] border border-red-700/50';
    if (r === 7 && c >= 8 && c <= 13) return 'bg-[#eab308] border border-amber-600/50';
    if (c === 7 && r >= 1 && r <= 6) return 'bg-[#059669] border border-emerald-700/50';
    if (c === 7 && r >= 8 && r <= 13) return 'bg-[#2563eb] border border-blue-700/50';

    // Start Squares & Arrows
    if (r === 6 && c === 1) return 'bg-[#dc2626] border border-red-700/80';
    if (r === 8 && c === 13) return 'bg-[#eab308] border border-amber-600/80';
    if (r === 1 && c === 8) return 'bg-[#059669] border border-emerald-700/80';
    if (r === 13 && c === 6) return 'bg-[#2563eb] border border-blue-700/80';

    // Neutral crisp white track squares
    return 'bg-white border border-slate-300/90';
  };

  // Stats calculation
  const p1HomeCount = player1Tokens.filter((t) => t.step >= 56).length;
  const p1TrackCount = player1Tokens.filter((t) => t.step >= 0 && t.step < 56).length;
  const p1BaseCount = player1Tokens.filter((t) => t.step === -1).length;

  const p2HomeCount = player2Tokens.filter((t) => t.step >= 56).length;
  const p2TrackCount = player2Tokens.filter((t) => t.step >= 0 && t.step < 56).length;
  const p2BaseCount = player2Tokens.filter((t) => t.step === -1).length;

  // Dice Pip Rendering Helper
  const renderDicePips = (val: number) => {
    switch (val) {
      case 1:
        return <div className="w-2.5 h-2.5 rounded-full bg-slate-900 mx-auto my-auto" />;
      case 2:
        return (
          <div className="w-full h-full flex justify-between p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 self-start" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 self-end" />
          </div>
        );
      case 3:
        return (
          <div className="w-full h-full flex justify-between p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 self-start" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 self-center" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 self-end" />
          </div>
        );
      case 4:
        return (
          <div className="w-full h-full grid grid-cols-2 gap-1 p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 justify-self-end" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 justify-self-end" />
          </div>
        );
      case 5:
        return (
          <div className="w-full h-full relative p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute top-1 left-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute top-1 right-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute bottom-1 left-1" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 absolute bottom-1 right-1" />
          </div>
        );
      case 6:
      default:
        return (
          <div className="w-full h-full grid grid-cols-2 gap-0.5 p-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 justify-self-end" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 justify-self-end" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 justify-self-end" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center w-full space-y-3">
      {/* Live Action Narration Strip */}
      <motion.div
        key={lastAction}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full py-1 px-3 rounded-full bg-slate-900/90 border border-white/10 text-center shadow-sm"
      >
        <p className="text-xs font-semibold text-slate-200 truncate flex items-center justify-center gap-1.5">
          <Radio className="w-3 h-3 text-rose-400 animate-pulse shrink-0" />
          <span>{lastAction}</span>
        </p>
      </motion.div>

      {/* Main 15x15 Authentic Ludo Board */}
      <div className="relative w-full max-w-[350px] aspect-square p-2 bg-[#0d1527] border-4 border-amber-900/70 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-center">
        {/* Base Sector Labels */}
        <div className="absolute top-2.5 left-3 text-[9px] font-black text-rose-400/80 pointer-events-none tracking-wider">
          RED YARD
        </div>
        <div className="absolute bottom-2.5 right-3 text-[9px] font-black text-amber-400/80 pointer-events-none tracking-wider">
          YELLOW YARD
        </div>

        {/* 15x15 Grid */}
        <div
          className="w-full h-full grid grid-cols-15 grid-rows-15 gap-[1px]"
          style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
        >
          {Array.from({ length: 15 }).map((_, r) =>
            Array.from({ length: 15 }).map((__, c) => {
              const tokens = getTokensAtCell(r, c);
              const cellBg = getCellClassName(r, c);
              const hasStar = isStarCell(r, c);
              const isCenter = r === 7 && c === 7;

              return (
                <div
                  key={`cell-${r}-${c}`}
                  className={`relative flex items-center justify-center rounded-[1.5px] overflow-hidden ${cellBg}`}
                >
                  {/* Center Core 4-Triangle SVG */}
                  {isCenter && (
                    <div className="absolute inset-0 z-0 pointer-events-none">
                      <svg viewBox="0 0 100 100" className="w-full h-full">
                        <polygon points="0,0 100,0 50,50" fill="#059669" />
                        <polygon points="100,0 100,100 50,50" fill="#eab308" />
                        <polygon points="100,100 0,100 50,50" fill="#dc2626" />
                        <polygon points="0,100 0,0 50,50" fill="#2563eb" />
                      </svg>
                    </div>
                  )}

                  {/* Start Entry Arrows */}
                  {r === 6 && c === 1 && <span className="text-[10px] font-black text-white pointer-events-none select-none">➡</span>}
                  {r === 8 && c === 13 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬅</span>}
                  {r === 1 && c === 8 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬇</span>}
                  {r === 13 && c === 6 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬆</span>}

                  {/* Star Safe Cell */}
                  {hasStar && !isCenter && (
                    <Star className="w-2.5 h-2.5 text-slate-700 fill-slate-300 absolute opacity-80" />
                  )}

                  {/* Decorative Green & Blue Pawns */}
                  {tokens.length === 0 && (
                    <>
                      {((r === 2 && c === 11) || (r === 2 && c === 12) || (r === 3 && c === 11) || (r === 3 && c === 12)) && (
                        <Ludo3DPawn color="green" sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5" />
                      )}
                      {((r === 11 && c === 2) || (r === 11 && c === 3) || (r === 12 && c === 2) || (r === 12 && c === 3)) && (
                        <Ludo3DPawn color="blue" sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5" />
                      )}
                    </>
                  )}

                  {/* Rendered Live Tokens */}
                  {tokens.length > 0 && (
                    <div className="relative flex items-center justify-center w-full h-full z-10">
                      {tokens.map((tok) => {
                        const isRed = tok.color === 'red';
                        return (
                          <Ludo3DPawn
                            key={tok.id}
                            color={isRed ? 'red' : 'yellow'}
                            sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Spectator Match Telemetry & Dice Widget */}
      <div className="w-full max-w-[350px] bg-slate-900/80 border border-white/10 rounded-xl p-2.5 flex items-center justify-between gap-3 shadow-md">
        {/* Player 1 (Red) Status */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-1 ring-rose-300" />
            <span className="text-xs font-bold text-rose-300 truncate max-w-[90px]">
              {player1.displayName}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 space-x-1 font-mono">
            <span>Yard:{p1BaseCount}</span>
            <span>Trk:{p1TrackCount}</span>
            <span className="text-emerald-400 font-bold">Home:{p1HomeCount}/4</span>
          </div>
        </div>

        {/* Live Animated Dice */}
        <div className="flex flex-col items-center">
          <motion.div
            key={diceValue}
            initial={{ rotate: -20, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shadow-lg transition-colors ${
              turn === 'player1'
                ? 'bg-gradient-to-br from-rose-100 to-rose-300 border-rose-400 shadow-rose-500/30'
                : 'bg-gradient-to-br from-amber-100 to-amber-300 border-amber-400 shadow-amber-500/30'
            }`}
          >
            {renderDicePips(diceValue)}
          </motion.div>
          <span className="text-[9px] font-mono text-slate-400 mt-0.5 font-bold">
            ROLL: {diceValue}
          </span>
        </div>

        {/* Player 2 (Yellow) Status */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className="text-xs font-bold text-amber-300 truncate max-w-[90px]">
              {player2.displayName}
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-1 ring-amber-200" />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 space-x-1 font-mono">
            <span>Yard:{p2BaseCount}</span>
            <span>Trk:{p2TrackCount}</span>
            <span className="text-emerald-400 font-bold">Home:{p2HomeCount}/4</span>
          </div>
        </div>
      </div>
    </div>
  );
};
