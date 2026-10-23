import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { useDraughtsGame } from '../hooks/useDraughtsGame';
import { EscrowBanner } from '../components/EscrowBanner';
import { MatchEndModal } from '../components/MatchEndModal';
import { TurnTimerBar } from '../components/TurnTimerBar';
import { GameRulesModal } from '../components/GameRulesModal';
import { Crown, Flame, ShieldAlert, Sparkles, Swords, BookOpen, HelpCircle } from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

export const DraughtsGameScreen: React.FC = () => {
  const { activeMatch, settleMatch, cancelMatch, startMatch, user } = useGame();
  const [matchResult, setMatchResult] = useState<'player' | 'opponent' | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const handleGameOver = (winner: 'player' | 'opponent') => {
    setMatchResult(winner);
    settleMatch(winner);
  };

  const {
    pieces,
    selectedPiece,
    validMoves,
    turn,
    playerCapturedCount,
    opponentCapturedCount,
    gameMessage,
    mandatoryPieceIds,
    chainPieceId,
    onSelectPiece,
    onSelectTile,
    restartGame,
    turnTimeLeft,
    maxTurnTime,
    boardSize,
    piecesPerSide,
    isHost,
    myColor,
    oppColor,
    isMyTurn,
  } = useDraughtsGame(handleGameOver);

  const handleRematch = () => {
    if (!activeMatch) return;
    setMatchResult(null);
    startMatch(activeMatch.gameMode, activeMatch.stake, activeMatch.isPrivate, activeMatch.roomCode);
    restartGame();
  };

  const hasMandatoryEat = mandatoryPieceIds.length > 0 && isMyTurn;

  return (
    <div className="telegram-game-screen flex-1 flex flex-col justify-between bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Top Escrow Bar */}
      <EscrowBanner gameTitle="10x10 Draughts Duel" />

      {/* Opponent Status Header */}
      <div className="px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-[10px] text-white shadow-sm ${
            oppColor === 'gold' ? 'bg-amber-600 border-amber-400' : 'bg-rose-600 border-rose-400'
          }`}>
            {oppColor === 'gold' ? 'G' : 'C'}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-200 block leading-tight">
              @{activeMatch?.opponent.username || 'Opponent'} ({oppColor === 'gold' ? 'Gold' : 'Crimson'})
            </span>
            <span className="text-[10px] text-slate-400">
              Captured: <strong className="text-rose-400">{opponentCapturedCount}/{piecesPerSide}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasMandatoryEat && (
            <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
              <Flame className="w-3 h-3 text-amber-400" />
              Eat-Up Mandatory!
            </span>
          )}

          {isMyTurn ? (
            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
              Your Turn ({myColor === 'gold' ? 'Gold' : 'Crimson'})
            </span>
          ) : (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full animate-pulse">
              Opponent's Turn ({oppColor === 'gold' ? 'Gold' : 'Crimson'})
            </span>
          )}
        </div>
      </div>

      {/* Turn Countdown Timer (15s for Draughts) */}
      <TurnTimerBar
        timeLeft={turnTimeLeft}
        maxTime={maxTurnTime}
        isPlayerTurn={isMyTurn}
        theme="draughts"
      />

      {/* Message strip & Compulsory Rule Reminder */}
      <div className="px-4 py-1">
        <div className={`py-1 px-3 rounded-full text-center max-w-md mx-auto shadow-sm flex items-center justify-center gap-1.5 transition-colors ${
          hasMandatoryEat
            ? 'bg-amber-950/80 border border-amber-500/40 text-amber-200'
            : 'bg-slate-900/90 border border-white/10 text-slate-200'
        }`}>
          {hasMandatoryEat && <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          <p className="text-[11px] font-semibold truncate">{gameMessage}</p>
        </div>
      </div>

      {/* 10x10 Draughts Board */}
      <div className="px-2 sm:px-3 flex items-center justify-center">
        <div
          id="draughts-10x10-board"
          className="game-board bg-[#1c0f06] border-4 border-amber-900/80 rounded-2xl shadow-2xl p-1 grid grid-cols-10 grid-rows-10 gap-[1px]"
        >
          {Array.from({ length: boardSize }).map((_, r) =>
            Array.from({ length: boardSize }).map((__, c) => {
              const isDarkTile = (r + c) % 2 === 1;
              const piece = pieces.find((p) => p.row === r && p.col === c);
              const isValidDestination = validMoves.some((m) => m.toRow === r && m.toCol === c);
              const isSelectedPieceTile = selectedPiece?.row === r && selectedPiece?.col === c;
              const isMandatoryPiece = piece && mandatoryPieceIds.includes(piece.id) && isMyTurn;

              return (
                <div
                  key={`sq-${r}-${c}`}
                  onClick={() => onSelectTile(r, c)}
                  className={`relative flex items-center justify-center rounded-[2px] transition-colors ${
                    isDarkTile
                      ? isSelectedPieceTile
                        ? 'bg-amber-700/60'
                        : isMandatoryPiece
                        ? 'bg-amber-950/70 ring-1 ring-amber-400/50'
                        : 'bg-[#15202b]'
                      : 'bg-[#e2d5be]/15'
                  } ${isValidDestination ? 'cursor-pointer hover:bg-emerald-900/50' : ''}`}
                >
                  {/* Destination Valid Indicator */}
                  {isValidDestination && (
                    <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-400 border border-white shadow-md animate-ping" />
                  )}

                  {/* Piece */}
                  {piece && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (piece.color === myColor) {
                          onSelectPiece(piece);
                        } else {
                          onSelectTile(r, c);
                        }
                      }}
                      className={`relative w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border shadow-md transition-transform ${
                        piece.color === 'gold'
                          ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 border-amber-200 text-slate-950'
                          : 'bg-gradient-to-br from-rose-500 via-rose-700 to-rose-950 border-rose-300 text-white'
                      } ${
                        selectedPiece?.id === piece.id
                          ? 'scale-110 ring-2 ring-white shadow-[0_0_12px_rgba(245,158,11,0.8)] z-10'
                          : isMandatoryPiece
                          ? 'ring-2 ring-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.9)] scale-105'
                          : 'hover:scale-105'
                      }`}
                    >
                      {/* Compulsory Eat Badge on piece */}
                      {isMandatoryPiece && !piece.isKing && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-black flex items-center justify-center">
                          <Flame className="w-1.5 h-1.5 text-black" />
                        </div>
                      )}

                      {piece.isKing ? (
                        <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                      ) : (
                        <div
                          className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border border-black/20 ${
                            piece.color === 'gold' ? 'bg-amber-200' : 'bg-rose-400'
                          }`}
                        />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Player Status & Compulsory Rule Info Card */}
      <div className="px-3 pt-1">
        <div className="flex items-center justify-between bg-slate-900/90 border border-white/10 rounded-2xl p-2.5 sm:p-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center font-bold text-slate-950 text-xs shadow-md ${
              myColor === 'gold' ? 'bg-amber-500 border-amber-300' : 'bg-rose-600 border-rose-400 text-white'
            }`}>
              {myColor === 'gold' ? 'G' : 'C'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">
                  You (@{user?.username}) ({myColor === 'gold' ? 'Gold Draughts' : 'Crimson Draughts'})
                </span>
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                  10x10
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block">
                Enemy pieces captured: <strong className="text-emerald-400">{playerCapturedCount}/{piecesPerSide}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                telegram.triggerHaptic('selection');
                setShowRulesModal(true);
              }}
              className="py-1 px-2.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-bold border border-amber-500/30 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>Rules</span>
            </button>
            <button
              type="button"
              onClick={restartGame}
              className="py-1 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold border border-white/5 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        initialMode="draughts"
      />

      {/* Match Outcome Modal */}
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

