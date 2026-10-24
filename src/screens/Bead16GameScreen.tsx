import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap,
  Clock,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { TURN_MODE_SECONDS } from '../types';
import {
  BEAD16_NODES,
  BeadPiece,
  BeadPlayer,
  Move,
  createInitialBead16Board,
  getLegalBead16Moves,
  applyBead16Move,
  checkBead16Winner,
  getBestBead16AIMove,
} from '../utils/bead16Engine';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { getDynamicAvatarUrl } from '../utils/avatar';
import { EscrowBanner } from '../components/EscrowBanner';
import { MatchEndModal } from '../components/MatchEndModal';
import { TurnTimerBar } from '../components/TurnTimerBar';
import { GameRulesModal } from '../components/GameRulesModal';
import { TeteCoinMatchService } from '../services/teteCoinMatchService';

export const Bead16GameScreen: React.FC = () => {
  const { activeMatch, user, settleMatch, startMatch, startCoinAiMatch, updateTeteCoinBalance, completeCoinAiMatch, cancelMatch, sendP2pStateUpdate } = useGame();
  const isCoinMatch = Boolean(activeMatch?.coinMatchId);

  const [board, setBoard] = useState<BeadPiece[]>(() => createInitialBead16Board());
  const [turn, setTurn] = useState<BeadPlayer>('p2'); // p2: Blue (User starts at bottom)
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [mustContinueJumpNode, setMustContinueJumpNode] = useState<number | null>(null);
  const [matchResult, setMatchResult] = useState<'player' | 'opponent' | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastMoveTrail, setLastMoveTrail] = useState<{ from: number; to: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isTimeoutPending, setIsTimeoutPending] = useState(false);
  const [serverTurnDeadlineAt, setServerTurnDeadlineAt] = useState<number | null>(null);
  const [serverSequence, setServerSequence] = useState(0);

  useEffect(() => {
    if (!activeMatch?.coinMatchId) return;
    let cancelled = false;
    setIsAiThinking(true);
    TeteCoinMatchService.load(activeMatch.coinMatchId).then((match) => {
      if (cancelled) return;
      setBoard(match.state.board);
      setTurn(match.state.turn);
      setMustContinueJumpNode(match.state.mustContinueJumpNode);
      setLastMoveTrail(match.state.lastMoveTrail);
      setServerSequence(match.state.sequence);
      setServerTurnDeadlineAt(match.state.turnDeadlineAt);
      setTurnTimeLeft(Math.max(0, Math.ceil((match.state.turnDeadlineAt - Date.now()) / 1000)));
      updateTeteCoinBalance(match.balance);
      if (match.status === 'SETTLED' && match.winner) {
        const outcome = match.winner === 'p2' ? 'player' : 'opponent';
        setMatchResult(outcome);
        completeCoinAiMatch(outcome);
      }
    }).catch((error) => {
      if (!cancelled) console.warn('Could not restore authoritative Tete Coin match:', error);
    }).finally(() => {
      if (!cancelled) setIsAiThinking(false);
    });
    return () => { cancelled = true; };
  }, [activeMatch?.coinMatchId, updateTeteCoinBalance, completeCoinAiMatch]);

  // Is local user the Host of this table?
  const isHost = useMemo(() => {
    if (!activeMatch?.hostUsername) return false;
    return activeMatch.hostUsername.toLowerCase() === user.username.toLowerCase();
  }, [activeMatch?.hostUsername, user.username]);

  // Is opponent a Bot?
  const isBotMatch = useMemo(() => {
    if (!activeMatch) return false;
    if (activeMatch.isVsAi !== undefined) return activeMatch.isVsAi;
    if (!activeMatch.opponent) return false;
    const oppName = (activeMatch.opponent.username || activeMatch.opponent.displayName || '').toLowerCase();
    const oppId = (activeMatch.opponent.id || '').toLowerCase();
    return oppName.includes('cyber bot') || oppName.includes('cyberbot') || oppId.startsWith('bot_');
  }, [activeMatch]);

  // Player role assignment for the local client:
  // - In Bot matches: User = P2 (Blue, Bottom), Bot = P1 (Red, Top)
  // - In P2P human matches: Host = P1 (Red, Top), Joiner = P2 (Blue, Bottom)
  const myRole: BeadPlayer = isBotMatch ? 'p2' : (isHost ? 'p1' : 'p2');
  const oppRole: BeadPlayer = myRole === 'p1' ? 'p2' : 'p1';
  const isMyTurn = turn === myRole;

  // Turn Countdown Timer: 15 seconds per turn
  const maxTurnTime = TURN_MODE_SECONDS[activeMatch?.turnMode || 'casual'];
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(maxTurnTime);

  // Reset turn countdown timer whenever turn or multi-jump state updates
  useEffect(() => {
    const deadline = isCoinMatch ? (serverTurnDeadlineAt || activeMatch?.turnDeadlineAt) : (!isBotMatch ? activeMatch?.turnDeadlineAt : undefined);
    setTurnTimeLeft(deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : maxTurnTime);
  }, [turn, mustContinueJumpNode, maxTurnTime, isBotMatch, isCoinMatch, serverTurnDeadlineAt, activeMatch?.turnDeadlineAt]);

  // Decrement turn timer every 1s
  useEffect(() => {
    if (matchResult) return;

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        const next = prev - 1;
        if (isMyTurn && next <= 5 && next > 0 && soundEnabled) {
          sound.playTick();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [turn, isMyTurn, matchResult, soundEnabled]);

  // Local P2P timeouts switch turns. Coin matches ask the server to settle only
  // after its persisted deadline has elapsed.
  useEffect(() => {
    if (matchResult || turnTimeLeft > 0 || isCoinMatch) return;

    sound.playTimeout();
    telegram.triggerHaptic('warning');

    // Automatically switch turn to opponent on timeout
    const nextTurn: BeadPlayer = turn === 'p1' ? 'p2' : 'p1';
    setSelectedNode(null);
    setMustContinueJumpNode(null);
    setTurn(nextTurn);

    if (!isBotMatch) {
      sendP2pStateUpdate({
        board,
        turn: nextTurn,
        mustContinueJumpNode: null,
        lastMoveTrail,
        winner: null,
      });
    }
  }, [turnTimeLeft, matchResult, turn, board, lastMoveTrail, isBotMatch, sendP2pStateUpdate, isCoinMatch]);

  // Player 1 (Red / Top) Card Info
  const p1Name = isBotMatch
    ? (activeMatch?.opponent?.displayName || activeMatch?.opponent?.username || 'Cyber Bot')
    : (isHost ? (user.displayName || user.username) : (activeMatch?.opponent?.displayName || activeMatch?.opponent?.username || activeMatch?.hostUsername || 'Host'));

  const p1Avatar = isBotMatch
    ? (activeMatch?.opponent?.avatarUrl || getDynamicAvatarUrl('CyberBot'))
    : (isHost ? (user.avatarUrl || getDynamicAvatarUrl(user.username)) : (activeMatch?.opponent?.avatarUrl || getDynamicAvatarUrl(activeMatch?.hostUsername || 'Host')));

  // Player 2 (Blue / Bottom) Card Info
  const p2Name = isBotMatch
    ? (user.displayName || user.username)
    : (isHost ? (activeMatch?.opponent?.displayName || activeMatch?.opponent?.username || 'Challenger') : (user.displayName || user.username));

  const p2Avatar = isBotMatch
    ? (user.avatarUrl || getDynamicAvatarUrl(user.username))
    : (isHost ? (activeMatch?.opponent?.avatarUrl || getDynamicAvatarUrl(activeMatch?.opponent?.username || 'Challenger')) : (user.avatarUrl || getDynamicAvatarUrl(user.username)));

  // Derived user & opponent details for standardized header/footer:
  const oppName = myRole === 'p1' ? p2Name : p1Name;
  const oppAvatar = myRole === 'p1' ? p2Avatar : p1Avatar;
  const oppColorLabel = oppRole === 'p1' ? 'Red' : 'Blue';

  const myName = myRole === 'p1' ? p1Name : p2Name;
  const myAvatar = myRole === 'p1' ? p1Avatar : p2Avatar;
  const myColorLabel = myRole === 'p1' ? 'Red' : 'Blue';

  // Legal moves calculation for current turn
  const legalMoves = useMemo(() => {
    if (matchResult) return [];
    return getLegalBead16Moves(board, turn, mustContinueJumpNode);
  }, [board, turn, mustContinueJumpNode, matchResult]);

  // Valid destination node IDs from current selected node
  const validDestinationNodes = useMemo(() => {
    if (selectedNode === null) return [];
    return legalMoves
      .filter((m) => m.from === selectedNode)
      .map((m) => m.to);
  }, [selectedNode, legalMoves]);

  // Captured bead count tallies (started at 16 each)
  const p1Count = useMemo(() => board.filter((p) => p === 'p1').length, [board]);
  const p2Count = useMemo(() => board.filter((p) => p === 'p2').length, [board]);
  const p1Captured = 16 - p2Count; // Red captured Blue beads
  const p2Captured = 16 - p1Count; // Blue captured Red beads

  const oppCaptured = myRole === 'p1' ? p2Captured : p1Captured;
  const oppRemaining = myRole === 'p1' ? p2Count : p1Count;

  const myCaptured = myRole === 'p1' ? p1Captured : p2Captured;
  const myRemaining = myRole === 'p1' ? p1Count : p2Count;

  // Status message
  const gameMessage = useMemo(() => {
    if (matchResult) {
      return matchResult === 'player' ? 'Victory! Escrow pot securely settled into your vault.' : 'Defeat! Better luck in the next battle.';
    }
    if (mustContinueJumpNode !== null) {
      return '⚡ Multi-Jump Available! Select your next capture node.';
    }
    if (isMyTurn) {
      return `Your Turn (${myColorLabel}): Select a bead to move or jump`;
    }
    return isBotMatch
      ? `@${oppName} thinking move...`
      : `Opponent Turn (${oppColorLabel} - @${oppName}): Waiting for move...`;
  }, [matchResult, mustContinueJumpNode, isMyTurn, myColorLabel, isBotMatch, oppName, oppColorLabel]);

  // Handle player selecting a node
  const handleNodeClick = (nodeId: number) => {
    if (matchResult || isAiThinking || isTimeoutPending) return;

    // Only allow input on local user's turn
    if (!isMyTurn) return;

    const pieceAtNode = board[nodeId];

    // 1. Select piece belonging to local user (myRole)
    if (pieceAtNode === myRole) {
      if (mustContinueJumpNode !== null && nodeId !== mustContinueJumpNode) {
        return; // Restricted to multi-jump piece
      }
      setSelectedNode(nodeId);
      if (soundEnabled) sound.playClick();
      return;
    }

    // 2. Make move to selected destination
    if (selectedNode !== null && validDestinationNodes.includes(nodeId)) {
      const targetMove = legalMoves.find((m) => m.from === selectedNode && m.to === nodeId);
      if (targetMove) {
        executeMove(targetMove);
      }
    }
  };

  // Handle game completion and settlement
  const handleMatchEnd = useCallback(
    (winner: BeadPlayer) => {
      const isWinner = winner === myRole;
      const outcome: 'player' | 'opponent' = isWinner ? 'player' : 'opponent';
      setMatchResult(outcome);

      if (!isWinner && soundEnabled) {
        sound.playLoss();
      }

      // Auto-settle escrow pot
      if (activeMatch && activeMatch.status !== 'completed' && !activeMatch.coinMatchId) {
        settleMatch(outcome);
      } else if (activeMatch?.coinMatchId) {
        completeCoinAiMatch(outcome);
      }
    },
    [myRole, soundEnabled, activeMatch, settleMatch, completeCoinAiMatch]
  );

  useEffect(() => {
    if (!isCoinMatch || !activeMatch?.coinMatchId || matchResult || turnTimeLeft > 0 || isTimeoutPending) return;
    setIsTimeoutPending(true);
    sound.playTimeout();
    TeteCoinMatchService.timeout(activeMatch.coinMatchId).then((response) => {
      setBoard(response.state.board);
      setTurn(response.state.turn);
      updateTeteCoinBalance(response.balance);
      if (response.status === 'SETTLED' && response.winner) handleMatchEnd(response.winner);
    }).catch((error: any) => {
      if (Number.isFinite(error?.remainingSeconds)) setTurnTimeLeft(error.remainingSeconds);
      else setTurnTimeLeft(5);
    }).finally(() => setIsTimeoutPending(false));
  }, [isCoinMatch, activeMatch?.coinMatchId, matchResult, turnTimeLeft, isTimeoutPending, handleMatchEnd, updateTeteCoinBalance]);

  // Execute a move on the board
  const executeMove = (move: Move) => {
    if (activeMatch?.coinMatchId) {
      setIsAiThinking(true);
      TeteCoinMatchService.move(activeMatch.coinMatchId, move.from, move.to, serverSequence).then((response) => {
        setBoard(response.state.board);
        setTurn(response.state.turn);
        setMustContinueJumpNode(response.state.mustContinueJumpNode);
        setLastMoveTrail(response.state.lastMoveTrail);
        setServerSequence(response.state.sequence);
        setSelectedNode(null);
        setServerTurnDeadlineAt(response.state.turnDeadlineAt);
        setTurnTimeLeft(Math.max(0, Math.ceil((response.state.turnDeadlineAt - Date.now()) / 1000)));
        updateTeteCoinBalance(response.balance);
        if (response.status === 'SETTLED' && response.winner) {
          handleMatchEnd(response.winner);
        } else if (soundEnabled) {
          sound.playMove();
        }
      }).catch((error) => {
        console.warn('Tete Coin move rejected by match server:', error);
        if (error?.status === 409) {
          TeteCoinMatchService.load(activeMatch.coinMatchId).then((latest) => {
            setBoard(latest.state.board);
            setTurn(latest.state.turn);
            setMustContinueJumpNode(latest.state.mustContinueJumpNode);
            setLastMoveTrail(latest.state.lastMoveTrail);
            setServerSequence(latest.state.sequence);
            setServerTurnDeadlineAt(latest.state.turnDeadlineAt);
            setTurnTimeLeft(Math.max(0, Math.ceil((latest.state.turnDeadlineAt - Date.now()) / 1000)));
            updateTeteCoinBalance(latest.balance);
            if (latest.status === 'SETTLED' && latest.winner) handleMatchEnd(latest.winner);
          }).catch((loadError) => console.warn('Could not reload authoritative match state:', loadError));
        }
      }).finally(() => setIsAiThinking(false));
      return;
    }

    const nextBoard = applyBead16Move(board, move);
    setBoard(nextBoard);
    setLastMoveTrail({ from: move.from, to: move.to });

    const isCapture = move.captured !== undefined && move.captured !== null;
    if (isCapture) {
      if (soundEnabled) sound.playCapture(); // Capture sound effect
    } else {
      if (soundEnabled) sound.playMove();
    }

    let nextTurn = turn;
    let nextMustJump: number | null = null;
    let winnerRole: BeadPlayer | null = null;

    // Check multi-jump opportunity if this move was a capture
    if (isCapture) {
      const followUpJumps = getLegalBead16Moves(nextBoard, turn, move.to).filter((m) => m.captured !== undefined);
      if (followUpJumps.length > 0) {
        setSelectedNode(move.to);
        setMustContinueJumpNode(move.to);
        nextMustJump = move.to;

        if (!isBotMatch) {
          sendP2pStateUpdate({
            board: nextBoard,
            turn: nextTurn,
            mustContinueJumpNode: nextMustJump,
            lastMoveTrail: { from: move.from, to: move.to },
          });
        }
        return; // Stay on same turn for multi-jump!
      }
    }

    // Reset multi-jump and check win condition
    setSelectedNode(null);
    setMustContinueJumpNode(null);

    const { winner } = checkBead16Winner(nextBoard);
    if (winner) {
      winnerRole = winner;
      handleMatchEnd(winner);
    } else {
      // Switch turn
      nextTurn = turn === 'p1' ? 'p2' : 'p1';
      setTurn(nextTurn);
    }

    if (!isBotMatch) {
      sendP2pStateUpdate({
        board: nextBoard,
        turn: nextTurn,
        mustContinueJumpNode: null,
        lastMoveTrail: { from: move.from, to: move.to },
        winner: winnerRole,
      });
    }
  };

  // Synchronize incoming real-time P2P opponent moves via custom event
  useEffect(() => {
    if (isBotMatch) return;

    const handleRemoteState = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const s = customEvt.detail;
      if (!s) return;

      if (s.board) {
        setBoard(s.board);
      }
      if (s.turn) {
        setTurn(s.turn);
      }
      if (s.mustContinueJumpNode !== undefined) {
        setMustContinueJumpNode(s.mustContinueJumpNode);
      }
      if (s.lastMoveTrail !== undefined) {
        setLastMoveTrail(s.lastMoveTrail);
      }

      if (s.winner) {
        handleMatchEnd(s.winner);
      } else if (s.board) {
        const { winner } = checkBead16Winner(s.board);
        if (winner && !matchResult) {
          handleMatchEnd(winner);
        }
      }

      if (soundEnabled) {
        sound.playMove();
      }
    };

    window.addEventListener('p2p_game_state_update', handleRemoteState);
    return () => window.removeEventListener('p2p_game_state_update', handleRemoteState);
  }, [isBotMatch, matchResult, handleMatchEnd, soundEnabled]);

  // Trigger AI Bot Turn ONLY if playing against an AI bot
  useEffect(() => {
    if (isBotMatch && !isCoinMatch && turn === 'p1' && !matchResult && !isAiThinking) {
      setIsAiThinking(true);
      const timer = setTimeout(() => {
        const aiMove = getBestBead16AIMove(board, 'p1');
        if (aiMove) {
          executeMove(aiMove);
        } else {
          // AI has no moves, P2 (User) wins!
          handleMatchEnd('p2');
        }
        setIsAiThinking(false);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [turn, board, matchResult, isAiThinking, isBotMatch, isCoinMatch]);

  const handleRematch = () => {
    const initialBoard = createInitialBead16Board();
    setBoard(initialBoard);
    setTurn('p2');
    setSelectedNode(null);
    setMustContinueJumpNode(null);
    setMatchResult(null);
    setLastMoveTrail(null);

    if (!isBotMatch) {
      sendP2pStateUpdate({
        board: initialBoard,
        turn: 'p2',
        mustContinueJumpNode: null,
        lastMoveTrail: null,
        winner: null,
      });
    }

    if (activeMatch?.coinMatchId) {
      void startCoinAiMatch(activeMatch.stake);
    } else if (activeMatch) {
      startMatch(activeMatch.gameMode, activeMatch.stake, activeMatch.isPrivate, activeMatch.roomCode);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-slate-950 text-slate-100 select-none pb-3 overflow-hidden">
      {/* Top Escrow Bar (Unified Across All Games) */}
      <EscrowBanner gameTitle="Bead 16 Tactics" />

      {/* Opponent Status Header */}
      <div className="px-4 py-1.5 flex items-center justify-between bg-slate-900/40 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img
              src={oppAvatar}
              alt={oppName}
              className={`w-8 h-8 rounded-xl object-cover ring-2 transition-all ${
                turn === oppRole ? 'ring-rose-500 shadow-md shadow-rose-500/30 scale-105' : 'ring-white/10 opacity-75'
              }`}
            />
            {turn === oppRole && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 block leading-tight">
                @{oppName}
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                oppRole === 'p1'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}>
                {oppRole === 'p1' ? 'P1 (Red)' : 'P2 (Blue)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Captured: <strong className="text-rose-400 font-mono">+{oppCaptured}</strong> | Left: <strong className="text-slate-300 font-mono">{oppRemaining}/16</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mustContinueJumpNode !== null && !isMyTurn && (
            <span className="text-[10px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
              <Zap className="w-3 h-3 text-amber-400" />
              Chain Jump!
            </span>
          )}

          {isMyTurn ? (
            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
              Your Turn ({myColorLabel})
            </span>
          ) : (
            <span className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
              Opponent's Turn ({oppColorLabel})
            </span>
          )}
        </div>
      </div>

      {/* Turn Countdown Timer (15s for Bead 16) */}
      <TurnTimerBar
        timeLeft={turnTimeLeft}
        maxTime={maxTurnTime}
        isPlayerTurn={isMyTurn}
        theme="bead16"
      />

      {/* Game Message & Status Alert Banner */}
      <div className="px-4 py-1">
        <div className={`py-1.5 px-3 rounded-full text-center max-w-md mx-auto shadow-sm flex items-center justify-center gap-1.5 transition-colors ${
          mustContinueJumpNode !== null
            ? 'bg-amber-950/80 border border-amber-500/40 text-amber-200'
            : isMyTurn
            ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-200'
            : 'bg-slate-900/90 border border-white/10 text-slate-300'
        }`}>
          {mustContinueJumpNode !== null ? (
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" />
          ) : isMyTurn ? (
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          ) : (
            <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-spin" />
          )}
          <p className="text-[11px] font-semibold truncate">{gameMessage}</p>
        </div>
      </div>

      {/* Main Bead 16 Board */}
      <div className="px-2 sm:px-3 flex items-center justify-center flex-1">
        <div className="w-full max-w-[360px] sm:max-w-[380px] aspect-[400/520] relative bg-[#0f172a] border-4 border-slate-800 rounded-3xl shadow-2xl p-2 backdrop-blur-xl">
          <svg viewBox="0 0 400 520" className="w-full h-full drop-shadow-md overflow-visible">
            <defs>
              {/* Radial Gradients for 3D Tokens */}
              <radialGradient id="redBeadGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="60%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#991b1b" />
              </radialGradient>
              <radialGradient id="blueBeadGrad" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="60%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#075985" />
              </radialGradient>

              {/* Glow Filters */}
              <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Render Board Connection Lines */}
            <g stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2.5" strokeLinecap="round">
              {/* Outer boundary lines for Top Triangle */}
              <line x1="200" y1="30" x2="120" y2="100" />
              <line x1="200" y1="30" x2="280" y2="100" />
              <line x1="120" y1="100" x2="280" y2="100" />
              <line x1="160" y1="65" x2="240" y2="65" />
              <line x1="200" y1="30" x2="200" y2="100" />

              {/* Outer boundary lines for Bottom Triangle */}
              <line x1="120" y1="450" x2="280" y2="450" />
              <line x1="160" y1="485" x2="240" y2="485" />
              <line x1="120" y1="450" x2="200" y2="485" />
              <line x1="280" y1="450" x2="200" y2="485" />
              <line x1="200" y1="450" x2="200" y2="485" />

              {/* Main 5x5 Grid Box Outline */}
              <rect x="40" y="145" width="320" height="260" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="3" rx="4" />

              {/* Main Grid Horizontal Lines */}
              <line x1="40" y1="210" x2="360" y2="210" />
              <line x1="40" y1="275" x2="360" y2="275" stroke="#38bdf8" strokeWidth="3" opacity="0.6" />
              <line x1="40" y1="340" x2="360" y2="340" />

              {/* Main Grid Vertical Lines */}
              <line x1="120" y1="145" x2="120" y2="405" />
              <line x1="200" y1="145" x2="200" y2="405" />
              <line x1="280" y1="145" x2="280" y2="405" />

              {/* Diagonal Grid Lines (Crossing X pattern) */}
              <line x1="40" y1="145" x2="360" y2="405" />
              <line x1="360" y1="145" x2="40" y2="405" />

              <line x1="40" y1="275" x2="200" y2="145" />
              <line x1="200" y1="145" x2="360" y2="275" />
              <line x1="40" y1="275" x2="200" y2="405" />
              <line x1="200" y1="405" x2="360" y2="275" />

              {/* Triangle-to-Grid Connections */}
              <line x1="120" y1="100" x2="120" y2="145" />
              <line x1="200" y1="100" x2="200" y2="145" />
              <line x1="280" y1="100" x2="280" y2="145" />

              <line x1="120" y1="405" x2="120" y2="450" />
              <line x1="200" y1="405" x2="200" y2="450" />
              <line x1="280" y1="405" x2="280" y2="450" />
            </g>

            {/* Render Move Trail */}
            {lastMoveTrail && (
              <line
                x1={BEAD16_NODES[lastMoveTrail.from].x}
                y1={BEAD16_NODES[lastMoveTrail.from].y}
                x2={BEAD16_NODES[lastMoveTrail.to].x}
                y2={BEAD16_NODES[lastMoveTrail.to].y}
                stroke="#38bdf8"
                strokeWidth="4"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
            )}

            {/* Render 37 Board Nodes & Beads */}
            {BEAD16_NODES.map((node) => {
              const piece = board[node.id];
              const isSelected = selectedNode === node.id;
              const isValidTarget = validDestinationNodes.includes(node.id);
              const beadRadius = isSelected ? 16 : 14;

              return (
                <g key={node.id} className="cursor-pointer" onClick={() => handleNodeClick(node.id)}>
                  {/* Base Node Background Ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="10"
                    fill="#0f172a"
                    stroke={isValidTarget ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)'}
                    strokeWidth={isValidTarget ? '3' : '1.5'}
                  />

                  {/* Highlight Glowing Pulse Ring for Valid Target Destination Nodes */}
                  {isValidTarget && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="15"
                      fill="rgba(56, 189, 248, 0.25)"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      className="animate-pulse"
                    />
                  )}

                  {/* Selection Ring Glow for Selected Bead */}
                  {isSelected && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r="20"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2.5"
                      strokeDasharray="4 3"
                      className="animate-pulse"
                    />
                  )}

                  {/* Render 3D Star Bead Piece */}
                  {piece !== null && (
                    <g>
                      {/* Drop Shadow */}
                      <circle cx={node.x + 1.5} cy={node.y + 2.5} r={beadRadius} fill="rgba(0,0,0,0.5)" />

                      {/* Main Bead Token */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={beadRadius}
                        fill={piece === 'p1' ? 'url(#redBeadGrad)' : 'url(#blueBeadGrad)'}
                        stroke={isSelected ? '#fbbf24' : piece === 'p1' ? '#fca5a5' : '#7dd3fc'}
                        strokeWidth={isSelected ? '3' : '2'}
                        filter="url(#neonGlow)"
                      />

                      {/* Star Emblem inside Token */}
                      <polygon
                        points={`${node.x},${node.y - (isSelected ? 7 : 6)} ${node.x + 2},${node.y - 2} ${node.x + (isSelected ? 7 : 6)},${node.y - 2} ${
                          node.x + 3
                        },${node.y + 1} ${node.x + 4},${node.y + (isSelected ? 6 : 5)} ${node.x},${node.y + 3} ${node.x - 4},${
                          node.y + (isSelected ? 6 : 5)
                        } ${node.x - 3},${node.y + 1} ${node.x - (isSelected ? 7 : 6)},${node.y - 2} ${node.x - 2},${node.y - 2}`}
                        fill="#ffffff"
                        opacity="0.95"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Player Status Footer (Bottom Player Zone) */}
      <div className="px-4 py-1.5 flex items-center justify-between bg-slate-900/40 border-t border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <img
              src={myAvatar}
              alt={myName}
              className={`w-8 h-8 rounded-xl object-cover ring-2 transition-all ${
                turn === myRole ? 'ring-cyan-400 shadow-md shadow-cyan-500/30 scale-105' : 'ring-white/10 opacity-75'
              }`}
            />
            {turn === myRole && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-200 block leading-tight">
                @{myName} <span className="text-amber-400">(You)</span>
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold border ${
                myRole === 'p1'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}>
                {myRole === 'p1' ? 'P1 (Red)' : 'P2 (Blue)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Captured: <strong className="text-cyan-400 font-mono">+{myCaptured}</strong> | Left: <strong className="text-slate-300 font-mono">{myRemaining}/16</strong>
            </span>
          </div>
        </div>

        {/* Audio Toggle Button */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-800/80 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Toggle Audio Effects"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
        </button>
      </div>

      {/* Official Game Rules Modal */}
      <GameRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        initialMode="bead16"
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
