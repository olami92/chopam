import { useState, useEffect, useCallback, useRef } from 'react';
import { LudoToken, TURN_MODE_SECONDS } from '../types';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { useGame } from '../context/GameContext';
import { getDynamicAvatarUrl } from '../utils/avatar';

export interface LudoCard {
  id: string;
  value: number; // 1 - 6
}

// 52 track squares coordinate map (15x15 board)
// Authentic Ludo track mapped to [row, col] indices (0-indexed 0 to 14)
export const LUDO_TRACK_COORDS: [number, number][] = [
  // Red start & top-left arm
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], // top turn
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14], // right turn
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7], // bottom turn
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0], // left turn
  [6, 0],
];

// Red home stretch (5 tiles leading right into center home [7, 7])
export const RED_HOME_STRETCH: [number, number][] = [
  [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
];

// Yellow home stretch (5 tiles leading left into center home [7, 7])
export const YELLOW_HOME_STRETCH: [number, number][] = [
  [7, 13], [7, 12], [7, 11], [7, 10], [7, 9],
];

// Base token yard coordinates
export const RED_BASE_COORDS: [number, number][] = [
  [2, 2], [2, 3], [3, 2], [3, 3],
];

export const YELLOW_BASE_COORDS: [number, number][] = [
  [11, 11], [11, 12], [12, 11], [12, 12],
];

// Safe track star indices (relative to 52 track):
// 0 (Red Start), 8, 13 (Green Start), 21, 26 (Yellow Start), 34, 39 (Blue Start), 47
export const SAFE_TRACK_INDICES = [0, 8, 13, 21, 26, 34, 39, 47];

const WIN_TOKENS_NEEDED = 4; // Complete classic battle (all 4 tokens must reach home to win!)

export function useLudoGame(
  isBlitz: boolean,
  onGameOver: (winner: 'player' | 'opponent') => void
) {
  const { recordReplayStep, user, activeMatch, sendP2pStateUpdate, submitCoinAiAction, timeoutCoinAiMatch } = useGame();
  // Player = Red (Starts track at index 0)
  // Opponent = Yellow (Starts track at index 26)
  const [playerTokens, setPlayerTokens] = useState<LudoToken[]>([
    { id: 'p0', color: 'red', index: 0, step: -1 },
    { id: 'p1', color: 'red', index: 1, step: -1 },
    { id: 'p2', color: 'red', index: 2, step: -1 },
    { id: 'p3', color: 'red', index: 3, step: -1 },
  ]);

  const [opponentTokens, setOpponentTokens] = useState<LudoToken[]>([
    { id: 'o0', color: 'yellow', index: 0, step: -1 },
    { id: 'o1', color: 'yellow', index: 1, step: -1 },
    { id: 'o2', color: 'yellow', index: 2, step: -1 },
    { id: 'o3', color: 'yellow', index: 3, step: -1 },
  ]);

  const [turn, setTurn] = useState<'player' | 'opponent'>('player');
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const [nonce, setNonce] = useState<number>(0);
  const [serverSeedHash] = useState<string>(() => {
    return 'a7c9f82d14b39e6e019f2a8740b21e89c301724f8d96201b5e39401827419e0f';
  });
  const [clientSeed] = useState<string>(() => {
    return `skillstake_${user?.username || 'player'}_${Math.random().toString(36).substring(2, 8)}`;
  });

  const isP2P = activeMatch?.isVsAi === false;
  const isHost = activeMatch
    ? activeMatch.hostUsername
      ? activeMatch.hostUsername.toLowerCase() === (user?.username || '').toLowerCase()
      : activeMatch.opponent.username.toLowerCase() !== (user?.username || '').toLowerCase()
    : true;

  const isMyTurn = isP2P ? (isHost ? turn === 'player' : turn === 'opponent') : turn === 'player';
  const myColor: 'red' | 'yellow' = isP2P ? (isHost ? 'red' : 'yellow') : 'red';
  const oppColor: 'red' | 'yellow' = isP2P ? (isHost ? 'yellow' : 'red') : 'yellow';

  const myTokens = isHost ? playerTokens : opponentTokens;
  const oppTokens = isHost ? opponentTokens : playerTokens;

  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Synchronize incoming real-time P2P opponent moves via custom event
  useEffect(() => {
    const handleRemoteState = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const s = customEvt.detail;
      if (s) {
        if (s.playerTokens) setPlayerTokens(s.playerTokens);
        if (s.opponentTokens) setOpponentTokens(s.opponentTokens);
        if (s.turn) setTurn(s.turn);
        if (s.diceValue !== undefined) setDiceValue(s.diceValue);
        if (s.blitzCards) setBlitzCards(s.blitzCards);
        if (s.opponentBlitzCards) setOpponentBlitzCards(s.opponentBlitzCards);
        setSelectedCardId(null);
        if (s.gameMessage) setGameMessage(s.gameMessage);
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

  const [gameMessage, setGameMessage] = useState<string>(
    isBlitz ? 'Select a strategic number card to move!' : 'Roll the dice to deploy or advance!'
  );
  const [lastAction, setLastAction] = useState<string>('Match ready');

  // Blitz mode state: 4 cards in hand
  const [blitzCards, setBlitzCards] = useState<LudoCard[]>([
    { id: 'bc_1', value: 6 },
    { id: 'bc_2', value: 4 },
    { id: 'bc_3', value: 3 },
    { id: 'bc_4', value: 5 },
  ]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Opponent Blitz deck state: hand of 4 cards, with guaranteed 6 deploy on turn 1
  const [opponentBlitzCards, setOpponentBlitzCards] = useState<LudoCard[]>([
    { id: 'obc_1', value: 6 },
    { id: 'obc_2', value: 4 },
    { id: 'obc_3', value: 3 },
    { id: 'obc_4', value: 5 },
  ]);
  const [opponentPlayedCard, setOpponentPlayedCard] = useState<LudoCard | null>(null);

  // Turn Countdown Timer: 15s for Blitz, 20s for Classic
  const maxTurnTime = TURN_MODE_SECONDS[activeMatch?.turnMode || 'live'];
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(maxTurnTime);

  const aiThinkingRef = useRef(false);

  // Convert relative player/opponent step to absolute track index or home coord
  const getAbsoluteTrackIndex = useCallback((color: 'red' | 'yellow', step: number): number | null => {
    if (step < 0 || step > 50) return null;
    if (color === 'red') {
      return step % 52;
    } else {
      // Yellow starts at 26
      return (26 + step) % 52;
    }
  }, []);

  // Check if token can move with current value
  const canTokenMove = useCallback(
    (token: LudoToken, val: number): boolean => {
      if (token.step === 56) return false; // already won/home
      if (token.step === -1) {
        // Must have 6 to leave yard
        return val === 6;
      }
      return token.step + val <= 56;
    },
    []
  );

  // Reset/Restart Game
  const restartGame = useCallback(() => {
    setPlayerTokens([
      { id: 'p0', color: 'red', index: 0, step: -1 },
      { id: 'p1', color: 'red', index: 1, step: -1 },
      { id: 'p2', color: 'red', index: 2, step: -1 },
      { id: 'p3', color: 'red', index: 3, step: -1 },
    ]);
    setOpponentTokens([
      { id: 'o0', color: 'yellow', index: 0, step: -1 },
      { id: 'o1', color: 'yellow', index: 1, step: -1 },
      { id: 'o2', color: 'yellow', index: 2, step: -1 },
      { id: 'o3', color: 'yellow', index: 3, step: -1 },
    ]);
    setTurn('player');
    setDiceValue(null);
    setIsRolling(false);
    setSelectedCardId(null);
    setOpponentPlayedCard(null);
    setBlitzCards([
      { id: `bc_${Math.random()}`, value: 6 },
      { id: `bc_${Math.random()}`, value: 3 + Math.floor(Math.random() * 3) },
      { id: `bc_${Math.random()}`, value: 1 + Math.floor(Math.random() * 5) },
      { id: `bc_${Math.random()}`, value: 2 + Math.floor(Math.random() * 4) },
    ]);
    setOpponentBlitzCards([
      { id: `obc_${Math.random()}`, value: 6 },
      { id: `obc_${Math.random()}`, value: 3 + Math.floor(Math.random() * 3) },
      { id: `obc_${Math.random()}`, value: 1 + Math.floor(Math.random() * 5) },
      { id: `obc_${Math.random()}`, value: 2 + Math.floor(Math.random() * 4) },
    ]);
    setGameMessage(isBlitz ? 'Select a strategic card to move!' : 'Roll the dice to start!');
    setLastAction('Tokens reset to base');
    setTurnTimeLeft(maxTurnTime);
    aiThinkingRef.current = false;
  }, [isBlitz, maxTurnTime]);

  // Reset timer whenever turn transitions to local player
  useEffect(() => {
    if (isMyTurn) {
      setTurnTimeLeft(isP2P && activeMatch?.turnDeadlineAt ? Math.max(0, Math.ceil((activeMatch.turnDeadlineAt - Date.now()) / 1000)) : maxTurnTime);
    }
  }, [isMyTurn, maxTurnTime, isP2P, activeMatch?.turnDeadlineAt]);

  // 1-second countdown interval while local player's turn
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

  // Handle player turn timeout: player loses turn
  useEffect(() => {
    if (isMyTurn && turnTimeLeft === 0) {
      if (activeMatch?.coinMatchId) { void timeoutCoinAiMatch(); return; }
      sound.playTimeout();
      telegram.triggerHaptic('warning');
      setSelectedCardId(null);
      setDiceValue(null);
      setIsRolling(false);
      setGameMessage(
        `⏰ Time expired after ${maxTurnTime >= 60 ? `${Math.floor(maxTurnTime / 60)}m` : `${maxTurnTime}s`}! You lost your turn.`
      );
      setLastAction('Turn lost due to timeout');
      const nextTurn = isP2P ? (isHost ? 'opponent' : 'player') : 'opponent';
      setTurn(nextTurn);
      if (isP2P && sendP2pStateUpdate) {
        sendP2pStateUpdate({
          playerTokens,
          opponentTokens,
          turn: nextTurn,
          diceValue: null,
          lastAction: 'Turn lost due to timeout',
        });
      }
    }
  }, [isMyTurn, turnTimeLeft, isBlitz, isP2P, isHost, playerTokens, opponentTokens, sendP2pStateUpdate]);

  const autoPassRef = useRef(false);

  // Auto-pass turn in Blitz mode if local player has no valid card moves
  useEffect(() => {
    if (!isBlitz || !isMyTurn || autoPassRef.current) return;

    const hasAnyValidMove = blitzCards.some((card) =>
      myTokens.some((token) => canTokenMove(token, card.value))
    );

    if (!hasAnyValidMove) {
      autoPassRef.current = true;
      setSelectedCardId(null);
      if (activeMatch?.coinMatchId) {
        void submitCoinAiAction({ type: 'ludo_blitz_pass' }).finally(() => { autoPassRef.current = false; });
        return;
      }
      sound.playTimeout();
      telegram.triggerHaptic('warning');

      setGameMessage('⚠️ No valid card moves available! Discarding 1 card & passing turn...');
      setLastAction('Turn passed (No valid card moves)');

      const passTimer = setTimeout(() => {
        setBlitzCards((prev) =>
          prev.map((c, idx) =>
            idx === 0 ? { id: `bc_${Date.now()}`, value: Math.floor(Math.random() * 6) + 1 } : c
          )
        );
        const nextTurn = isP2P ? (isHost ? 'opponent' : 'player') : 'opponent';
        setTurn(nextTurn);
        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            playerTokens,
            opponentTokens,
            turn: nextTurn,
            diceValue: null,
            lastAction: 'Turn passed (No valid card moves)',
          });
        }
      }, 1200);

      return () => clearTimeout(passTimer);
    }
  }, [
    isBlitz,
    isMyTurn,
    blitzCards,
    myTokens,
    canTokenMove,
    isP2P,
    isHost,
    playerTokens,
    opponentTokens,
    sendP2pStateUpdate,
    activeMatch?.coinMatchId,
    submitCoinAiAction,
  ]);

  // Reset autoPassRef when turn leaves player
  useEffect(() => {
    if (!isMyTurn) {
      autoPassRef.current = false;
    }
  }, [isMyTurn]);

// Cryptographically secure dice roll using Web Crypto API (CSPRNG) with zero modulo bias
function getCryptographicDiceRoll(): number {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    const maxValid = 4294967295 - (4294967295 % 6);
    let rand = 0;
    do {
      window.crypto.getRandomValues(array);
      rand = array[0];
    } while (rand >= maxValid);
    return (rand % 6) + 1;
  }
  return Math.floor(Math.random() * 6) + 1;
}

  // Roll dice for Classic mode
  const rollDice = useCallback(() => {
    if (isBlitz || !isMyTurn || isRolling || diceValue !== null) return;
    if (activeMatch?.coinMatchId) { void submitCoinAiAction({ type: 'ludo_roll' }); return; }

    setIsRolling(true);
    sound.playDiceRoll();
    telegram.triggerHaptic('medium');

    let rollCount = 0;
    const interval = setInterval(() => {
      setDiceValue(getCryptographicDiceRoll());
      rollCount++;
      if (rollCount > 8) {
        clearInterval(interval);
        const finalVal = getCryptographicDiceRoll();
        setNonce((n) => n + 1);
        setDiceValue(finalVal);
        setIsRolling(false);

        // Check if local player has any valid moves
        const hasValidMove = myTokens.some((t) => canTokenMove(t, finalVal));
        if (!hasValidMove) {
          setGameMessage(`You rolled ${finalVal}. No valid moves! Opponent turn.`);
          setLastAction(`You rolled ${finalVal} (No moves)`);
          recordReplayStep({
            turn: isHost ? 'player' : 'opponent',
            actorName: user?.displayName || 'Player (You)',
            actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            actionTitle: `Rolled Dice [${finalVal}] (No Moves)`,
            actionDescription: `Rolled ${finalVal} with no valid tokens eligible to move. Turn passed.`,
            diceRoll: finalVal,
            tokensInBase: {
              player: playerTokens.filter((t) => t.step === -1).length,
              opponent: opponentTokens.filter((t) => t.step === -1).length,
            },
          });
          setTimeout(() => {
            setDiceValue(null);
            const nextTurn = isP2P ? (isHost ? 'opponent' : 'player') : 'opponent';
            setTurn(nextTurn);
            if (isP2P && sendP2pStateUpdate) {
              sendP2pStateUpdate({
                playerTokens,
                opponentTokens,
                turn: nextTurn,
                diceValue: null,
                lastAction: `Rolled ${finalVal} (No moves)`,
              });
            }
          }, 1000);
        } else {
          setGameMessage(`Rolled ${finalVal}! Tap a highlighted token to move.`);
          setLastAction(`You rolled ${finalVal}`);
          if (isP2P && sendP2pStateUpdate) {
            sendP2pStateUpdate({
              playerTokens,
              opponentTokens,
              turn,
              diceValue: finalVal,
              lastAction: `Rolled ${finalVal}`,
            });
          }
        }
      }
    }, 60);
  }, [isBlitz, isMyTurn, isRolling, diceValue, myTokens, canTokenMove, user, recordReplayStep, playerTokens, opponentTokens, isHost, isP2P, sendP2pStateUpdate, turn, activeMatch?.coinMatchId, submitCoinAiAction]);

  // Move token
  const moveToken = useCallback(
    (token: LudoToken, moveValue: number) => {
      if (activeMatch?.coinMatchId) {
        if (isBlitz) {
          const card = blitzCards.find((item) => item.id === selectedCardId);
          if (card) void submitCoinAiAction({ type: 'ludo_blitz_move', tokenId: token.id, cardId: card.id });
        } else void submitCoinAiAction({ type: 'ludo_move', tokenId: token.id });
        return;
      }
      const isPlayerMove = (isHost && token.color === 'red') || (!isHost && token.color === 'yellow');
      let nextStep = token.step;

      if (token.step === -1) {
        nextStep = 0; // Deployed
        sound.playMove();
        telegram.triggerHaptic('medium');
      } else {
        nextStep = token.step + moveValue;
        sound.playMove();
        telegram.triggerHaptic('light');
      }

      // Update mutable token array copies
      let updatedPlayerTokens = [...playerTokens];
      let updatedOpponentTokens = [...opponentTokens];

      if (token.color === 'red') {
        updatedPlayerTokens = updatedPlayerTokens.map((t) =>
          t.id === token.id ? { ...t, step: nextStep } : t
        );
      } else {
        updatedOpponentTokens = updatedOpponentTokens.map((t) =>
          t.id === token.id ? { ...t, step: nextStep } : t
        );
      }

      // Check capture on main track
      let capturedOpponent = false;
      const absTrackIdx = getAbsoluteTrackIndex(token.color, nextStep);

      if (absTrackIdx !== null && !SAFE_TRACK_INDICES.includes(absTrackIdx)) {
        if (token.color === 'red') {
          // Red captures Yellow victim
          const victim = updatedOpponentTokens.find((ot) => {
            const oppAbs = getAbsoluteTrackIndex('yellow', ot.step);
            return oppAbs === absTrackIdx;
          });
          if (victim) {
            capturedOpponent = true;
            sound.playCapture();
            telegram.triggerHaptic('heavy');
            updatedOpponentTokens = updatedOpponentTokens.map((ot) =>
              ot.id === victim.id ? { ...ot, step: -1 } : ot
            );
            setGameMessage(`💥 CAPTURE! Opponent token sent back home! 🏆`);
          }
        } else {
          // Yellow captures Red victim
          const victim = updatedPlayerTokens.find((pt) => {
            const plyAbs = getAbsoluteTrackIndex('red', pt.step);
            return plyAbs === absTrackIdx;
          });
          if (victim) {
            capturedOpponent = true;
            sound.playCapture();
            telegram.triggerHaptic('heavy');
            updatedPlayerTokens = updatedPlayerTokens.map((pt) =>
              pt.id === victim.id ? { ...pt, step: -1 } : pt
            );
            setGameMessage(`💥 CAPTURE! Opponent token sent back home! 🏆`);
          }
        }
      }

      setPlayerTokens(updatedPlayerTokens);
      setOpponentTokens(updatedOpponentTokens);

      // Check win condition
      const checkTokens = token.color === 'red' ? updatedPlayerTokens : updatedOpponentTokens;
      const pBase = updatedPlayerTokens.filter((t) => t.step === -1).length;
      const oBase = updatedOpponentTokens.filter((t) => t.step === -1).length;

      const actionTitle = capturedOpponent
        ? `💥 CAPTURE! (${token.color === 'red' ? 'Red' : 'Yellow'})`
        : token.step === -1
        ? `🚀 Deployed Token to Track`
        : nextStep >= 56
        ? `🏁 Token Reached Home!`
        : `Advanced Token +${moveValue}`;

      recordReplayStep({
        turn: isPlayerMove ? (isHost ? 'player' : 'opponent') : (isHost ? 'opponent' : 'player'),
        actorName: isPlayerMove
          ? user?.displayName || 'Player (You)'
          : activeMatch?.opponent.displayName || 'Opponent',
        actorAvatar: isPlayerMove
          ? (user?.avatarUrl && !user.avatarUrl.includes('unsplash.com') ? user.avatarUrl : getDynamicAvatarUrl(user?.username || 'player'))
          : (activeMatch?.opponent.avatarUrl && !activeMatch.opponent.avatarUrl.includes('unsplash.com') ? activeMatch.opponent.avatarUrl : getDynamicAvatarUrl(activeMatch?.opponent.username || 'opponent')),
        actionTitle,
        actionDescription: `${token.color === 'red' ? 'Red' : 'Yellow'} Token ${token.id.toUpperCase()} moved ${moveValue} steps to step ${nextStep}/56${
          capturedOpponent ? ' capturing an opponent token' : ''
        }.`,
        diceRoll: moveValue,
        tokensInBase: { player: pBase, opponent: oBase },
      });

      const homeCount = checkTokens.filter((t) => t.step >= 56).length;
      if (homeCount >= WIN_TOKENS_NEEDED) {
        sound.playWin();
        const winnerRole = token.color === 'red' ? 'host' : 'challenger';
        const localWinner = winnerRole === (isHost ? 'host' : 'challenger') ? 'player' : 'opponent';

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            playerTokens: updatedPlayerTokens,
            opponentTokens: updatedOpponentTokens,
            isGameOver: true,
            winnerRole,
            lastAction: `🏁 Token Reached Home! Ludo match concluded.`,
          });
        }

        telegram.triggerHaptic(localWinner === 'player' ? 'success' : 'error');
        onGameOverRef.current(localWinner);
        return;
      }

      // In Blitz mode, replenish card
      if (isBlitz && isPlayerMove && selectedCardId) {
        setBlitzCards((prev) =>
          prev.map((c) =>
            c.id === selectedCardId
              ? { id: `bc_${Date.now()}`, value: Math.floor(Math.random() * 6) + 1 }
              : c
          )
        );
        setSelectedCardId(null);
      }

      // Turn transition
      // Bonus turn awarded on: rolling 6 (in classic mode), or on capturing an opponent
      const bonusTurn = capturedOpponent || (!isBlitz && moveValue === 6);

      if (bonusTurn) {
        setDiceValue(null);
        if (isPlayerMove) {
          setGameMessage(
            capturedOpponent
              ? '🎯 Capture Bonus! Take another turn!'
              : '🔥 Rolled 6 Bonus! Roll again!'
          );
          setLastAction('Bonus turn awarded');
        } else {
          setGameMessage('Opponent earned a bonus turn!');
        }

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            playerTokens: updatedPlayerTokens,
            opponentTokens: updatedOpponentTokens,
            turn,
            diceValue: null,
            lastAction: 'Bonus turn awarded',
          });
        }
      } else {
        setDiceValue(null);
        const nextTurn = isP2P ? (isHost ? (isPlayerMove ? 'opponent' : 'player') : (isPlayerMove ? 'player' : 'opponent')) : 'opponent';
        setTurn(nextTurn);
        setGameMessage(
          isPlayerMove
            ? isBlitz
              ? 'Opponent analyzing cyber deck...'
              : 'Opponent rolling dice...'
            : 'Your turn to move!'
        );

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            playerTokens: updatedPlayerTokens,
            opponentTokens: updatedOpponentTokens,
            turn: nextTurn,
            diceValue: null,
            lastAction: 'Token moved',
          });
        }
      }
    },
    [
      getAbsoluteTrackIndex,
      opponentTokens,
      playerTokens,
      isBlitz,
      selectedCardId,
      user,
      activeMatch,
      recordReplayStep,
      isHost,
      isP2P,
      sendP2pStateUpdate,
      turn,
      submitCoinAiAction,
    ]
  );

  // Player clicks token to move
  const onSelectPlayerToken = useCallback(
    (token: LudoToken) => {
      if (!isMyTurn) return;

      const isMyToken = (isHost && token.color === 'red') || (!isHost && token.color === 'yellow');
      if (!isMyToken) return;

      const moveVal = isBlitz
        ? blitzCards.find((c) => c.id === selectedCardId)?.value
        : diceValue;

      if (!moveVal) {
        if (isBlitz) {
          setGameMessage('Please select a card from your hand first!');
        } else {
          setGameMessage('Please roll the dice first!');
        }
        return;
      }

      if (!canTokenMove(token, moveVal)) {
        telegram.triggerHaptic('warning');
        return;
      }

      moveToken(token, moveVal);
    },
    [isMyTurn, isHost, isBlitz, blitzCards, selectedCardId, diceValue, canTokenMove, moveToken]
  );

  // AI Opponent Turn
  useEffect(() => {
    if (turn !== 'opponent' || aiThinkingRef.current || activeMatch?.isVsAi === false) return;

    aiThinkingRef.current = true;

    if (isBlitz) {
      // ===== LUDO BLITZ AI (STRATEGIC CARD SELECTION) =====
      setGameMessage('Opponent choosing tactical maneuver card...');

      const aiTimer = setTimeout(() => {
        interface CandidateMove {
          card: LudoCard;
          token: LudoToken;
          score: number;
          isDeploy: boolean;
        }

        const candidates: CandidateMove[] = [];

        for (const card of opponentBlitzCards) {
          for (const token of opponentTokens) {
            if (canTokenMove(token, card.value)) {
              let score = 0;
              const nextStep = token.step === -1 ? 0 : token.step + card.value;
              const isDeploy = token.step === -1 && card.value === 6;

              // 1. Capture priority
              const absTrack = getAbsoluteTrackIndex('yellow', nextStep);
              if (absTrack !== null && !SAFE_TRACK_INDICES.includes(absTrack)) {
                const willCapture = playerTokens.some(
                  (pt) => getAbsoluteTrackIndex('red', pt.step) === absTrack
                );
                if (willCapture) {
                  score += 1000;
                }
              }

              // 2. Win / Home reach
              if (nextStep === 56) {
                score += 800;
              }

              // 3. Safe star landing
              if (absTrack !== null && SAFE_TRACK_INDICES.includes(absTrack)) {
                score += 250;
              }

              // 4. Deploy from base
              if (isDeploy) {
                const onTrack = opponentTokens.filter((t) => t.step >= 0 && t.step < 56).length;
                score += onTrack === 0 ? 600 : 350;
              }

              // 5. Track advancement
              if (token.step >= 0) {
                score += 60 + token.step * 2 + card.value;
              }

              candidates.push({ card, token, score, isDeploy });
            }
          }
        }

        // If no candidate move exists with current hand (e.g. all in base and no 6 in hand)
        if (candidates.length === 0) {
          // Discard lowest card and draw a replacement
          const allInBase = opponentTokens.every((t) => t.step === -1 || t.step >= 56);
          const newCardVal = allInBase ? 6 : Math.floor(Math.random() * 6) + 1;
          const targetToken = opponentTokens.find((t) => canTokenMove(t, newCardVal));

          if (targetToken) {
            const playedCard = { id: `obc_new_${Date.now()}`, value: newCardVal };
            setOpponentPlayedCard(playedCard);
            setGameMessage(
              newCardVal === 6
                ? '⚡ Opponent drew DEPLOY [6] and launched a token!'
                : `⚡ Opponent drew [${newCardVal}] and advanced!`
            );

            setTimeout(() => {
              moveToken(targetToken, newCardVal);
              setOpponentBlitzCards((prev) =>
                prev.map((c, i) =>
                  i === 0
                    ? { id: `obc_${Date.now()}`, value: Math.floor(Math.random() * 6) + 1 }
                    : c
                )
              );
              setOpponentPlayedCard(null);
              aiThinkingRef.current = false;
            }, 600);
            return;
          } else {
            setGameMessage(`Opponent cycled card [${opponentBlitzCards[0]?.value || 1}]. Turn passes.`);
            setOpponentBlitzCards((prev) =>
              prev.map((c, i) =>
                i === 0
                  ? { id: `obc_${Date.now()}`, value: Math.floor(Math.random() * 6) + 1 }
                  : c
              )
            );
            setTimeout(() => {
              setTurn('player');
              aiThinkingRef.current = false;
            }, 800);
            return;
          }
        }

        // Pick highest scored move
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];

        setOpponentPlayedCard(best.card);
        setGameMessage(
          best.isDeploy
            ? '⚡ Opponent played DEPLOY [6]!'
            : `⚡ Opponent played maneuver [${best.card.value}]!`
        );

        setTimeout(() => {
          moveToken(best.token, best.card.value);

          // Replenish played card in opponent's hand
          setOpponentBlitzCards((prev) =>
            prev.map((c) =>
              c.id === best.card.id
                ? { id: `obc_${Date.now()}`, value: Math.floor(Math.random() * 6) + 1 }
                : c
            )
          );
          setOpponentPlayedCard(null);
          aiThinkingRef.current = false;
        }, 650);
      }, 750);

      return () => clearTimeout(aiTimer);
    } else {
      // ===== CLASSIC LUDO AI (3D DICE ROLL) =====
      setGameMessage('Opponent is rolling the dice...');
      setIsRolling(true);

      const aiTimer = setTimeout(() => {
        let rollCount = 0;
        const interval = setInterval(() => {
          setDiceValue(getCryptographicDiceRoll());
          rollCount++;
          if (rollCount > 8) {
            clearInterval(interval);
            const finalVal = getCryptographicDiceRoll();
            setDiceValue(finalVal);
            setIsRolling(false);
            setGameMessage(`🎲 Opponent rolled ${finalVal}! Executing turn move...`);

            setTimeout(() => {
              // AI selects best token to move
              const movableTokens = opponentTokens.filter((t) => canTokenMove(t, finalVal));

              if (movableTokens.length === 0) {
                setGameMessage(`🎲 Opponent rolled ${finalVal}. No valid moves available.`);
                setDiceValue(null);
                setTurn('player');
                aiThinkingRef.current = false;
                return;
              }

              // Check if any move captures
              let bestToken = movableTokens[0];
              for (const token of movableTokens) {
                const testStep = token.step === -1 ? 0 : token.step + finalVal;
                const absTrack = getAbsoluteTrackIndex('yellow', testStep);
                if (absTrack !== null && !SAFE_TRACK_INDICES.includes(absTrack)) {
                  const willCapture = playerTokens.some(
                    (pt) => getAbsoluteTrackIndex('red', pt.step) === absTrack
                  );
                  if (willCapture) {
                    bestToken = token;
                    break;
                  }
                }
              }

              // If no capture, deploy from yard if rolled 6
              if (finalVal === 6 && movableTokens.some((t) => t.step === -1)) {
                bestToken = movableTokens.find((t) => t.step === -1) || bestToken;
              }

              moveToken(bestToken, finalVal);
              aiThinkingRef.current = false;
            }, 600);
          }
        }, 60);
      }, 500);

      return () => clearTimeout(aiTimer);
    }
  }, [
    turn,
    isBlitz,
    opponentBlitzCards,
    opponentTokens,
    playerTokens,
    canTokenMove,
    getAbsoluteTrackIndex,
    moveToken,
  ]);

  return {
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
    lastAction,
    rollDice,
    onSelectPlayerToken,
    canTokenMove,
    restartGame,
    turnTimeLeft,
    maxTurnTime,
    serverSeedHash,
    clientSeed,
    nonce,
  };
}
