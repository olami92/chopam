import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import {
  useLudoGame,
  LUDO_TRACK_COORDS,
  RED_HOME_STRETCH,
  YELLOW_HOME_STRETCH,
  RED_BASE_COORDS,
  YELLOW_BASE_COORDS,
  SAFE_TRACK_INDICES,
} from '../hooks/useLudoGame';
import { EscrowBanner } from '../components/EscrowBanner';
import { MatchEndModal } from '../components/MatchEndModal';
import { TurnTimerBar } from '../components/TurnTimerBar';
import { GameRulesModal } from '../components/GameRulesModal';
import { ProvablyFairModal } from '../components/ProvablyFairModal';
import { Ludo3DPawn } from '../components/Ludo3DPawn';
import {
  Sparkles,
  Dices,
  Star,
  Zap,
  Radio,
  Target,
  ChevronRight,
  Cpu,
  Flame,
  ShieldAlert,
  ShieldCheck,
  Activity,
  BookOpen,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

export const LudoGameScreen: React.FC = () => {
  const { activeMatch, settleMatch, completeCoinAiMatch, cancelMatch, startMatch, startCoinAiMatch } = useGame();
  const isBlitz = activeMatch?.gameMode === 'ludo_blitz';
  const [matchResult, setMatchResult] = useState<'player' | 'opponent' | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFairnessModal, setShowFairnessModal] = useState(false);

  const handleGameOver = (winner: 'player' | 'opponent') => {
    setMatchResult(winner);
    if (activeMatch?.coinMatchId) completeCoinAiMatch(winner);
    else settleMatch(winner);
  };

  const {
    playerTokens,
    opponentTokens,
    turn,
    isMyTurn,
    myColor,
    oppColor,
    isHost,
    diceValue,
    isRolling,
    blitzCards,
    selectedCardId,
    setSelectedCardId,
    opponentBlitzCards,
    opponentPlayedCard,
    gameMessage,
    rollDice,
    onSelectPlayerToken,
    canTokenMove,
    restartGame,
    turnTimeLeft,
    maxTurnTime,
    serverSeedHash,
    clientSeed,
    nonce,
  } = useLudoGame(isBlitz, handleGameOver);

  const handleRematch = () => {
    if (!activeMatch) return;
    setMatchResult(null);
    if (activeMatch.coinMatchId) {
      void startCoinAiMatch(activeMatch.stake, activeMatch.gameMode);
    } else {
      startMatch(activeMatch.gameMode, activeMatch.stake, activeMatch.isPrivate, activeMatch.roomCode);
    }
    restartGame();
  };

  // Helper to find tokens located on a cell (row, col)
  const getTokensAtCell = (r: number, c: number) => {
    const tokens: { id: string; color: 'red' | 'yellow'; isPlayer: boolean }[] = [];

    // 1. Check bases
    RED_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const pt = playerTokens.find((t) => t.index === idx && t.step === -1);
        if (pt) tokens.push({ id: pt.id, color: 'red', isPlayer: true });
      }
    });

    YELLOW_BASE_COORDS.forEach((coord, idx) => {
      if (coord[0] === r && coord[1] === c) {
        const ot = opponentTokens.find((t) => t.index === idx && t.step === -1);
        if (ot) tokens.push({ id: ot.id, color: 'yellow', isPlayer: false });
      }
    });

    // 2. Check track
    LUDO_TRACK_COORDS.forEach((coord, trackIdx) => {
      if (coord[0] === r && coord[1] === c) {
        // Red track step 0..50 is trackIdx
        playerTokens.forEach((pt) => {
          if (pt.step >= 0 && pt.step <= 50 && pt.step % 52 === trackIdx) {
            tokens.push({ id: pt.id, color: 'red', isPlayer: true });
          }
        });

        // Yellow track: step 0..50 starts at 26
        opponentTokens.forEach((ot) => {
          if (ot.step >= 0 && ot.step <= 50 && (26 + ot.step) % 52 === trackIdx) {
            tokens.push({ id: ot.id, color: 'yellow', isPlayer: false });
          }
        });
      }
    });

    // 3. Check home stretch (steps 51 to 55; tokens at step >= 56 are won and counted in Home HUD)
    RED_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        playerTokens.forEach((pt) => {
          if (pt.step === 51 + stretchIdx && pt.step < 56) {
            tokens.push({ id: pt.id, color: 'red', isPlayer: true });
          }
        });
      }
    });

    YELLOW_HOME_STRETCH.forEach((coord, stretchIdx) => {
      if (coord[0] === r && coord[1] === c) {
        opponentTokens.forEach((ot) => {
          if (ot.step === 51 + stretchIdx && ot.step < 56) {
            tokens.push({ id: ot.id, color: 'yellow', isPlayer: false });
          }
        });
      }
    });

    return tokens;
  };

  // Determine cell background styling for authentic 15x15 board
  const getCellClassName = (r: number, c: number) => {
    // Non-playable inner corner cells adjacent to the center home cross: (6,6), (6,8), (8,6), (8,8)
    // Colored black so tokens turning from arm-to-arm visibly bypass these non-walkable dead zones
    if ((r === 6 && c === 6) || (r === 6 && c === 8) || (r === 8 && c === 6) || (r === 8 && c === 8)) {
      return isBlitz ? 'bg-[#030712] border border-cyan-950' : 'bg-black border border-slate-900';
    }

    if (isBlitz) {
      // ===== BLITZ CYBER ARENA STYLING =====
      // Red Base (Sector Alpha - Player Launch Bay)
      if (r < 6 && c < 6) return 'bg-gradient-to-br from-rose-950/90 via-purple-950/80 to-slate-950 border border-rose-500/40 shadow-[inset_0_0_14px_rgba(244,63,94,0.3)]';
      // Green Base (Sector Beta - Inactive Deactivated Matrix)
      if (r < 6 && c > 8) return 'bg-slate-950/95 border border-emerald-500/10 opacity-35';
      // Blue Base (Sector Gamma - Inactive Deactivated Matrix)
      if (r > 8 && c < 6) return 'bg-slate-950/95 border border-cyan-500/10 opacity-35';
      // Yellow Base (Sector Omega - Opponent Launch Bay)
      if (r > 8 && c > 8) return 'bg-gradient-to-br from-amber-950/90 via-yellow-950/80 to-slate-950 border border-amber-500/40 shadow-[inset_0_0_14px_rgba(245,158,11,0.3)]';

      // Center Home (7,7) - Quantum Singularity Core
      if (r === 7 && c === 7) return 'bg-gradient-to-tr from-cyan-400 via-fuchsia-600 to-amber-400 border-2 border-cyan-200 shadow-[0_0_24px_rgba(6,182,212,0.95)] animate-pulse';

      // Red Laser Home Stretch
      if (r === 7 && c >= 1 && c <= 6) return 'bg-gradient-to-r from-rose-600 via-rose-500 to-fuchsia-600 border border-rose-300/70 shadow-[0_0_10px_rgba(244,63,94,0.8)]';
      // Yellow Laser Home Stretch
      if (r === 7 && c >= 8 && c <= 13) return 'bg-gradient-to-l from-amber-500 via-yellow-400 to-amber-300 border border-amber-200/70 shadow-[0_0_10px_rgba(245,158,11,0.8)]';

      // Turbo Warp Accelerator Gates
      if (isStarCell(r, c)) return 'bg-cyan-500/35 border-2 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.85)]';

      // Neutral Cyber Track Cells
      return 'bg-[#060b16] border border-cyan-500/20 hover:border-cyan-400/50 transition-colors';
    } else {
      // ===== CLASSIC HERITAGE BOARD STYLING (Photo-Accurate Reference Board) =====
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
    }
  };

  const isStarCell = (r: number, c: number) => {
    return (
      (r === 6 && c === 1) ||
      (r === 8 && c === 13) ||
      (r === 2 && c === 8) ||
      (r === 12 && c === 6)
    );
  };

  const activeMoveVal = isBlitz
    ? blitzCards.find((c) => c.id === selectedCardId)?.value
    : diceValue;

  return (
    <div className={`telegram-game-screen flex-1 flex flex-col justify-between select-none overflow-hidden relative ${
      isBlitz ? 'bg-[#020617] text-cyan-50' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Blitz Background Cyber Glow */}
      {isBlitz && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_35%,rgba(6,182,212,0.12),transparent_70%)]" />
      )}

      {/* Top Escrow Bar */}
      <EscrowBanner gameTitle={isBlitz ? 'Ludo Blitz' : 'Classic Ludo'} />

      {/* Mode Sub-Banner: High-Octane Cyber HUD vs Heritage Rules */}
      <div className={`px-4 py-1.5 flex items-center justify-between border-y text-[10px] ${
        isBlitz
          ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
          : 'bg-slate-900/80 border-white/10 text-slate-400'
      }`}>
        <div className="flex items-center gap-1.5 font-mono font-bold tracking-wider">
          {isBlitz ? (
            <>
              <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-cyan-300">TURBO BLITZ ARENA // 2X SPEED</span>
            </>
          ) : (
            <>
              <Dices className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300">HERITAGE RULES // 3D DICE</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isBlitz ? (
            <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/40 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>TACTICAL DECK</span>
            </span>
          ) : (
            <span className="text-slate-400 text-[10px]">
              First to 4 Home wins
            </span>
          )}
        </div>
      </div>

      {/* Opponent Status Header */}
      <div className="px-4 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
            oppColor === 'red'
              ? 'bg-rose-600 text-white ring-2 ring-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)]'
              : isBlitz
              ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.8)]'
              : 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
          }`}>
            {oppColor === 'red' ? 'R' : (isBlitz ? '⚡' : 'Y')}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-200 block leading-tight">
              @{activeMatch?.opponent.username} ({oppColor === 'red' ? 'Red' : 'Yellow'})
            </span>
            <span className="text-[10px] text-slate-400">
              Home:{' '}
              <strong className={oppColor === 'red' ? 'text-rose-400' : 'text-amber-400'}>
                {(oppColor === 'red' ? playerTokens : opponentTokens).filter((t) => t.step >= 56).length}/4
              </strong>
            </span>
          </div>
        </div>

        {!isMyTurn ? (
          <div className="flex items-center gap-2">
            {!isBlitz && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/30 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]"
              >
                <Dices className={`w-3.5 h-3.5 text-amber-400 ${isRolling ? 'animate-spin' : ''}`} />
                <span className="text-[11px] font-black font-mono">
                  {isRolling ? 'Rolling...' : diceValue !== null ? `Rolled [ ${diceValue} ]` : 'Waiting'}
                </span>
              </motion.div>
            )}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isBlitz
                ? 'text-cyan-300 bg-cyan-500/25 border border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.4)] animate-pulse'
                : 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
            }`}>
              {isBlitz ? 'Opponent choosing card...' : isRolling ? 'Opponent rolling...' : diceValue !== null ? `Opponent move` : 'Opponent turn'}
            </span>
          </div>
        ) : (
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            Your Move ({myColor === 'red' ? 'Red' : 'Yellow'})
          </span>
        )}
      </div>

      {/* Player Turn Timer Countdown Bar (15s Blitz / 20s Classic) */}
      <TurnTimerBar
        timeLeft={turnTimeLeft}
        maxTime={maxTurnTime}
        isPlayerTurn={isMyTurn}
        theme={isBlitz ? 'blitz' : 'classic'}
      />

      {/* Opponent Tactical Cyber Hand (Blitz Only) */}
      {isBlitz && (
        <div className="px-4 py-0.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-cyan-400/70 font-semibold tracking-wider flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              OPPONENT HAND:
            </span>
            <div className="flex items-center gap-1">
              {opponentBlitzCards.map((card, idx) => {
                const isPlayed = opponentPlayedCard?.id === card.id;
                return (
                  <div
                    key={card.id || idx}
                    className={`h-5 min-w-5 px-1 rounded border flex items-center justify-center font-mono text-[9px] font-bold transition-all ${
                      isPlayed
                        ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(245,158,11,1)] scale-110'
                        : 'bg-slate-900/90 border-cyan-500/30 text-cyan-400'
                    }`}
                  >
                    {isPlayed ? card.value : '⚡'}
                  </div>
                );
              })}
            </div>
          </div>
          {opponentPlayedCard && (
            <span className="text-[9px] font-mono font-bold text-amber-300 animate-pulse bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-400/50">
              PLAYED [{opponentPlayedCard.value}]
            </span>
          )}
        </div>
      )}

      {/* Message strip */}
      <div className="px-4 py-0.5">
        <div className={`py-1 px-3 rounded-full text-center max-w-sm mx-auto shadow-sm ${
          isBlitz
            ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 font-mono text-[11px]'
            : 'bg-slate-900/90 border border-white/10 text-slate-200 text-[11px]'
        }`}>
          <p className="truncate font-semibold">{gameMessage}</p>
        </div>
      </div>

      {/* 15x15 Ludo Board - Stylized distinctly for Blitz vs Classic */}
      <div className="px-3 flex items-center justify-center">
        <div
          id={isBlitz ? 'ludo-blitz-board' : 'ludo-classic-board'}
          className={`game-board p-2 grid grid-cols-15 grid-rows-15 relative ${
            isBlitz
              ? 'bg-[#030712] border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_35px_rgba(6,182,212,0.35),inset_0_0_18px_rgba(6,182,212,0.12)] gap-[1.5px]'
              : 'bg-[#0e1626] border-4 border-amber-900/60 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.85)] gap-[1px]'
          }`}
          style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
        >
          {/* Cyber HUD Corner Telemetry (Blitz Only) */}
          {isBlitz && (
            <>
              <div className="absolute top-1 left-1.5 text-[8px] font-mono font-bold text-cyan-400/70 select-none pointer-events-none">
                ⌜ALPHA
              </div>
              <div className="absolute top-1 right-1.5 text-[8px] font-mono font-bold text-cyan-400/70 select-none pointer-events-none">
                BETA⌝
              </div>
              <div className="absolute bottom-1 left-1.5 text-[8px] font-mono font-bold text-cyan-400/70 select-none pointer-events-none">
                ⌞GAMMA
              </div>
              <div className="absolute bottom-1 right-1.5 text-[8px] font-mono font-bold text-amber-400/80 select-none pointer-events-none">
                OMEGA⌟
              </div>
            </>
          )}

          {Array.from({ length: 15 }).map((_, r) =>
            Array.from({ length: 15 }).map((__, c) => {
              const tokens = getTokensAtCell(r, c);
              const cellBg = getCellClassName(r, c);
              const hasStar = isStarCell(r, c);
              const isCenter = r === 7 && c === 7;

              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative flex items-center justify-center rounded-[2px] ${cellBg}`}
                >
                  {/* Center Core 4-Triangle SVG (Classic) or Target Icon (Blitz) */}
                  {isCenter && (
                    isBlitz ? (
                      <Target className="w-3.5 h-3.5 absolute text-white animate-spin-slow drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                    ) : (
                      <div className="absolute inset-0 z-0 pointer-events-none">
                        <svg viewBox="0 0 100 100" className="w-full h-full">
                          <polygon points="0,0 100,0 50,50" fill="#059669" />
                          <polygon points="100,0 100,100 50,50" fill="#eab308" />
                          <polygon points="100,100 0,100 50,50" fill="#dc2626" />
                          <polygon points="0,100 0,0 50,50" fill="#2563eb" />
                        </svg>
                      </div>
                    )
                  )}

                  {/* Start Entry Arrows (Classic Mode) */}
                  {!isBlitz && (
                    <>
                      {r === 6 && c === 1 && <span className="text-[10px] font-black text-white pointer-events-none select-none">➡</span>}
                      {r === 8 && c === 13 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬅</span>}
                      {r === 1 && c === 8 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬇</span>}
                      {r === 13 && c === 6 && <span className="text-[10px] font-black text-white pointer-events-none select-none">⬆</span>}
                    </>
                  )}

                  {/* Star / Turbo Warp accelerator icon */}
                  {hasStar && !isCenter && (
                    isBlitz ? (
                      <Zap className="w-2.5 h-2.5 text-cyan-300 fill-cyan-300 absolute drop-shadow-[0_0_5px_rgba(6,182,212,0.95)] animate-pulse" />
                    ) : (
                      <Star className="w-2.5 h-2.5 text-slate-700 fill-slate-300 absolute opacity-80" />
                    )
                  )}

                  {/* Render Decorative Green & Blue 3D Pawns in unused bases */}
                  {!isBlitz && tokens.length === 0 && (
                    <>
                      {((r === 2 && c === 11) || (r === 2 && c === 12) || (r === 3 && c === 11) || (r === 3 && c === 12)) && (
                        <Ludo3DPawn color="green" sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5" />
                      )}
                      {((r === 11 && c === 2) || (r === 11 && c === 3) || (r === 12 && c === 2) || (r === 12 && c === 3)) && (
                        <Ludo3DPawn color="blue" sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5" />
                      )}
                    </>
                  )}

                  {/* Render Tokens */}
                  {tokens.length > 0 && (
                    <div className="relative flex items-center justify-center w-full h-full z-10">
                      {tokens.map((tok) => {
                        const isRed = tok.color === 'red';
                        const isMyToken = tok.color === myColor;
                        const myTokenObj = isMyToken
                          ? (isRed ? playerTokens : opponentTokens).find((t) => t.id === tok.id)
                          : null;
                        const isPlayable =
                          isMyTurn &&
                          isMyToken &&
                          myTokenObj &&
                          activeMoveVal &&
                          canTokenMove(myTokenObj, activeMoveVal);

                        if (!isBlitz) {
                          return (
                            <Ludo3DPawn
                              key={tok.id}
                              color={isRed ? 'red' : 'yellow'}
                              isPlayable={Boolean(isPlayable)}
                              sizeClassName="w-3.5 h-4 sm:w-4 sm:h-5"
                              onClick={() => {
                                if (myTokenObj && isPlayable) {
                                  sound.playClick();
                                  telegram.triggerHaptic('medium');
                                  onSelectPlayerToken(myTokenObj);
                                }
                              }}
                            />
                          );
                        }

                        return (
                          <motion.button
                            key={tok.id}
                            type="button"
                            whileHover={{ scale: isPlayable ? 1.35 : 1 }}
                            whileTap={{ scale: isPlayable ? 0.9 : 1 }}
                            onClick={() => {
                              if (myTokenObj && isPlayable) {
                                sound.playClick();
                                telegram.triggerHaptic('medium');
                                onSelectPlayerToken(myTokenObj);
                              }
                            }}
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center font-bold text-[8px] transition-all bg-gradient-to-br from-rose-500 via-fuchsia-600 to-purple-600 text-white border border-cyan-300 shadow-[0_0_12px_rgba(244,63,94,0.9)] ${
                              isPlayable ? 'ring-3 ring-cyan-300 scale-135 animate-bounce cursor-pointer z-20' : ''
                            }`}
                          >
                            {isRed ? (
                              <Zap className="w-2.5 h-2.5 fill-white text-white" />
                            ) : (
                              <Sparkles className="w-2.5 h-2.5 fill-slate-950 text-slate-950" />
                            )}
                          </motion.button>
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

      {/* Controls: Classic 3D Dice OR Blitz Number Cards */}
      <div className="px-4 pt-1.5">
        {isBlitz ? (
          /* BLITZ MODE: Strategic Cyber Deck */
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-mono px-1">
              <span className="flex items-center gap-1 text-cyan-400 font-bold">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>CYBER DECK // SELECT MANEUVER</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    telegram.triggerHaptic('selection');
                    setShowRulesModal(true);
                  }}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-sans font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3 h-3 text-cyan-400" />
                  <span>Rules</span>
                </button>
                <span className="text-amber-400 font-bold tracking-tight">Need 6 to deploy</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {blitzCards.map((card) => {
                const isSelected = selectedCardId === card.id;
                const isDeploy = card.value === 6;
                const myTokens = isHost ? playerTokens : opponentTokens;
                const canPlayCard = isMyTurn && myTokens.some((t) => canTokenMove(t, card.value));

                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    disabled={!isMyTurn || !canPlayCard}
                    whileHover={{ scale: isMyTurn && canPlayCard ? 1.05 : 1, y: isMyTurn && canPlayCard ? -2 : 0 }}
                    whileTap={{ scale: isMyTurn && canPlayCard ? 0.95 : 1 }}
                    onClick={() => {
                      if (!canPlayCard) return;
                      sound.playClick();
                      telegram.triggerHaptic('light');
                      setSelectedCardId(card.id);
                    }}
                    className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all relative overflow-hidden ${
                      isSelected
                        ? isDeploy
                          ? 'bg-gradient-to-b from-amber-500 to-yellow-600 border-white text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] -translate-y-1 cursor-pointer'
                          : 'bg-gradient-to-b from-cyan-500 to-indigo-600 border-white text-white shadow-[0_0_20px_rgba(6,182,212,0.5)] -translate-y-1 cursor-pointer'
                        : canPlayCard
                        ? isDeploy
                          ? 'bg-slate-900/90 border-amber-500/50 text-amber-400 hover:border-amber-300 hover:bg-slate-800 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                          : 'bg-slate-900/90 border-cyan-500/40 text-cyan-200 hover:border-cyan-300 hover:bg-slate-800 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'bg-slate-950/60 border-slate-800 text-slate-600 opacity-30 cursor-not-allowed grayscale'
                    }`}
                  >
                    <span className="text-xl font-black font-mono leading-none tracking-tight">
                      {card.value}
                    </span>
                    <span className={`text-[8px] uppercase font-mono font-bold tracking-wider px-1 rounded ${
                      isDeploy ? 'bg-amber-400/20 text-amber-300' : 'text-slate-400'
                    }`}>
                      {isDeploy ? 'DEPLOY/6' : 'STEPS'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : (
          /* CLASSIC MODE: 3D Dice Roll Button */
          <div className="flex items-center justify-between bg-slate-900/90 border border-white/10 rounded-2xl p-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg border border-amber-300 transition-transform ${
                  isRolling ? 'rotate-180 scale-110' : ''
                }`}
              >
                {diceValue !== null ? diceValue : <Dices className="w-6 h-6" />}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white block">Classic Dice Roll</span>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      telegram.triggerHaptic('selection');
                      setShowRulesModal(true);
                    }}
                    className="px-1.5 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-2.5 h-2.5 text-amber-400" />
                    <span>Rules</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      telegram.triggerHaptic('selection');
                      setShowFairnessModal(true);
                    }}
                    className="px-1.5 py-0.2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[9px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="Inspect Provably Fair Cryptographic Dice Commitment"
                  >
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Fairness</span>
                  </button>
                </div>
                <span className="text-[10px] text-slate-400">
                  {isMyTurn
                    ? diceValue
                      ? `Rolled ${diceValue}! Select token`
                      : 'Tap roll button (Need 6 to deploy)'
                    : isRolling
                    ? 'Opponent rolling dice...'
                    : diceValue !== null
                    ? `Opponent rolled ${diceValue}! Executing move...`
                    : 'Waiting for opponent roll...'}
                </span>
              </div>
            </div>

            <motion.button
              id="btn-roll-dice"
              whileHover={{ scale: isMyTurn && !isRolling && diceValue === null ? 1.04 : 1 }}
              whileTap={{ scale: isMyTurn && !isRolling && diceValue === null ? 0.96 : 1 }}
              disabled={!isMyTurn || isRolling || diceValue !== null}
              onClick={() => {
                sound.playDiceRoll();
                telegram.triggerHaptic('medium');
                rollDice();
              }}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Dices className="w-4 h-4" />
              <span>{isRolling ? 'Rolling...' : 'Roll Dice'}</span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Game Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        initialMode={isBlitz ? 'ludo_blitz' : 'ludo_classic'}
      />

      {/* Provably Fair Cryptographic Inspector Modal */}
      <ProvablyFairModal
        isOpen={showFairnessModal}
        onClose={() => setShowFairnessModal(false)}
        serverSeedHash={serverSeedHash}
        clientSeed={clientSeed}
        nonce={nonce}
        lastRoll={diceValue}
      />

      {/* Match Result Modal */}
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
