import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext';
import { useWhotGame, isSpecialWhotCard } from '../hooks/useWhotGame';
import { WhotCard, WhotShape } from '../types';
import { EscrowBanner } from '../components/EscrowBanner';
import { MatchEndModal } from '../components/MatchEndModal';
import { TurnTimerBar } from '../components/TurnTimerBar';
import { Circle, Triangle, Plus, Square, Star, Sparkles, AlertTriangle, BookOpen } from 'lucide-react';
import { GameRulesModal } from '../components/GameRulesModal';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

// Helper to render Whot shape icon
export const RenderWhotShape: React.FC<{ shape: WhotShape; className?: string }> = ({
  shape,
  className = 'w-5 h-5',
}) => {
  switch (shape) {
    case 'circle':
      return <Circle className={`${className} stroke-[2.5] text-rose-500`} />;
    case 'triangle':
      return <Triangle className={`${className} stroke-[2.5] text-emerald-400`} />;
    case 'cross':
      return <Plus className={`${className} stroke-[3] text-sky-400`} />;
    case 'square':
      return <Square className={`${className} stroke-[2.5] text-amber-400`} />;
    case 'star':
      return <Star className={`${className} fill-amber-300 stroke-[1.5] text-amber-300`} />;
    case 'whot':
      return <Sparkles className={`${className} text-purple-400`} />;
  }
};

