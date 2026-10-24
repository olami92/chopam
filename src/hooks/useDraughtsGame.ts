import { useState, useEffect, useCallback, useRef } from 'react';
import { DraughtsPiece, DraughtsPieceColor, DraughtsMove, TURN_MODE_SECONDS } from '../types';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { useGame } from '../context/GameContext';

export const BOARD_SIZE = 10; // 10x10 International & Nigerian Draughts
export const PIECES_PER_SIDE = 20; // 4 rows of 5 pieces

export function createInitialDraughtsBoard(): DraughtsPiece[] {
  const pieces: DraughtsPiece[] = [];
  let idCounter = 1;

  // Crimson (Opponent) on rows 0, 1, 2, 3 (20 pieces on dark squares)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        pieces.push({
          id: `c_${idCounter++}`,
          color: 'crimson',
          row: r,
          col: c,
          isKing: false,
        });
      }
    }
  }

  // Gold (Player) on rows 6, 7, 8, 9 (20 pieces on dark squares)
  for (let r = 6; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        pieces.push({
          id: `g_${idCounter++}`,
          color: 'gold',
          row: r,
          col: c,
          isKing: false,
        });
      }
    }
  }

  return pieces;
}

export function useDraughtsGame(onGameOver: (winner: 'player' | 'opponent') => void) {
  const { recordReplayStep, user, activeMatch, sendP2pStateUpdate, submitCoinAiAction, timeoutCoinAiMatch } = useGame();
  const [pieces, setPieces] = useState<DraughtsPiece[]>(createInitialDraughtsBoard);
  const [selectedPiece, setSelectedPiece] = useState<DraughtsPiece | null>(null);
  const [validMoves, setValidMoves] = useState<DraughtsMove[]>([]);
  const [turn, setTurn] = useState<'player' | 'opponent'>('player');
  const [playerCapturedCount, setPlayerCapturedCount] = useState(0);
  const [opponentCapturedCount, setOpponentCapturedCount] = useState(0);
  const [gameMessage, setGameMessage] = useState<string>('Your turn. Tap a piece to move.');
  const [lastAction, setLastAction] = useState<string>('10x10 Draughts match began');
  const [chainPieceId, setChainPieceId] = useState<string | null>(null);
  const aiThinkingRef = useRef(false);
  const coinMovePendingRef = useRef(false);

  const isP2P = activeMatch?.isVsAi === false;
  const isHost = activeMatch
    ? activeMatch.hostUsername
      ? activeMatch.hostUsername.toLowerCase() === (user?.username || '').toLowerCase()
      : activeMatch.opponent.username.toLowerCase() !== (user?.username || '').toLowerCase()
    : true;
  const myColor: DraughtsPieceColor = isP2P ? (isHost ? 'gold' : 'crimson') : 'gold';
  const oppColor: DraughtsPieceColor = isP2P ? (isHost ? 'crimson' : 'gold') : 'crimson';
  const isMyTurn = isP2P ? (isHost ? turn === 'player' : turn === 'opponent') : turn === 'player';

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Synchronize incoming real-time P2P opponent moves via custom event
  useEffect(() => {
    const handleRemoteState = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const s = customEvt.detail;
      if (s) {
        if (s.pieces) setPieces(s.pieces);
        if (s.turn) setTurn(s.turn);
        setSelectedPiece(null);
        setValidMoves([]);
        setChainPieceId(s.chainPieceId || null);

        const goldCaps = typeof s.goldCapturedCount === 'number' ? s.goldCapturedCount : (typeof s.playerCapturedCount === 'number' ? s.playerCapturedCount : 0);
        const crimsonCaps = typeof s.crimsonCapturedCount === 'number' ? s.crimsonCapturedCount : (typeof s.opponentCapturedCount === 'number' ? s.opponentCapturedCount : 0);

        if (isHost) {
          setPlayerCapturedCount(goldCaps);
          setOpponentCapturedCount(crimsonCaps);
        } else {
          setPlayerCapturedCount(crimsonCaps);
          setOpponentCapturedCount(goldCaps);
        }

        if (s.lastAction) setLastAction(s.lastAction);

        if (s.isGameOver) {
          const localWon = s.winnerRole === (isHost ? 'host' : 'challenger');
          const winner = localWon ? 'player' : 'opponent';
          sound.playWin();
          if (winner === 'player') {
            telegram.triggerHaptic('success');
          } else {
            telegram.triggerHaptic('error');
          }
          onGameOverRef.current(winner);
        }
      }
    };

    window.addEventListener('p2p_game_state_update', handleRemoteState);
    return () => window.removeEventListener('p2p_game_state_update', handleRemoteState);
  }, [isHost]);

  // Turn Countdown Timer: 15s for Draughts
  const maxTurnTime = TURN_MODE_SECONDS[activeMatch?.turnMode || 'casual'];
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(maxTurnTime);

  // Find piece at (row, col)
  const getPieceAt = useCallback(
    (boardPieces: DraughtsPiece[], r: number, c: number) => {
      return boardPieces.find((p) => p.row === r && p.col === c);
    },
    []
  );

  // Get raw moves (steps + jumps) for a piece
  const getAllRawMovesForPiece = useCallback(
    (piece: DraughtsPiece, boardPieces: DraughtsPiece[]): { steps: DraughtsMove[]; jumps: DraughtsMove[] } => {
      const steps: DraughtsMove[] = [];
      const jumps: DraughtsMove[] = [];
      const { row, col, color, isKing } = piece;

      // 1. Regular single-step diagonal forward moves
      // Gold moves row - 1 (up), Crimson moves row + 1 (down), Kings move both
      const forwardDirections = isKing ? [-1, 1] : color === 'gold' ? [-1] : [1];

      for (const dRow of forwardDirections) {
        for (const dCol of [-1, 1]) {
          const targetRow = row + dRow;
          const targetCol = col + dCol;

          if (targetRow >= 0 && targetRow < BOARD_SIZE && targetCol >= 0 && targetCol < BOARD_SIZE) {
            if (!getPieceAt(boardPieces, targetRow, targetCol)) {
              steps.push({
                fromRow: row,
                fromCol: col,
                toRow: targetRow,
                toCol: targetCol,
              });
            }
          }
        }
      }

      // 2. Jump captures (in 10x10 Draughts, all pieces can capture forwards & backwards)
      const jumpDirections = [-1, 1];
      for (const dRow of jumpDirections) {
        for (const dCol of [-1, 1]) {
          const midRow = row + dRow;
          const midCol = col + dCol;
          const landingRow = row + dRow * 2;
          const landingCol = col + dCol * 2;

          if (landingRow >= 0 && landingRow < BOARD_SIZE && landingCol >= 0 && landingCol < BOARD_SIZE) {
            const midPiece = getPieceAt(boardPieces, midRow, midCol);
            const landingPiece = getPieceAt(boardPieces, landingRow, landingCol);

            // Must jump over opponent piece into empty landing tile
            if (midPiece && midPiece.color !== color && !landingPiece) {
              jumps.push({
                fromRow: row,
                fromCol: col,
                toRow: landingRow,
                toCol: landingCol,
                capturedPiece: midPiece,
              });
            }
          }
        }
      }

      return { steps, jumps };
    },
    [getPieceAt]
  );

  // Check if a color has any mandatory captures anywhere on the board
  const getCapturesForColor = useCallback(
    (color: DraughtsPieceColor, boardPieces: DraughtsPiece[]): { piece: DraughtsPiece; moves: DraughtsMove[] }[] => {
      const activePieces = boardPieces.filter((p) => p.color === color);
      const results: { piece: DraughtsPiece; moves: DraughtsMove[] }[] = [];

      for (const p of activePieces) {
        const { jumps } = getAllRawMovesForPiece(p, boardPieces);
        if (jumps.length > 0) {
          results.push({ piece: p, moves: jumps });
        }
      }

      return results;
    },
    [getAllRawMovesForPiece]
  );

  // Get legally filtered moves for a piece according to Compulsory Capture rule
  const getLegalMovesForPiece = useCallback(
    (piece: DraughtsPiece, boardPieces: DraughtsPiece[], forcedPieceId?: string | null): DraughtsMove[] => {
      // If in the middle of a multi-jump chain, ONLY that chained piece can move and only its jumps
      if (forcedPieceId && piece.id !== forcedPieceId) {
        return [];
      }

      const { steps, jumps } = getAllRawMovesForPiece(piece, boardPieces);

      // If this specific piece has jumps, it must take them
      if (jumps.length > 0) {
        return jumps;
      }

      // Check if ANY other piece of the same color has an available capture
      const allColorCaptures = getCapturesForColor(piece.color, boardPieces);
      if (allColorCaptures.length > 0) {
        // Compulsory Capture (Eat-up) Rule: Captures are strictly mandatory!
        // This piece has no captures, so it cannot make a quiet step while another piece can capture.
        return [];
      }

      // No captures exist across the entire team, quiet steps are permitted
      return steps;
    },
    [getAllRawMovesForPiece, getCapturesForColor]
  );

  // List of piece IDs that currently have mandatory captures (for UI highlighting)
  const mandatoryCapturePieceIds = useCallback((): string[] => {
    const activeColor: DraughtsPieceColor = turn === 'player' ? 'gold' : 'crimson';
    if (chainPieceId) return [chainPieceId];
    const captureList = getCapturesForColor(activeColor, pieces);
    return captureList.map((c) => c.piece.id);
  }, [turn, chainPieceId, getCapturesForColor, pieces]);

  // Restart
  const restartGame = useCallback(() => {
    setPieces(createInitialDraughtsBoard());
    setSelectedPiece(null);
    setValidMoves([]);
    setTurn('player');
    setPlayerCapturedCount(0);
    setOpponentCapturedCount(0);
    setChainPieceId(null);
    setGameMessage('Your turn (Gold). 10x10 Board with Compulsory Capture.');
    setLastAction('Board reset to 10x10');
    setTurnTimeLeft(maxTurnTime);
    aiThinkingRef.current = false;
  }, [maxTurnTime]);

  // Reset timer whenever turn transitions to local player
  useEffect(() => {
    if (isMyTurn) {
      setTurnTimeLeft(isP2P && activeMatch?.turnDeadlineAt ? Math.max(0, Math.ceil((activeMatch.turnDeadlineAt - Date.now()) / 1000)) : maxTurnTime);
    }
  }, [isMyTurn, maxTurnTime, isP2P, activeMatch?.turnDeadlineAt]);

  // Turn Countdown Timer (15 seconds)
  useEffect(() => {
    if (!isMyTurn) return;

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        const next = prev - 1;
        if (next <= 5 && next > 0) {
          sound.playTick();
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn]);

  // Handle timeout when turnTimeLeft reaches 0: player loses turn
  useEffect(() => {
    if (isMyTurn && turnTimeLeft === 0) {
      if (activeMatch?.coinMatchId) { void timeoutCoinAiMatch(); return; }
      sound.playTimeout();
      telegram.triggerHaptic('warning');
      setSelectedPiece(null);
      setValidMoves([]);
      setChainPieceId(null);
      setGameMessage(`⏰ Time expired after ${maxTurnTime >= 60 ? `${Math.floor(maxTurnTime / 60)}m` : `${maxTurnTime}s`}! You lost your turn.`);
      setLastAction('Turn lost due to timeout');
      const nextTurn = turn === 'player' ? 'opponent' : 'player';
      setTurn(nextTurn);
      if (isP2P && sendP2pStateUpdate) {
        sendP2pStateUpdate({
          pieces,
          turn: nextTurn,
          playerCapturedCount,
          opponentCapturedCount,
          lastAction: 'Turn lost due to timeout',
        });
      }
    }
  }, [isMyTurn, turnTimeLeft, turn, isP2P, sendP2pStateUpdate, pieces, playerCapturedCount, opponentCapturedCount]);

  // Execute a move (supports chaining multi-jumps)
  const executeMove = useCallback(
    (move: DraughtsMove, isPlayerMove: boolean) => {
      let captured = false;
      let crowned = false;
      let movedPieceObj: DraughtsPiece | null = null;

      const nextPieces = pieces
        .map((p) => {
          if (p.row === move.fromRow && p.col === move.fromCol) {
            // Check King promotion (Gold reaching row 0, Crimson reaching row 9)
            const becomesKing =
              p.isKing ||
              (p.color === 'gold' && move.toRow === 0) ||
              (p.color === 'crimson' && move.toRow === BOARD_SIZE - 1);

            if (!p.isKing && becomesKing) crowned = true;

            const updated: DraughtsPiece = {
              ...p,
              row: move.toRow,
              col: move.toCol,
              isKing: becomesKing,
            };
            movedPieceObj = updated;
            return updated;
          }
          return p;
        })
        .filter((p) => !move.capturedPiece || p.id !== move.capturedPiece.id);

      setPieces(nextPieces);

      if (move.capturedPiece) {
        captured = true;
        sound.playCapture();
        telegram.triggerHaptic('heavy');
        if (isPlayerMove) {
          setPlayerCapturedCount((c) => c + 1);
          setLastAction(`💥 You captured Crimson draught at (${move.capturedPiece.row + 1}, ${move.capturedPiece.col + 1})!`);
        } else {
          setOpponentCapturedCount((c) => c + 1);
          setLastAction(`💥 Opponent captured your Gold draught at (${move.capturedPiece.row + 1}, ${move.capturedPiece.col + 1})!`);
        }
      } else {
        sound.playMove();
        telegram.triggerHaptic('light');
        setLastAction(isPlayerMove ? 'You moved' : 'Opponent moved');
      }

      if (crowned) {
        sound.playWhotWild();
        telegram.triggerHaptic('success');
      }

      // Record step for full match replay playback
      recordReplayStep({
        turn: isPlayerMove ? 'player' : 'opponent',
        actorName: isPlayerMove
          ? user?.displayName || 'Gold (You)'
          : activeMatch?.opponent.displayName || 'Crimson Opponent',
        actorAvatar: isPlayerMove
          ? user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
          : activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        actionTitle: crowned
          ? `👑 KING PROMOTED! (${move.toRow + 1}, ${move.toCol + 1})`
          : captured
          ? `💥 CAPTURE! (${move.toRow + 1}, ${move.toCol + 1})`
          : `Move to (${move.toRow + 1}, ${move.toCol + 1})`,
        actionDescription: isPlayerMove
          ? `Gold piece moved from (${move.fromRow + 1}, ${move.fromCol + 1}) to (${move.toRow + 1}, ${move.toCol + 1})${
              captured ? ' capturing opponent piece' : ''
            }${crowned ? ' and was crowned King' : ''}.`
          : `Crimson piece moved from (${move.fromRow + 1}, ${move.fromCol + 1}) to (${move.toRow + 1}, ${move.toCol + 1})${
              captured ? ' capturing player piece' : ''
            }${crowned ? ' and was crowned King' : ''}.`,
        timestampOffset: '0:15',
        isKeyMoment: captured || crowned,
        draughtsState: {
          pieces: nextPieces,
          lastMove: {
            fromRow: move.fromRow,
            fromCol: move.fromCol,
            toRow: move.toRow,
            toCol: move.toCol,
            captured,
          },
          capturedGold: isPlayerMove ? playerCapturedCount : playerCapturedCount + (captured ? 1 : 0),
          capturedCrimson: isPlayerMove ? playerCapturedCount + (captured ? 1 : 0) : opponentCapturedCount,
        },
      });

      // Check win condition
      const goldLeft = nextPieces.filter((p) => p.color === 'gold').length;
      const crimsonLeft = nextPieces.filter((p) => p.color === 'crimson').length;

      if (crimsonLeft === 0) {
        // Gold wins! (Host's color)
        const winnerRole = 'host';
        const localWinner = isHost ? 'player' : 'opponent';
        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            pieces: nextPieces,
            isGameOver: true,
            winnerRole,
            lastAction: 'Match finished! Gold claimed victory.',
          });
        }
        sound.playWin();
        telegram.triggerHaptic(localWinner === 'player' ? 'success' : 'error');
        onGameOver(localWinner);
        return;
      }
      if (goldLeft === 0) {
        // Crimson wins! (Challenger's color)
        const winnerRole = 'challenger';
        const localWinner = isHost ? 'opponent' : 'player';
        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            pieces: nextPieces,
            isGameOver: true,
            winnerRole,
            lastAction: 'Match finished! Crimson claimed victory.',
          });
        }
        sound.playWin();
        telegram.triggerHaptic(localWinner === 'player' ? 'success' : 'error');
        onGameOver(localWinner);
        return;
      }

      // Multi-Jump / Chain Capture check:
      // If a jump just occurred, check if that SAME piece can jump again
      if (captured && movedPieceObj) {
        const { jumps: furtherJumps } = getAllRawMovesForPiece(movedPieceObj, nextPieces);
        if (furtherJumps.length > 0) {
          // Mandatory chain jump!
          if (isPlayerMove) {
            setSelectedPiece(movedPieceObj);
            setValidMoves(furtherJumps);
            setChainPieceId((movedPieceObj as DraughtsPiece).id);
            setGameMessage('🔥 Multi-jump! Compulsory chain capture in progress.');
            telegram.triggerHaptic('medium');
            return;
          } else {
            // For AI, execute the next chain jump after a brief delay
            setChainPieceId((movedPieceObj as DraughtsPiece).id);
            setTimeout(() => {
              const nextAiJump = furtherJumps[Math.floor(Math.random() * furtherJumps.length)];
              executeMove(nextAiJump, false);
            }, 550);
            return;
          }
        }
      }

      // No chain jump remaining: finalize turn transition
      setChainPieceId(null);
      setSelectedPiece(null);
      setValidMoves([]);

      const nextTurn = isP2P
        ? (isHost ? (isPlayerMove ? 'opponent' : 'player') : (isPlayerMove ? 'player' : 'opponent'))
        : (isPlayerMove ? 'opponent' : 'player');
      setTurn(nextTurn);

      // Check if next player has any legal moves
      const nextColor: DraughtsPieceColor = nextTurn === 'player' ? 'gold' : 'crimson';
      const nextActivePieces = nextPieces.filter((p) => p.color === nextColor);
      const hasAnyMove = nextActivePieces.some(
        (p) => getLegalMovesForPiece(p, nextPieces).length > 0
      );

      if (!hasAnyMove) {
        // Next player has no moves left -> game over! Winning color is opposite of nextColor
        const winningColor = nextColor === 'gold' ? 'crimson' : 'gold';
        const winnerRole = winningColor === 'gold' ? 'host' : 'challenger';
        const localWinner = winnerRole === (isHost ? 'host' : 'challenger') ? 'player' : 'opponent';

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            pieces: nextPieces,
            isGameOver: true,
            winnerRole,
            lastAction: 'No legal moves remaining! Match finished.',
          });
        }

        sound.playWin();
        telegram.triggerHaptic(localWinner === 'player' ? 'success' : 'error');
        onGameOver(localWinner);
        return;
      }

      if (nextTurn === 'player') {
        const playerCaptures = getCapturesForColor('gold', nextPieces);
        if (playerCaptures.length > 0) {
          setGameMessage('⚠️ Compulsory Capture! You must jump the highlighted opponent piece.');
          telegram.triggerHaptic('selection');
        } else {
          setGameMessage('Your turn (Gold). Tap a piece to move.');
        }
      } else {
        const isP2P = activeMatch?.isVsAi === false;
        if (isP2P) {
          const oppCaptures = getCapturesForColor('crimson', nextPieces);
          if (oppCaptures.length > 0) {
            setGameMessage('⚠️ Compulsory Capture! Opponent (Crimson) must jump highlighted piece.');
          } else {
            setGameMessage("Opponent's turn (Crimson). Tap a Crimson piece to move.");
          }
        } else {
          setGameMessage('Opponent is strategizing...');
        }
      }

      if (activeMatch?.isVsAi === false && sendP2pStateUpdate) {
        const goldCap = isHost
          ? (isPlayerMove ? playerCapturedCount + (captured ? 1 : 0) : playerCapturedCount)
          : (!isPlayerMove ? opponentCapturedCount + (captured ? 1 : 0) : opponentCapturedCount);
        const crimsonCap = isHost
          ? (!isPlayerMove ? opponentCapturedCount + (captured ? 1 : 0) : opponentCapturedCount)
          : (isPlayerMove ? playerCapturedCount + (captured ? 1 : 0) : playerCapturedCount);

        sendP2pStateUpdate({
          pieces: nextPieces,
          turn: nextTurn,
          goldCapturedCount: goldCap,
          crimsonCapturedCount: crimsonCap,
          lastAction: captured ? 'Capture move executed' : 'Piece moved',
        });
      }
    },
    [pieces, onGameOver, getAllRawMovesForPiece, getLegalMovesForPiece, getCapturesForColor, activeMatch, sendP2pStateUpdate, playerCapturedCount, opponentCapturedCount, isHost, isP2P]
  );

  // Select a player piece
  const onSelectPiece = useCallback(
    (piece: DraughtsPiece) => {
      if (!isMyTurn || piece.color !== myColor) return;

      const activeColor = myColor;

      // If in a multi-jump chain, cannot switch piece
      if (chainPieceId && piece.id !== chainPieceId) {
        telegram.triggerHaptic('warning');
        setGameMessage('⚠️ Complete your mandatory multi-jump with the active piece!');
        return;
      }

      const mandatoryPieces = getCapturesForColor(activeColor, pieces);
      const mustCapture = mandatoryPieces.length > 0;
      const pieceCanCapture = mandatoryPieces.some((item) => item.piece.id === piece.id);

      if (mustCapture && !pieceCanCapture) {
        sound.playError();
        telegram.triggerHaptic('warning');
        setGameMessage('⚠️ Compulsory Capture (Eat-up)! You cannot make a quiet step when a jump is available.');
        return;
      }

      const moves = getLegalMovesForPiece(piece, pieces, chainPieceId);
      if (moves.length === 0) {
        telegram.triggerHaptic('warning');
        return;
      }

      setSelectedPiece(piece);
      setValidMoves(moves);
      sound.playClick();
      telegram.triggerHaptic('selection');
    },
    [isMyTurn, myColor, pieces, chainPieceId, getCapturesForColor, getLegalMovesForPiece]
  );

  // Player clicks a destination tile
  const onSelectTile = useCallback(
    (row: number, col: number) => {
      if (!selectedPiece || !isMyTurn) return;

      const matchedMove = validMoves.find((m) => m.toRow === row && m.toCol === col);
      if (matchedMove) {
        if (activeMatch?.coinMatchId) {
          if (coinMovePendingRef.current) return;
          coinMovePendingRef.current = true;
          // Apply the move locally so the piece responds immediately. The server
          // remains authoritative and publishes its validated state on completion.
          executeMove(matchedMove, true);
          void submitCoinAiAction({ type: 'draughts_move', fromRow: matchedMove.fromRow, fromCol: matchedMove.fromCol, toRow: matchedMove.toRow, toCol: matchedMove.toCol })
            .finally(() => { coinMovePendingRef.current = false; });
          return;
        }
        executeMove(matchedMove, true);
      } else if (!chainPieceId) {
        // Only allow deselect if not locked in a chain capture
        setSelectedPiece(null);
        setValidMoves([]);
      }
    },
    [selectedPiece, isMyTurn, validMoves, executeMove, chainPieceId, activeMatch?.coinMatchId, submitCoinAiAction]
  );

  // AI Opponent Turn
  useEffect(() => {
    if (turn !== 'opponent' || aiThinkingRef.current || activeMatch?.isVsAi === false) return;

    aiThinkingRef.current = true;
    const timer = setTimeout(() => {
      const crimsonPieces = pieces.filter((p) => p.color === 'crimson');

      // Check if AI has mandatory captures
      const aiCaptures = getCapturesForColor('crimson', pieces);

      let chosenMove: DraughtsMove | null = null;

      if (aiCaptures.length > 0) {
        // Compulsory Capture: AI MUST pick a capture jump
        const chosenPieceCapture = aiCaptures[Math.floor(Math.random() * aiCaptures.length)];
        chosenMove = chosenPieceCapture.moves[Math.floor(Math.random() * chosenPieceCapture.moves.length)];
      } else {
        // Collect all legal quiet moves
        const allLegalMoves: DraughtsMove[] = [];
        crimsonPieces.forEach((p) => {
          const moves = getLegalMovesForPiece(p, pieces);
          allLegalMoves.push(...moves);
        });

        if (allLegalMoves.length > 0) {
          chosenMove = allLegalMoves[Math.floor(Math.random() * allLegalMoves.length)];
        }
      }

      if (!chosenMove) {
        // AI has no moves -> Player wins
        sound.playWin();
        onGameOver('player');
        aiThinkingRef.current = false;
        return;
      }

      executeMove(chosenMove, false);
      aiThinkingRef.current = false;
    }, 1000);

    return () => {
      clearTimeout(timer);
      aiThinkingRef.current = false;
    };
  }, [turn, pieces, getCapturesForColor, getLegalMovesForPiece, executeMove, onGameOver]);

  const mandatoryPieceIds = mandatoryCapturePieceIds();

  return {
    pieces,
    selectedPiece,
    validMoves,
    turn,
    playerCapturedCount,
    opponentCapturedCount,
    gameMessage,
    lastAction,
    mandatoryPieceIds,
    chainPieceId,
    onSelectPiece,
    onSelectTile,
    restartGame,
    turnTimeLeft,
    maxTurnTime,
    boardSize: BOARD_SIZE,
    piecesPerSide: PIECES_PER_SIDE,
    isHost,
    myColor,
    oppColor,
    isMyTurn,
  };
}

