import React from 'react';
import { LudoReplaySnapshot } from '../../types/replay';
import { Ludo3DPawn } from '../Ludo3DPawn';
import {
  LUDO_TRACK_COORDS,
  RED_HOME_STRETCH,
  YELLOW_HOME_STRETCH,
  RED_BASE_COORDS,
  YELLOW_BASE_COORDS,
  SAFE_TRACK_INDICES,
} from '../../hooks/useLudoGame';
import { Star, Dices, Zap } from 'lucide-react';

interface LudoReplayBoardProps {
  snapshot?: LudoReplaySnapshot;
  actorName: string;
  turn: 'player' | 'opponent';
}

export const LudoReplayBoard: React.FC<LudoReplayBoardProps> = ({ snapshot, actorName, turn }) => {
  if (!snapshot) {
    return (
      <div className="w-full aspect-square max-w-[420px] mx-auto bg-slate-900/60 rounded-3xl flex items-center justify-center text-slate-400 text-sm">
        No board snapshot for this step
      </div>
    );
  }

  const { playerTokens, opponentTokens, dice, movedTokenId, capturedTokenId, blitzCardPlayed } = snapshot;

  // Helper to find tokens located on cell [r, c]
  const getTokensAtCell = (r: number, c: number) => {
    const tokens: { id: string; color: 'red' | 'yellow'; isPlayer: boolean; isMoved: boolean; isCaptured: boolean }[] = [];

    // 1. Check Base Yards
    RED_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const pt = playerTokens.find((t) => t.index === idx && t.step === -1);
        if (pt) {
          tokens.push({
            id: pt.id,
            color: 'red',
            isPlayer: true,
            isMoved: pt.id === movedTokenId,
            isCaptured: pt.id === capturedTokenId,
          });
        }
      }
    });

    YELLOW_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const ot = opponentTokens.find((t) => t.index === idx && t.step === -1);
        if (ot) {
          tokens.push({
            id: ot.id,
            color: 'yellow',
            isPlayer: false,
            isMoved: ot.id === movedTokenId,
            isCaptured: ot.id === capturedTokenId,
          });
        }
      }
    });

    // 2. Check Track Coordinates
    LUDO_TRACK_COORDS.forEach((coord, trackIdx) => {
      if (coord[0] === r && coord[1] === c) {
        // Red track step 0..50
        playerTokens.forEach((pt) => {
          if (pt.step >= 0 && pt.step <= 50 && pt.step % 52 === trackIdx) {
            tokens.push({
              id: pt.id,
              color: 'red',
              isPlayer: true,
              isMoved: pt.id === movedTokenId,
              isCaptured: pt.id === capturedTokenId,
            });
          }
        });

        // Yellow track step 0..50 (starts at track index 26)
        opponentTokens.forEach((ot) => {
          if (ot.step >= 0 && ot.step <= 50 && (26 + ot.step) % 52 === trackIdx) {
            tokens.push({
              id: ot.id,
              color: 'yellow',
              isPlayer: false,
              isMoved: ot.id === movedTokenId,
              isCaptured: ot.id === capturedTokenId,
            });
          }
        });
      }
    });

    // 3. Check Home Stretches (steps 51 to 55; tokens at step >= 56 are won and counted in Home HUD)
    RED_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        playerTokens.forEach((pt) => {
          if (pt.step === 51 + stretchIdx && pt.step < 56) {
            tokens.push({
              id: pt.id,
              color: 'red',
              isPlayer: true,
              isMoved: pt.id === movedTokenId,
              isCaptured: pt.id === capturedTokenId,
            });
          }
        });
      }
    });

    YELLOW_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        opponentTokens.forEach((ot) => {
          if (ot.step === 51 + stretchIdx && ot.step < 56) {
            tokens.push({
              id: ot.id,
              color: 'yellow',
              isPlayer: false,
              isMoved: ot.id === movedTokenId,
              isCaptured: ot.id === capturedTokenId,
            });
          }
        });
      }
    });

    return tokens;
  };

  const getCellBg = (r: number, c: number) => {
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

  const isSafeStarCell = (r: number, c: number) => {
    return LUDO_TRACK_COORDS.some((coord, idx) => {
      return coord[0] === r && coord[1] === c && SAFE_TRACK_INDICES.includes(idx);
    });
  };

  const playerHomeCount = playerTokens.filter((t) => t.step >= 56).length;
  const opponentHomeCount = opponentTokens.filter((t) => t.step >= 56).length;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[440px] mx-auto">
      {/* Top Status Bar with Dice & Score */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-white/10 px-3.5 py-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
          <span className="text-xs font-bold text-white">Red (You):</span>
          <span className="text-xs font-mono font-extrabold text-rose-400">{playerHomeCount}/4 Home</span>
        </div>

        {/* Dice / Action Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-white/15">
          {blitzCardPlayed ? (
            <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              {blitzCardPlayed}
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <Dices className="w-4 h-4 text-amber-400" />
              <span className="text-xs uppercase text-slate-400 font-bold">Roll:</span>
              <span className="text-sm font-black font-mono text-amber-400">{dice > 0 ? dice : '-'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-300">Yellow:</span>
          <span className="text-xs font-mono font-extrabold text-amber-400">{opponentHomeCount}/4 Home</span>
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        </div>
      </div>

      {/* 15x15 Ludo Board Grid */}
      <div className="w-full aspect-square bg-slate-950 p-2 sm:p-2.5 rounded-3xl border-2 border-slate-700/80 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-15 grid-rows-15 w-full h-full gap-[1.5px]">
          {Array.from({ length: 15 }).map((_, r) =>
            Array.from({ length: 15 }).map((__, c) => {
              const tokens = getTokensAtCell(r, c);
              const isStar = isSafeStarCell(r, c);
              const cellBg = getCellBg(r, c);

              return (
                <div
                  key={`cell-${r}-${c}`}
                  className={`relative flex items-center justify-center rounded-[2px] sm:rounded-sm border ${cellBg} transition-colors`}
                >
                  {/* Center Core 4-Triangle SVG */}
                  {r === 7 && c === 7 && (
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

                  {/* Safe Zone Star Indicator */}
                  {isStar && !(r === 7 && c === 7) && (
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

                  {/* Rendered Tokens */}
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
    </div>
  );
};