export const WhotGameScreen: React.FC = () => {
  const { activeMatch, settleMatch, cancelMatch, startMatch } = useGame();
  const [matchResult, setMatchResult] = useState<'player' | 'opponent' | null>(null);
  const [quickEmoji, setQuickEmoji] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const isSettledRef = useRef(false);

  const handleGameOver = useCallback(
    (winner: 'player' | 'opponent') => {
      if (isSettledRef.current) return;
      isSettledRef.current = true;
      sound.stopSpeech();
      setMatchResult(winner);
      settleMatch(winner);
    },
    [settleMatch]
  );

  useEffect(() => {
    return () => {
      sound.stopSpeech();
    };
  }, []);

  const {
    playerHand,
    opponentHand,
    discardPile,
    marketDeckCount,
    currentShape,
    currentNumber,
    turn,
    isChoosingShape,
    gameMessage,
    pendingPenalty,
    isCardPlayable,
    playCard,
    chooseShape,
    drawFromMarket,
    restartGame,
    turnTimeLeft,
    maxTurnTime,
    playerTimeoutCount,
    opponentTimeoutCount,
  } = useWhotGame(handleGameOver);

  const topCard: WhotCard | undefined = discardPile[0];

  const handleRematch = () => {
    if (!activeMatch) return;
    isSettledRef.current = false;
    sound.stopSpeech();
    setMatchResult(null);
    startMatch(activeMatch.gameMode, activeMatch.stake, activeMatch.isPrivate, activeMatch.roomCode);
    restartGame();
  };

  const handleEmojiReact = (emoji: string) => {
    setQuickEmoji(emoji);
    sound.playClick();
    setTimeout(() => setQuickEmoji(null), 1800);
  };

  return (
    <div className="telegram-game-screen flex-1 flex flex-col justify-between bg-slate-950 text-slate-100 relative overflow-hidden select-none">
      {/* Sticky Escrow Bar */}
      <EscrowBanner gameTitle="Naija Whot" />

      {/* Opponent Zone */}
      <div className="px-4 pt-2 pb-1 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-2">
          <img
            src={activeMatch?.opponent.avatarUrl}
            alt={activeMatch?.opponent.displayName}
            className="w-7 h-7 rounded-full object-cover ring-2 ring-rose-500/40"
          />
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 block leading-tight">
                @{activeMatch?.opponent.username}
              </span>
              {opponentHand.length === 1 && (
                <span className="text-[10px] font-black text-rose-400 bg-rose-500/20 border border-rose-500/50 px-1.5 py-0.2 rounded-full animate-pulse">
                  ⚠️ LAST CARD!
                </span>
              )}
              {opponentTimeoutCount > 0 && (
                <span className="text-[9px] font-extrabold text-rose-400 bg-rose-500/20 border border-rose-500/50 px-1.5 py-0.2 rounded-full">
                  ⚠️ {opponentTimeoutCount}/4 Timeouts
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              {opponentHand.length} cards in hand
            </span>
          </div>
          {turn === 'opponent' && (
            <span className="ml-2 text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
              Playing...
            </span>
          )}
        </div>

        {/* Opponent Card Backs */}
        <div className="flex -space-x-4 overflow-hidden py-1">
          {opponentHand.map((_, i) => (
            <div
              key={i}
              className="w-10 h-14 bg-gradient-to-br from-indigo-950 to-slate-900 border border-white/20 rounded-lg shadow-md flex items-center justify-center text-amber-500/50 font-black text-xs transform -rotate-1"
            >
              🇳🇬
            </div>
          ))}
        </div>
      </div>

      {/* Turn Countdown Timer (20s for Whot) */}
      <TurnTimerBar
        timeLeft={turnTimeLeft}
        maxTime={maxTurnTime}
        isPlayerTurn={turn === 'player'}
        theme="whot"
      />

      {/* Central Table (Market & Discard Pile) */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 relative">
        {/* Floating Quick Emoji Reaction Bubble */}
        {quickEmoji && (
          <div className="absolute top-4 bg-slate-800/90 border border-white/10 px-3 py-1 rounded-full text-2xl animate-bounce shadow-xl z-20">
            {quickEmoji}
          </div>
        )}

        {/* Penalty Alert Banner */}
        {pendingPenalty && (
          <div className="mb-2 px-3 py-1 rounded-full bg-rose-950/90 border border-rose-500/60 shadow-[0_0_15px_rgba(244,63,94,0.3)] animate-pulse flex items-center gap-1.5 text-xs font-bold text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>
              PICK {pendingPenalty.count} PENALTY! Play a {pendingPenalty.type} to Defend or Draw
            </span>
          </div>
        )}

        {/* Message Banner */}
        <div className="mb-3 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-white/10 text-center max-w-xs shadow-md">
          <p className="text-xs font-semibold text-slate-200 tracking-tight truncate">
            {gameMessage}
          </p>
        </div>

        <div className="flex items-center justify-center gap-6">
          {/* Market Deck */}
          <button
            id="btn-market-deck"
            onClick={drawFromMarket}
            disabled={turn !== 'player' || isChoosingShape}
            className={`w-22 h-32 rounded-2xl border-2 shadow-xl flex flex-col items-center justify-between p-2.5 transition-all ${
              pendingPenalty
                ? 'bg-gradient-to-br from-rose-700 to-rose-950 border-rose-400 ring-2 ring-rose-400/40 animate-pulse'
                : 'bg-gradient-to-br from-amber-600/90 to-amber-900 border-amber-400/40'
            } ${
              turn === 'player'
                ? 'hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-amber-400/30'
                : 'opacity-70'
            }`}
          >
            <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest">
              {pendingPenalty ? `PICK ${pendingPenalty.count}` : 'MARKET'}
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-950/40 border border-amber-300/30 flex items-center justify-center text-xs font-black text-amber-300">
              {marketDeckCount}
            </div>
            <span className="text-[9px] font-bold text-amber-200/90 text-center leading-tight">
              {pendingPenalty ? `DRAW ${pendingPenalty.count}` : 'TAP TO DRAW'}
            </span>
          </button>

          {/* Central Discard Pile */}
          <div className="relative">
            {topCard ? (
              <div
                className={`w-22 h-32 rounded-2xl bg-slate-900 border-2 shadow-2xl p-2.5 flex flex-col justify-between items-center transition-all ${
                  topCard.number === 20
                    ? 'border-purple-400/80 bg-purple-950/30 ring-2 ring-purple-500/30'
                    : 'border-white/20'
                }`}
              >
                {/* Top Corner Shape & Number */}
                <div className="w-full flex items-center justify-between text-xs font-black">
                  <span className="text-amber-400">{topCard.number}</span>
                  <RenderWhotShape shape={topCard.shape} className="w-4 h-4" />
                </div>

                {/* Central Display */}
                <div className="flex flex-col items-center justify-center">
                  <RenderWhotShape shape={topCard.shape} className="w-8 h-8" />
                  {topCard.number === 20 ? (
                    <span className="text-[10px] font-black text-purple-300 uppercase tracking-wider mt-0.5">
                      WHOT
                    </span>
                  ) : topCard.isSpecial ? (
                    <span className="text-[9px] font-bold text-amber-400 uppercase mt-0.5 text-center leading-tight">
                      {topCard.number === 1 && 'HOLD ON'}
                      {topCard.number === 2 && 'PICK 2'}
                      {topCard.number === 5 && 'PICK 3'}
                      {topCard.number === 8 && 'SUSPEND'}
                      {topCard.number === 14 && 'GENERAL'}
                    </span>
                  ) : null}
                </div>

                {/* Bottom Corner */}
                <div className="w-full flex items-center justify-between text-xs font-black rotate-180">
                  <span className="text-amber-400">{topCard.number}</span>
                  <RenderWhotShape shape={topCard.shape} className="w-4 h-4" />
                </div>
              </div>
            ) : null}

            {/* Required shape & number badge */}
            <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-amber-500/50 px-3 py-0.5 rounded-full flex items-center gap-1.5 shadow-xl whitespace-nowrap z-10">
              <span className="text-[9px] font-bold text-slate-400">NEED:</span>
              <RenderWhotShape shape={currentShape} className="w-3.5 h-3.5" />
              <span className="text-[10px] font-extrabold text-amber-400 uppercase">
                {currentNumber !== null ? `${currentShape.toUpperCase()} ${currentNumber}` : currentShape.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Emoji Reactions */}
        <div className="flex items-center gap-1.5 mt-5 bg-slate-900/60 p-1.5 rounded-full border border-white/5">
          {['🇳🇬', '🔥', '💰', '😂', '👏'].map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => handleEmojiReact(em)}
              className="hover:scale-125 active:scale-95 text-sm p-1 transition-transform cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      {/* Player Hand Carousel */}
      <div className="px-3 pt-2">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white">Your Hand</span>
            <span className="text-[10px] text-slate-400 font-semibold">
              ({playerHand.length} cards)
            </span>
            {playerHand.length === 1 && (
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 border border-amber-500/50 px-2 py-0.2 rounded-full animate-pulse shadow-sm">
                🔥 LAST CARD!
              </span>
            )}
            {playerHand.length === 1 && isSpecialWhotCard(playerHand[0]) && (
              <span className="text-[9px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.2 rounded-full">
                ⚠️ Cannot finish on special card
              </span>
            )}
            {playerTimeoutCount > 0 && (
              <span className="text-[9px] font-extrabold text-rose-400 bg-rose-500/20 border border-rose-500/50 px-2 py-0.5 rounded-full animate-pulse">
                ⚠️ Timeouts: {playerTimeoutCount}/4
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                telegram.triggerHaptic('selection');
                setShowRulesModal(true);
              }}
              className="py-0.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold border border-amber-500/30 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>Rules</span>
            </button>
            {turn === 'player' && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse">
                Your Turn!
              </span>
            )}
          </div>
        </div>

        <div className="game-hand-scroll flex gap-2 overflow-x-auto pb-2 pt-1 px-1 scrollbar-none">
          {playerHand.map((card, idx) => {
            const playable = isCardPlayable(card);
            const isLastCardSpecial = playerHand.length === 1 && isSpecialWhotCard(card);
            return (
              <button
                key={`${card.id}_${idx}`}
                onClick={() => playCard(card)}
                disabled={!playable}
                className={`w-18 h-28 shrink-0 rounded-2xl p-2 flex flex-col justify-between items-center transition-all cursor-pointer ${
                  playable
                    ? isLastCardSpecial
                      ? 'bg-slate-800 border-2 border-amber-500/90 shadow-lg shadow-amber-500/20 -translate-y-2 hover:-translate-y-3 ring-1 ring-rose-500/50'
                      : 'bg-slate-800 border-2 border-amber-400 shadow-lg shadow-amber-500/20 -translate-y-2 hover:-translate-y-3'
                    : 'bg-slate-900/80 border border-white/10 opacity-55 hover:opacity-75'
                }`}
              >
                {/* Top Corner */}
                <div className="w-full flex items-center justify-between text-[11px] font-black">
                  <span className={playable ? 'text-amber-400' : 'text-slate-400'}>
                    {card.number}
                  </span>
                  <RenderWhotShape shape={card.shape} className="w-3.5 h-3.5" />
                </div>

                {/* Center */}
                <div className="flex flex-col items-center">
                  <RenderWhotShape shape={card.shape} className="w-6 h-6" />
                  {card.number === 20 ? (
                    <span className="text-[8px] font-black text-purple-400 uppercase tracking-tight">
                      WHOT
                    </span>
                  ) : card.isSpecial ? (
                    <span className="text-[7px] font-black text-amber-300 uppercase tracking-tight text-center">
                      {card.number === 1 && 'HOLD ON'}
                      {card.number === 2 && 'PICK 2'}
                      {card.number === 5 && 'PICK 3'}
                      {card.number === 8 && 'SUSPEND'}
                      {card.number === 14 && 'GENERAL'}
                    </span>
                  ) : null}
                  {isLastCardSpecial && (
                    <span className="text-[6px] font-black text-rose-300 bg-rose-950/80 px-1 rounded uppercase mt-0.5 whitespace-nowrap">
                      +1 DRAW PENALTY
                    </span>
                  )}
                </div>

                {/* Bottom Corner */}
                <div className="w-full flex items-center justify-between text-[11px] font-black rotate-180">
                  <span className={playable ? 'text-amber-400' : 'text-slate-400'}>
                    {card.number}
                  </span>
                  <RenderWhotShape shape={card.shape} className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Whot 20 Shape Picker Modal with all 5 Nigerian Whot Shapes */}
      {isChoosingShape && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs bg-slate-900 border border-purple-500/40 rounded-3xl p-5 text-center shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Choose Required Shape</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                You played WHOT 20! Select the next shape:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {(['circle', 'triangle', 'cross', 'square', 'star'] as WhotShape[]).map((shp) => (
                <button
                  key={shp}
                  type="button"
                  onClick={() => chooseShape(shp)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 hover:border-amber-400/50 transition-all cursor-pointer ${
                    shp === 'star' ? 'col-span-2' : ''
                  }`}
                >
                  <RenderWhotShape shape={shp} className="w-7 h-7 mb-1" />
                  <span className="text-xs font-bold capitalize text-slate-200">{shp}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Whot Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        initialMode="whot"
      />

      {/* Match Conclusion / Escrow Settlement Modal */}
      {matchResult && (
        <MatchEndModal
          winner={matchResult}
          onPlayAgain={handleRematch}
          onExit={cancelMatch}
        />
      )}
    </div>
  );
};
