import React from 'react';
import { DraughtsReplaySnapshot } from '../../types/replay';
import { Crown, ShieldAlert } from 'lucide-react';

interface DraughtsReplayBoardProps {
  snapshot?: DraughtsReplaySnapshot;
  actorName: string;
  turn: 'player' | 'opponent';
}

export const DraughtsReplayBoard: React.FC<DraughtsReplayBoardProps> = ({ snapshot, actorName, turn }) => {
  if (!snapshot) {
    return (
      <div className="w-full aspect-square max-w-[420px] mx-auto bg-slate-900/60 rounded-3xl flex items-center justify-center text-slate-400 text-sm">
        No Draughts board snapshot for this step
      </div>
    );
  }

  const { pieces, lastMove, capturedGold, capturedCrimson } = snapshot;

  const getPieceAt = (r: number, c: number) => {
    return pieces.find((p) => p.row === r && p.col === c);
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[440px] mx-auto">
      {/* Top Header with Captured Pieces */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-white/10 px-4 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-600 border border-rose-300" />
          <span className="text-xs text-slate-300 font-bold">Crimson Lost:</span>
          <span className="text-xs font-mono font-extrabold text-rose-400">{capturedCrimson}</span>
        </div>

        {lastMove?.captured && (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-black text-amber-400 flex items-center gap-1 animate-pulse">
            <ShieldAlert className="w-3 h-3" />
            Capture Jump!
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-bold">Gold Lost:</span>
          <span className="text-xs font-mono font-extrabold text-amber-400">{capturedGold}</span>
          <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-200" />
        </div>
      </div>

      {/* 8x8 Draughts Board */}
      <div className="w-full aspect-square bg-slate-950 p-2 sm:p-2.5 rounded-3xl border-2 border-slate-700 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full gap-1">
          {Array.from({ length: 8 }).map((_, r) =>
            Array.from({ length: 8 }).map((__, c) => {
              const isDarkSquare = (r + c) % 2 === 1;
              const piece = getPieceAt(r, c);
              const isLastMoveOrigin = lastMove && lastMove.fromRow === r && lastMove.fromCol === c;
              const isLastMoveDest = lastMove && lastMove.toRow === r && lastMove.toCol === c;

              return (
                <div
                  key={`cell-${r}-${c}`}
                  className={`relative flex items-center justify-center rounded-lg border transition-colors ${
                    isDarkSquare
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-slate-800/40 border-slate-800/20'
                  } ${isLastMoveDest ? 'ring-2 ring-amber-400 bg-amber-950/40' : ''} ${
                    isLastMoveOrigin ? 'border-dashed border-amber-500/40' : ''
                  }`}
                >
                  {/* File & Rank Coordinates on Edges */}
                  {c === 0 && (
                    <span className="absolute left-1 top-0.5 text-[8px] font-mono text-slate-600 font-bold">
                      {8 - r}
                    </span>
                  )}
                  {r === 7 && (
                    <span className="absolute right-1 bottom-0.5 text-[8px] font-mono text-slate-600 font-bold">
                      {String.fromCharCode(65 + c)}
                    </span>
                  )}

                  {/* Piece Representation */}
                  {piece && (
                    <div
                      className={`w-[80%] h-[80%] rounded-full flex items-center justify-center shadow-lg transition-transform ${
                        piece.color === 'gold'
                          ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 border-2 border-amber-100 ring-2 ring-amber-900/50'
                          : 'bg-gradient-to-tr from-rose-700 to-rose-500 text-white border-2 border-rose-300 ring-2 ring-rose-950/50'
                      } ${isLastMoveDest ? 'scale-110' : ''}`}
                    >
                      {piece.isKing ? (
                        <Crown className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full border border-current opacity-60" />
                      )}
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
