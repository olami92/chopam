import React from 'react';
import { WhotReplaySnapshot } from '../../types/replay';
import { WhotShape, WhotCard } from '../../types';
import { AlertCircle, Flame, Layers, Sparkles } from 'lucide-react';

interface WhotReplayBoardProps {
  snapshot?: WhotReplaySnapshot;
  actorName: string;
  turn: 'player' | 'opponent';
}

export const WhotReplayBoard: React.FC<WhotReplayBoardProps> = ({ snapshot, actorName, turn }) => {
  if (!snapshot) {
    return (
      <div className="w-full aspect-square max-w-[420px] mx-auto bg-slate-900/60 rounded-3xl flex items-center justify-center text-slate-400 text-sm">
        No Whot board snapshot for this step
      </div>
    );
  }

  const { topCard, currentShape, currentNumber, player1Hand, player2HandCount, playedCard, penaltyApplied } =
    snapshot;

  const renderShapeIcon = (shape: WhotShape, size = 'w-6 h-6') => {
    switch (shape) {
      case 'circle':
        return <div className={`${size} rounded-full border-[3px] border-amber-400`} />;
      case 'triangle':
        return (
          <div
            className={`${size} border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-amber-400`}
          />
        );
      case 'cross':
        return (
          <div className={`${size} relative flex items-center justify-center`}>
            <div className="w-full h-1 bg-amber-400 rounded" />
            <div className="h-full w-1 bg-amber-400 rounded absolute" />
          </div>
        );
      case 'square':
        return <div className={`${size} border-[3px] border-amber-400 rounded-sm`} />;
      case 'star':
        return (
          <div className={`${size} flex items-center justify-center text-amber-400 font-bold text-lg`}>
            ★
          </div>
        );
      case 'whot':
        return (
          <div className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-xs tracking-wider">
            WHOT 20
          </div>
        );
      default:
        return null;
    }
  };

  const getShapeColor = (shape: WhotShape) => {
    switch (shape) {
      case 'circle':
        return 'text-rose-400 border-rose-400/40 bg-rose-500/10';
      case 'triangle':
        return 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10';
      case 'cross':
        return 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10';
      case 'square':
        return 'text-blue-400 border-blue-400/40 bg-blue-500/10';
      case 'star':
        return 'text-amber-400 border-amber-400/40 bg-amber-500/10';
      case 'whot':
        return 'text-purple-400 border-purple-400/40 bg-purple-500/10';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[440px] mx-auto">
      {/* Opponent Card Stack */}
      <div className="w-full flex items-center justify-between bg-slate-900/90 border border-white/10 px-4 py-2.5 rounded-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Opponent Hand:</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(player2HandCount, 8) }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-6 rounded bg-slate-800 border border-amber-500/40 -ml-1.5 first:ml-0 shadow-sm"
              />
            ))}
          </div>
        </div>
        <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-lg">
          {player2HandCount} Cards Left
        </span>
      </div>

      {/* Center Table Area */}
      <div className="w-full aspect-[4/3] bg-radial from-emerald-950/40 via-slate-950 to-slate-950 border-2 border-emerald-500/20 rounded-3xl p-4 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden">
        {/* Active Shape Call Banner */}
        <div className="absolute top-3 inset-x-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-white/10 text-xs text-slate-300">
            <span>Called Shape:</span>
            <span className="font-extrabold text-amber-400 capitalize">{currentShape}</span>
          </div>

          {penaltyApplied && (
            <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-[11px] font-black text-rose-400 animate-pulse">
              <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>{penaltyApplied}</span>
            </div>
          )}
        </div>

        {/* Center Discard & Market Pile */}
        <div className="flex items-center gap-6 mt-4">
          {/* Market Deck */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-20 h-28 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border-2 border-slate-700 shadow-xl flex items-center justify-center relative">
              <Layers className="w-8 h-8 text-slate-500" />
              <div className="absolute -bottom-2 px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[9px] font-bold text-slate-400 uppercase">
                Market
              </div>
            </div>
          </div>

          {/* Top Played Card */}
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-24 h-32 rounded-2xl bg-slate-900 border-2 shadow-2xl flex flex-col items-center justify-between p-2.5 transition-all ${getShapeColor(
                topCard.shape
              )} scale-105 ring-2 ring-amber-400/40`}
            >
              <div className="w-full flex items-center justify-between">
                <span className="text-base font-black font-mono leading-none">{topCard.number}</span>
                <span className="text-[10px] font-black uppercase">{topCard.shape}</span>
              </div>

              <div className="flex items-center justify-center my-auto">
                {renderShapeIcon(topCard.shape, 'w-8 h-8')}
              </div>

              <div className="w-full flex items-center justify-between rotate-180">
                <span className="text-base font-black font-mono leading-none">{topCard.number}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Hand Cards */}
      <div className="w-full bg-slate-900/90 border border-white/10 p-3.5 rounded-2xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300">Your Hand (Tete Arena Player):</span>
          <span className="font-mono text-xs font-black text-emerald-400">
            {player1Hand.length} Cards Remaining
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {player1Hand.length === 0 ? (
            <div className="w-full py-2 text-center text-xs font-black text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
              🎉 0 Cards - Match Cleared!
            </div>
          ) : (
            player1Hand.map((card) => {
              const isPlayable =
                card.shape === currentShape ||
                card.number === currentNumber ||
                card.number === 20;

              return (
                <div
                  key={card.id}
                  className={`w-14 h-20 rounded-xl bg-slate-950 border flex flex-col items-center justify-between p-1.5 shrink-0 transition-transform ${
                    isPlayable
                      ? 'border-emerald-500/60 ring-1 ring-emerald-500/40 translate-y-[-2px]'
                      : 'border-white/10 opacity-70'
                  }`}
                >
                  <span className="text-xs font-black font-mono self-start text-white">
                    {card.number}
                  </span>
                  <div className="scale-75">{renderShapeIcon(card.shape, 'w-5 h-5')}</div>
                  <span className="text-[8px] uppercase font-bold text-slate-400">
                    {card.shape.slice(0, 4)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

