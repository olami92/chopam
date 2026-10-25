import { useState, useEffect, useCallback, useRef } from 'react';
import { WhotCard, WhotShape, TURN_MODE_SECONDS } from '../types';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { useGame } from '../context/GameContext';
import { getDynamicAvatarUrl, ensureDynamicAvatarUrl } from '../utils/avatar';

// Standard 54-card Nigerian Whot Deck
const WHOT_NUMBERS_CIRCLE = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
const WHOT_NUMBERS_TRIANGLE = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14];
const WHOT_NUMBERS_CROSS = [1, 2, 3, 5, 7, 10, 11, 13, 14];
const WHOT_NUMBERS_SQUARE = [1, 2, 3, 5, 7, 10, 11, 13, 14];
const WHOT_NUMBERS_STAR = [1, 2, 3, 4, 5, 7, 8];

export function createFullWhotDeck(): WhotCard[] {
  const deck: WhotCard[] = [];
  let cardId = 1;

  const isSpecialNumber = (num: number) => [1, 2, 5, 8, 14].includes(num);
  const genId = (prefix: string) => `${prefix}_${cardId++}_${Math.random().toString(36).substring(2, 7)}`;

  WHOT_NUMBERS_CIRCLE.forEach((num) => {
    deck.push({ id: genId('c'), shape: 'circle', number: num, isSpecial: isSpecialNumber(num) });
  });
  WHOT_NUMBERS_TRIANGLE.forEach((num) => {
    deck.push({ id: genId('t'), shape: 'triangle', number: num, isSpecial: isSpecialNumber(num) });
  });
  WHOT_NUMBERS_CROSS.forEach((num) => {
    deck.push({ id: genId('x'), shape: 'cross', number: num, isSpecial: isSpecialNumber(num) });
  });
  WHOT_NUMBERS_SQUARE.forEach((num) => {
    deck.push({ id: genId('s'), shape: 'square', number: num, isSpecial: isSpecialNumber(num) });
  });
  WHOT_NUMBERS_STAR.forEach((num) => {
    deck.push({ id: genId('st'), shape: 'star', number: num, isSpecial: isSpecialNumber(num) });
  });

  // Whot 20 cards (5 Wild cards)
  for (let i = 0; i < 5; i++) {
    deck.push({ id: genId('w'), shape: 'whot', number: 20, isSpecial: true });
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Helper to determine if a card is a special action card
export function isSpecialWhotCard(card: WhotCard): boolean {
  return (
    card.isSpecial === true ||
    card.shape === 'whot' ||
    [1, 2, 5, 8, 14, 20].includes(card.number)
  );
}

// Reshuffle helper to draw cards safely without losing state
function drawFromPiles(
  count: number,
  currentMarket: WhotCard[],
  currentDiscard: WhotCard[]
): { drawn: WhotCard[]; newMarket: WhotCard[]; newDiscard: WhotCard[] } {
  let market = [...currentMarket];
  let discard = [...currentDiscard];
  const drawn: WhotCard[] = [];

  for (let i = 0; i < count; i++) {
    if (market.length === 0) {
      if (discard.length > 1) {
        const topCard = discard[0];
        const rest = discard.slice(1);
        for (let j = rest.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [rest[j], rest[k]] = [rest[k], rest[j]];
        }
        market = rest.map((card) => ({
          ...card,
          id: `${card.id.split('_')[0] || 'c'}_reshuffle_${Math.random().toString(36).substring(2, 7)}`,
        }));
        discard = [topCard];
      } else {
        // Market is empty and no discard cards available to reshuffle: stop drawing!
        break;
      }
    }

    if (market.length > 0) {
      drawn.push(market.shift()!);
    }
  }

  return { drawn, newMarket: market, newDiscard: discard };
}

export interface PendingPenalty {
  count: number;
  type: 2 | 5;
}

export function useWhotGame(onGameOver: (winner: 'player' | 'opponent') => void) {
  const { recordReplayStep, user, activeMatch, sendP2pStateUpdate, submitCoinAiAction, timeoutCoinAiMatch } = useGame();
  const [playerHand, setPlayerHand] = useState<WhotCard[]>([]);
  const [opponentHand, setOpponentHand] = useState<WhotCard[]>([]);
  const [discardPile, setDiscardPile] = useState<WhotCard[]>([]);
  const [marketDeck, setMarketDeck] = useState<WhotCard[]>([]);
  const [currentShape, setCurrentShape] = useState<WhotShape>('circle');
  const [currentNumber, setCurrentNumber] = useState<number | null>(1);
  const [turn, setTurn] = useState<'player' | 'opponent'>('player');
  const [isChoosingShape, setIsChoosingShape] = useState(false);
  const [gameMessage, setGameMessage] = useState<string>('Your turn! Match shape or number');
  const [lastAction, setLastAction] = useState<string>('');
  const [pendingPenalty, setPendingPenalty] = useState<PendingPenalty | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const isP2P = activeMatch?.isVsAi === false;
  const isHost = activeMatch
    ? activeMatch.hostUsername
      ? activeMatch.hostUsername.toLowerCase() === (user?.username || '').toLowerCase()
      : activeMatch.opponent.username.toLowerCase() !== (user?.username || '').toLowerCase()
    : true;

  // Synchronize incoming real-time P2P opponent moves via custom event
  useEffect(() => {
    const handleRemoteState = (evt: Event) => {
      const customEvt = evt as CustomEvent;
      const s = customEvt.detail;
      if (s) {
        const myRole = isHost ? 'host' : 'challenger';

        if (s.hostHand && s.challengerHand) {
          if (isHost) {
            setPlayerHand(s.hostHand);
            setOpponentHand(s.challengerHand);
          } else {
            setPlayerHand(s.challengerHand);
            setOpponentHand(s.hostHand);
          }
        } else {
          if (s.playerHand) setPlayerHand(s.playerHand);
          if (s.opponentHand) setOpponentHand(s.opponentHand);
        }

        if (s.discardPile) setDiscardPile(s.discardPile);
        if (s.marketDeck) setMarketDeck(s.marketDeck);
        if (s.currentShape) setCurrentShape(s.currentShape);
        if (s.currentNumber !== undefined) setCurrentNumber(s.currentNumber);

        if (s.turnRole) {
          setTurn(s.turnRole === myRole ? 'player' : 'opponent');
        } else if (s.turn) {
          setTurn(s.turn);
        }

        if (s.isChoosingShape !== undefined) {
          setIsChoosingShape(Boolean(s.isChoosingShape && (s.turnRole ? s.turnRole === myRole : s.turn === 'player')));
        }

        if (s.gameMessage) setGameMessage(s.gameMessage);
        if (s.lastAction) setLastAction(s.lastAction);
        if (s.pendingPenalty !== undefined) setPendingPenalty(s.pendingPenalty);

        if (s.hostTimeoutCount !== undefined && s.challengerTimeoutCount !== undefined) {
          if (isHost) {
            setPlayerTimeoutCount(s.hostTimeoutCount);
            setOpponentTimeoutCount(s.challengerTimeoutCount);
          } else {
            setPlayerTimeoutCount(s.challengerTimeoutCount);
            setOpponentTimeoutCount(s.hostTimeoutCount);
          }
        }

        if (s.isGameOver) {
          setIsGameOver(true);
          const localWon = s.winnerRole ? s.winnerRole === myRole : (s.winner === 'player' ? isHost : !isHost);
          const winner = localWon ? 'player' : 'opponent';
          sound.stopSpeech();
          if (winner === 'player') {
            sound.playWin();
            sound.speakCheckUp();
            telegram.triggerHaptic('success');
          } else {
            sound.playLoss();
            telegram.triggerHaptic('error');
          }
          onGameOverRef.current(winner);
        }
      }
    };

    window.addEventListener('p2p_game_state_update', handleRemoteState);
    return () => window.removeEventListener('p2p_game_state_update', handleRemoteState);
  }, [isHost]);

  // Nonce to trigger AI turns even when turn remains 'opponent'
  const [aiActionNonce, setAiActionNonce] = useState<number>(0);

  // Turn Countdown Timer: 20s for Whot (Forfeit defeat at 4 timeouts)
  const maxTurnTime = TURN_MODE_SECONDS[activeMatch?.turnMode || 'live'];
  const maxTimeouts = 4;
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(maxTurnTime);
  const [playerTimeoutCount, setPlayerTimeoutCount] = useState<number>(0);
  const [opponentTimeoutCount, setOpponentTimeoutCount] = useState<number>(0);

  // Safe ref for game over callback to prevent stale closures
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      sound.stopSpeech();
    };
  }, []);

  // Initialize Game
  const initGame = useCallback(() => {
    sound.stopSpeech();
    setIsGameOver(false);
    setPlayerTimeoutCount(0);
    setOpponentTimeoutCount(0);
    const deck = createFullWhotDeck();
    const pHand = deck.splice(0, 5);
    const oHand = deck.splice(0, 5);

    // Initial discard cannot be a special card (1, 2, 5, 8, 14, 20)
    let startCardIndex = 0;
    while (
      startCardIndex < deck.length &&
      ([1, 2, 5, 8, 14, 20].includes(deck[startCardIndex].number) || deck[startCardIndex].shape === 'whot')
    ) {
      startCardIndex++;
    }

    const initialDiscard = deck.splice(startCardIndex, 1)[0] || {
      id: 'init_1',
      shape: 'circle',
      number: 7,
    };

    setPlayerHand(pHand);
    setOpponentHand(oHand);
    setDiscardPile([initialDiscard]);
    setMarketDeck(deck);
    setCurrentShape(initialDiscard.shape);
    setCurrentNumber(initialDiscard.number);
    setTurn('player');
    setIsChoosingShape(false);
    setPendingPenalty(null);
    setGameMessage('Table opened! Your turn. Match shape or number.');
    setLastAction('Table opened');
    setTurnTimeLeft(maxTurnTime);

    if (isP2P && isHost && sendP2pStateUpdate) {
      sendP2pStateUpdate({
        hostHand: pHand,
        challengerHand: oHand,
        discardPile: [initialDiscard],
        marketDeck: deck,
        currentShape: initialDiscard.shape,
        currentNumber: initialDiscard.number,
        turnRole: 'host',
        isChoosingShape: false,
        pendingPenalty: null,
        gameMessage: 'Table opened! Host turn. Match shape or number.',
        lastAction: 'Table opened',
        isGameOver: false,
        hostTimeoutCount: 0,
        challengerTimeoutCount: 0,
      });
    }
  }, [maxTurnTime, isP2P, isHost, sendP2pStateUpdate]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Reset timer whenever turn transitions to player
  useEffect(() => {
    if (!isGameOver && turn === 'player') {
      setTurnTimeLeft(isP2P && activeMatch?.turnDeadlineAt ? Math.max(0, Math.ceil((activeMatch.turnDeadlineAt - Date.now()) / 1000)) : maxTurnTime);
    }
  }, [turn, maxTurnTime, isGameOver, isP2P, activeMatch?.turnDeadlineAt]);

  // Countdown timer when it's player's turn
  useEffect(() => {
    if (isGameOver || turn !== 'player') return;

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
  }, [turn, isGameOver]);

  // Handle timeout when player's 20s expires (4 timeouts = automatic forfeit defeat)
  useEffect(() => {
    if (isGameOver || turn !== 'player' || turnTimeLeft > 0) return;
    if (activeMatch?.coinMatchId) { void timeoutCoinAiMatch(); return; }

    sound.playTimeout();
    telegram.triggerHaptic('warning');

    const newTimeoutCount = playerTimeoutCount + 1;
    setPlayerTimeoutCount(newTimeoutCount);

    const oppRole = isHost ? 'challenger' : 'host';

    // 4-Timeout Forfeit Rule Check
    if (newTimeoutCount >= maxTimeouts) {
      setIsGameOver(true);
      sound.stopSpeech();
      sound.playLoss();
      telegram.triggerHaptic('error');
      setGameMessage('💀 Match Forfeited! You lost 4 turns due to timeouts.');
      setLastAction('Match forfeited (4 timeouts)');

      if (isP2P && sendP2pStateUpdate) {
        sendP2pStateUpdate({
          hostHand: isHost ? playerHand : opponentHand,
          challengerHand: isHost ? opponentHand : playerHand,
          hostTimeoutCount: isHost ? newTimeoutCount : opponentTimeoutCount,
          challengerTimeoutCount: isHost ? opponentTimeoutCount : newTimeoutCount,
          isGameOver: true,
          winnerRole: oppRole,
          lastAction: '💀 Match Forfeited! Player lost 4 turns due to timeouts.',
          gameMessage: '🏆 Opponent forfeited! Opponent lost 4 turns due to timeouts.',
        });
      }

      onGameOverRef.current('opponent');
      return;
    }

    let currentHand = playerHand;
    let newMarketState = marketDeck;
    let newDiscardState = discardPile;
    let actionText = '';
    let msgText = '';

    if (isChoosingShape) {
      setIsChoosingShape(false);
      setCurrentShape('circle');
      setCurrentNumber(null);
    }

    if (pendingPenalty) {
      // Must draw penalty cards
      const { drawn, newMarket, newDiscard } = drawFromPiles(
        pendingPenalty.count,
        marketDeck,
        discardPile
      );
      currentHand = [...playerHand, ...drawn];
      newMarketState = newMarket;
      newDiscardState = newDiscard;
      actionText = `Drew ${pendingPenalty.count} penalty cards (timeout ${newTimeoutCount}/4)`;
      msgText = `⏰ Time expired (${newTimeoutCount}/4 timeouts)! Drew ${pendingPenalty.count} penalty cards.`;
      setPlayerHand(currentHand);
      setMarketDeck(newMarketState);
      setDiscardPile(newDiscardState);
      setPendingPenalty(null);
    } else {
      // Auto-draw 1 card from market on timeout
      const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, discardPile);
      currentHand = [...playerHand, ...drawn];
      newMarketState = newMarket;
      newDiscardState = newDiscard;
      actionText = `Turn lost (timeout ${newTimeoutCount}/4)`;
      msgText = `⏰ Time expired after ${maxTurnTime >= 60 ? `${Math.floor(maxTurnTime / 60)}m` : `${maxTurnTime}s`} (${newTimeoutCount}/4 timeouts)! Drew 1 card & turn lost.`;
      setPlayerHand(currentHand);
      setMarketDeck(newMarketState);
      setDiscardPile(newDiscardState);
    }

    setGameMessage(msgText);
    setLastAction(actionText);
    setTurn('opponent');
    setAiActionNonce((n) => n + 1);

    if (isP2P && sendP2pStateUpdate) {
      sendP2pStateUpdate({
        hostHand: isHost ? currentHand : opponentHand,
        challengerHand: isHost ? opponentHand : currentHand,
        marketDeck: newMarketState,
        discardPile: newDiscardState,
        hostTimeoutCount: isHost ? newTimeoutCount : opponentTimeoutCount,
        challengerTimeoutCount: isHost ? opponentTimeoutCount : newTimeoutCount,
        turnRole: oppRole,
        pendingPenalty: null,
        gameMessage: `Opponent time expired (${newTimeoutCount}/4 timeouts)! Your turn.`,
        lastAction: `Opponent ${actionText}`,
      });
    }
  }, [
    isGameOver,
    turn,
    turnTimeLeft,
    isChoosingShape,
    pendingPenalty,
    marketDeck,
    discardPile,
    playerHand,
    opponentHand,
    playerTimeoutCount,
    opponentTimeoutCount,
    isP2P,
    isHost,
    sendP2pStateUpdate,
  ]);

  // Check if a card can be legally played by the player
  const isCardPlayable = useCallback(
    (card: WhotCard) => {
      if (turn !== 'player' || isChoosingShape) return false;

      // When there is an active penalty, player MUST defend with matching penalty number
      if (pendingPenalty) {
        return card.number === pendingPenalty.type;
      }

      // Whot 20 is wild: can be played on any card at any time
      if (card.shape === 'whot' || card.number === 20) {
        return true;
      }

      // If previous card was Whot 20 calling a shape (currentNumber is null)
      if (currentNumber === null) {
        return card.shape === currentShape;
      }

      // Standard matching: same shape OR same number
      return card.shape === currentShape || card.number === currentNumber;
    },
    [turn, isChoosingShape, pendingPenalty, currentShape, currentNumber]
  );

  // Player plays a card
  const playCard = useCallback(
    (card: WhotCard) => {
      if (isGameOver) return;
      if (activeMatch?.coinMatchId) { void submitCoinAiAction({ type: 'whot_play', cardId: card.id }); return; }
      if (!isCardPlayable(card)) return;

      const isFinishingAttempt = playerHand.length === 1;
      const isSpecial = isSpecialWhotCard(card);

      // Check authentic winning condition: CANNOT finish on any special card (1, 2, 5, 8, 14, 20)
      if (isFinishingAttempt && !isSpecial) {
        // Pure legitimate win on regular number card!
        setIsGameOver(true);
        const newHand = playerHand.filter((c) => c.id !== card.id);
        const newDiscard = [card, ...discardPile];
        setPlayerHand(newHand);
        setDiscardPile(newDiscard);
        sound.stopSpeech();
        sound.playWin();
        sound.speakCheckUp();
        telegram.triggerHaptic('success');
        recordReplayStep({
          turn: 'player',
          actorName: user?.displayName || 'Player (You)',
          actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          actionTitle: `🏆 CHECKOUT! Played ${card.shape.toUpperCase()} ${card.number}`,
          actionDescription: `Legitimately checked out by playing ${card.shape} ${card.number}!`,
          cardsCount: { player: 0, opponent: opponentHand.length },
        });

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            hostHand: isHost ? [] : opponentHand,
            challengerHand: isHost ? opponentHand : [],
            discardPile: newDiscard,
            isGameOver: true,
            winnerRole: isHost ? 'host' : 'challenger',
            lastAction: '🏆 CHECKOUT! Whot match concluded.',
            gameMessage: '🏆 Opponent checked out! Match over.',
          });
        }

        onGameOverRef.current('player');
        return;
      }

      // Remove the single played card instance from player hand by index
      const cardIdx = playerHand.findIndex((c) => c.id === card.id);
      let currentHand = cardIdx !== -1
        ? [...playerHand.slice(0, cardIdx), ...playerHand.slice(cardIdx + 1)]
        : playerHand.slice(1);
      let newMarketState = marketDeck;
      let newDiscardState = [card, ...discardPile];

      if (isFinishingAttempt && isSpecial) {
        // Penalty: cannot finish on special card! Must draw 1 penalty card from market
        const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, [card, ...discardPile]);
        currentHand = drawn;
        newMarketState = newMarket;
        newDiscardState = newDiscard;
        sound.playCardDraw();
        telegram.triggerHaptic('warning');
        setMarketDeck(newMarketState);
      }

      setPlayerHand(currentHand);
      setDiscardPile(newDiscardState);

      recordReplayStep({
        turn: 'player',
        actorName: user?.displayName || 'Player (You)',
        actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        actionTitle: card.number === 20 ? 'Played WHOT 20 (Wild)' : `Played ${card.shape.toUpperCase()} ${card.number}`,
        actionDescription: `Played ${card.shape} ${card.number} to discard pile. Hand remaining: ${currentHand.length}.`,
        cardsCount: { player: currentHand.length, opponent: opponentHand.length },
      });

      const isLastCard = currentHand.length === 1;
      if (isLastCard) {
        telegram.triggerHaptic('heavy');
      }

      // Case 1: Whot 20 (Wild card)
      if (card.shape === 'whot' || card.number === 20) {
        sound.playWhotWild();
        sound.speak(isLastCard ? 'Whot! Last card!' : 'Whot!');
        setIsChoosingShape(true);
        setPendingPenalty(null);
        let msg = 'Choose required shape:';
        let action = 'Played WHOT 20';
        if (isFinishingAttempt) {
          msg = '⚠️ Cannot check out on WHOT 20! Drew 1 penalty card. Choose required shape:';
          action = 'Tried to checkout on WHOT 20 (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : opponentHand,
            challengerHand: isHost ? opponentHand : currentHand,
            marketDeck: newMarketState,
            discardPile: newDiscardState,
            turnRole: isHost ? 'host' : 'challenger',
            isChoosingShape: true,
            pendingPenalty: null,
            gameMessage: 'Opponent played WHOT 20 and is choosing shape...',
            lastAction: `Opponent ${action}`,
          });
        }
        return;
      }

      // Case 2: Pick Two (2)
      if (card.number === 2) {
        sound.playCardPlay();
        telegram.triggerHaptic('heavy');
        const wasDefending = !!pendingPenalty;
        if (wasDefending) {
          sound.speak(isLastCard ? 'Defended! Pick Two! Last card!' : 'Defended! Pick Two!');
        } else {
          sound.speak(isLastCard ? 'Pick Two! Last card!' : 'Pick Two!');
        }
        const newCount = pendingPenalty && pendingPenalty.type === 2 ? pendingPenalty.count + 2 : 2;
        setPendingPenalty({ count: newCount, type: 2 });
        setCurrentShape(card.shape);
        setCurrentNumber(2);
        setTurn('opponent');
        setAiActionNonce((n) => n + 1);

        let msg = `🎯 Pick Two! Opponent must defend with 2 or draw ${newCount} cards.`;
        let action = `You played Pick Two (2) — Penalty is ${newCount}`;
        if (isFinishingAttempt) {
          msg = `⚠️ Cannot check out on Pick Two (2)! Drew 1 penalty card. Opponent penalty is ${newCount}.`;
          action = 'Tried to checkout on Pick 2 (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          const oppRole = isHost ? 'challenger' : 'host';
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : opponentHand,
            challengerHand: isHost ? opponentHand : currentHand,
            marketDeck: newMarketState,
            discardPile: newDiscardState,
            currentShape: card.shape,
            currentNumber: 2,
            turnRole: oppRole,
            pendingPenalty: { count: newCount, type: 2 },
            gameMessage: `⚠️ Opponent played Pick Two! Play 2 to defend or draw ${newCount} cards.`,
            lastAction: `Opponent played Pick Two (2) (penalty ${newCount})`,
          });
        }
        return;
      }

      // Case 3: Pick Three (5)
      if (card.number === 5) {
        sound.playCardPlay();
        telegram.triggerHaptic('heavy');
        const wasDefending = !!pendingPenalty;
        if (wasDefending) {
          sound.speak(isLastCard ? 'Defended! Pick Three! Last card!' : 'Defended! Pick Three!');
        } else {
          sound.speak(isLastCard ? 'Pick Three! Last card!' : 'Pick Three!');
        }
        const newCount = pendingPenalty && pendingPenalty.type === 5 ? pendingPenalty.count + 3 : 3;
        setPendingPenalty({ count: newCount, type: 5 });
        setCurrentShape(card.shape);
        setCurrentNumber(5);
        setTurn('opponent');
        setAiActionNonce((n) => n + 1);

        let msg = `🎯 Pick Three! Opponent must defend with 5 or draw ${newCount} cards.`;
        let action = `You played Pick Three (5) — Penalty is ${newCount}`;
        if (isFinishingAttempt) {
          msg = `⚠️ Cannot check out on Pick Three (5)! Drew 1 penalty card. Opponent penalty is ${newCount}.`;
          action = 'Tried to checkout on Pick 3 (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          const oppRole = isHost ? 'challenger' : 'host';
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : opponentHand,
            challengerHand: isHost ? opponentHand : currentHand,
            marketDeck: newMarketState,
            discardPile: newDiscardState,
            currentShape: card.shape,
            currentNumber: 5,
            turnRole: oppRole,
            pendingPenalty: { count: newCount, type: 5 },
            gameMessage: `⚠️ Opponent played Pick Three! Play 5 to defend or draw ${newCount} cards.`,
            lastAction: `Opponent played Pick Three (5) (penalty ${newCount})`,
          });
        }
        return;
      }

      // Case 4: Hold On (1) -> Player plays again!
      if (card.number === 1) {
        sound.playCardPlay();
        sound.speak(isLastCard ? 'Hold On! Last card!' : 'Hold On!');
        telegram.triggerHaptic('medium');
        setCurrentShape(card.shape);
        setCurrentNumber(1);
        setPendingPenalty(null);
        setTurnTimeLeft(maxTurnTime);

        let msg = '⚡ Hold On! Play another matching card or draw from Market.';
        let action = 'You played Hold On (1)';
        if (isFinishingAttempt) {
          msg = '⚠️ Cannot check out on Hold On (1)! Drew 1 penalty card. Play again or tap Market.';
          action = 'Tried to checkout on Hold On 1 (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          const myRole = isHost ? 'host' : 'challenger';
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : opponentHand,
            challengerHand: isHost ? opponentHand : currentHand,
            marketDeck: newMarketState,
            discardPile: newDiscardState,
            currentShape: card.shape,
            currentNumber: 1,
            turnRole: myRole,
            pendingPenalty: null,
            gameMessage: '⚡ Opponent called Hold On (1)! Opponent plays again...',
            lastAction: `Opponent ${action}`,
          });
        }
        return;
      }

      // Case 5: Suspension (8) -> Opponent skipped, player plays again!
      if (card.number === 8) {
        sound.playCardPlay();
        sound.speak(isLastCard ? 'Suspension! Last card!' : 'Suspension!');
        telegram.triggerHaptic('medium');
        setCurrentShape(card.shape);
        setCurrentNumber(8);
        setPendingPenalty(null);
        setTurnTimeLeft(maxTurnTime);

        let msg = '🚫 Suspension! Opponent skipped. Play another card or draw from Market.';
        let action = 'You played Suspension (8)';
        if (isFinishingAttempt) {
          msg = '⚠️ Cannot check out on Suspension (8)! Drew 1 penalty card. Opponent skipped; play again.';
          action = 'Tried to checkout on Suspension 8 (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          const myRole = isHost ? 'host' : 'challenger';
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : opponentHand,
            challengerHand: isHost ? opponentHand : currentHand,
            marketDeck: newMarketState,
            discardPile: newDiscardState,
            currentShape: card.shape,
            currentNumber: 8,
            turnRole: myRole,
            pendingPenalty: null,
            gameMessage: '🚫 Opponent played Suspension (8)! You were skipped. Opponent plays again...',
            lastAction: `Opponent ${action}`,
          });
        }
        return;
      }

      // Case 6: General Market (14) -> Opponent draws 1, player plays again!
      if (card.number === 14) {
        sound.playCardPlay();
        sound.speak(isLastCard ? 'General Market! Last card!' : 'General Market!');
        telegram.triggerHaptic('medium');
        const { drawn, newMarket, newDiscard } = drawFromPiles(1, newMarketState, newDiscardState);
        const newOpponentHand = [...opponentHand, ...drawn];
        setOpponentHand(newOpponentHand);
        setMarketDeck(newMarket);
        setDiscardPile(newDiscard);
        setCurrentShape(card.shape);
        setCurrentNumber(14);
        setPendingPenalty(null);
        setTurnTimeLeft(maxTurnTime);

        let msg = '🛒 General Market! Opponent drew 1 card. Your turn continues!';
        let action = 'You called General Market (14)';
        if (isFinishingAttempt) {
          msg = '⚠️ Cannot check out on General Market (14)! Drew 1 penalty card. Opponent drew 1.';
          action = 'Tried to checkout on General Market (+1 penalty card)';
        }
        setGameMessage(msg);
        setLastAction(action);

        if (isP2P && sendP2pStateUpdate) {
          const myRole = isHost ? 'host' : 'challenger';
          sendP2pStateUpdate({
            hostHand: isHost ? currentHand : newOpponentHand,
            challengerHand: isHost ? newOpponentHand : currentHand,
            marketDeck: newMarket,
            discardPile: newDiscard,
            currentShape: card.shape,
            currentNumber: 14,
            turnRole: myRole,
            pendingPenalty: null,
            gameMessage: '🛒 General Market (14)! You drew 1 card. Opponent plays again...',
            lastAction: `Opponent ${action}`,
          });
        }
        return;
      }

      // Case 7: Normal card
      sound.playCardPlay();
      if (isLastCard) {
        sound.speakLastCard();
      }
      telegram.triggerHaptic('light');
      setCurrentShape(card.shape);
      setCurrentNumber(card.number);
      setPendingPenalty(null);
      setLastAction(`You played ${card.shape} ${card.number}`);
      setGameMessage("Opponent's turn to play...");
      setTurn('opponent');
      setAiActionNonce((n) => n + 1);

      if (isP2P && sendP2pStateUpdate) {
        const oppRole = isHost ? 'challenger' : 'host';
        sendP2pStateUpdate({
          hostHand: isHost ? currentHand : opponentHand,
          challengerHand: isHost ? opponentHand : currentHand,
          marketDeck: newMarketState,
          discardPile: newDiscardState,
          currentShape: card.shape,
          currentNumber: card.number,
          turnRole: oppRole,
          pendingPenalty: null,
          gameMessage: `Opponent played ${card.shape} ${card.number}. Your turn!`,
          lastAction: `Opponent played ${card.shape} ${card.number}`,
        });
      }
    },
    [
      isGameOver,
      isCardPlayable,
      playerHand,
      opponentHand,
      marketDeck,
      discardPile,
      pendingPenalty,
      maxTurnTime,
      user,
      recordReplayStep,
      isP2P,
      isHost,
      sendP2pStateUpdate,
      activeMatch?.coinMatchId,
      submitCoinAiAction,
    ]
  );

  // Player chooses required shape after playing Whot 20
  const chooseShape = useCallback(
    (shape: WhotShape) => {
      if (activeMatch?.coinMatchId) { void submitCoinAiAction({ type: 'whot_choose_shape', declaredShape: shape }); return; }
      setIsChoosingShape(false);
      setCurrentShape(shape);
      setCurrentNumber(null); // Any number of this shape is acceptable
      sound.playWhotWild();
      sound.speakShapeCall(shape);
      setLastAction(`You called for ${shape.toUpperCase()}`);
      setGameMessage(`⭐ You called for ${shape.toUpperCase()}! Opponent must match.`);
      recordReplayStep({
        turn: 'player',
        actorName: user?.displayName || 'Player (You)',
        actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        actionTitle: `Called ${shape.toUpperCase()}`,
        actionDescription: `Called for ${shape.toUpperCase()}! Opponent must match shape.`,
        cardsCount: { player: playerHand.length, opponent: opponentHand.length },
      });
      setTurn('opponent');
      setAiActionNonce((n) => n + 1);

      if (isP2P && sendP2pStateUpdate) {
        const oppRole = isHost ? 'challenger' : 'host';
        sendP2pStateUpdate({
          hostHand: isHost ? playerHand : opponentHand,
          challengerHand: isHost ? opponentHand : playerHand,
          marketDeck,
          discardPile,
          currentShape: shape,
          currentNumber: null,
          isChoosingShape: false,
          turnRole: oppRole,
          gameMessage: `⭐ Opponent called for ${shape.toUpperCase()}! Match shape or play 20.`,
          lastAction: `Opponent called for ${shape.toUpperCase()}`,
        });
      }
    },
    [
      user,
      playerHand,
      opponentHand,
      marketDeck,
      discardPile,
      recordReplayStep,
      isP2P,
      isHost,
      sendP2pStateUpdate,
      activeMatch?.coinMatchId,
      submitCoinAiAction,
    ]
  );

  // Player draws from market
  const drawFromMarket = useCallback(() => {
    if (isGameOver || turn !== 'player' || isChoosingShape) return;
    if (activeMatch?.coinMatchId) { void submitCoinAiAction({ type: 'whot_draw' }); return; }

    sound.playCardDraw();
    telegram.triggerHaptic('light');

    if (pendingPenalty) {
      // Must draw accumulated penalty cards and lose turn
      const count = pendingPenalty.count;
      const { drawn, newMarket, newDiscard } = drawFromPiles(count, marketDeck, discardPile);
      const newHand = [...playerHand, ...drawn];
      setPlayerHand(newHand);
      setMarketDeck(newMarket);
      setDiscardPile(newDiscard);
      setPendingPenalty(null);
      setLastAction(`You drew ${count} penalty cards`);
      setGameMessage(`You drew ${count} penalty cards. Opponent's turn!`);
      recordReplayStep({
        turn: 'player',
        actorName: user?.displayName || 'Player (You)',
        actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        actionTitle: `Drew ${count} Penalty Cards`,
        actionDescription: `Drew ${count} penalty cards from market. Hand size: ${newHand.length}.`,
        cardsCount: { player: newHand.length, opponent: opponentHand.length },
      });
      setTurn('opponent');
      setAiActionNonce((n) => n + 1);

      if (isP2P && sendP2pStateUpdate) {
        const oppRole = isHost ? 'challenger' : 'host';
        sendP2pStateUpdate({
          hostHand: isHost ? newHand : opponentHand,
          challengerHand: isHost ? opponentHand : newHand,
          marketDeck: newMarket,
          discardPile: newDiscard,
          turnRole: oppRole,
          pendingPenalty: null,
          gameMessage: `Opponent drew ${count} penalty cards. Your turn!`,
          lastAction: `Opponent drew ${count} penalty cards`,
        });
      }
      return;
    }

    // Normal draw: pick 1 card, pass turn
    const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, discardPile);
    const newHand = [...playerHand, ...drawn];
    setPlayerHand(newHand);
    setMarketDeck(newMarket);
    setDiscardPile(newDiscard);
    setLastAction('You drew 1 card from Market');
    setGameMessage('You drew 1 card. Opponent is thinking...');
    recordReplayStep({
      turn: 'player',
      actorName: user?.displayName || 'Player (You)',
      actorAvatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      actionTitle: 'Market Draw (+1 Card)',
      actionDescription: `Drew 1 card from market deck. Hand size: ${newHand.length}.`,
      cardsCount: { player: newHand.length, opponent: opponentHand.length },
    });
    setTurn('opponent');
    setAiActionNonce((n) => n + 1);

    if (isP2P && sendP2pStateUpdate) {
      const oppRole = isHost ? 'challenger' : 'host';
      sendP2pStateUpdate({
        hostHand: isHost ? newHand : opponentHand,
        challengerHand: isHost ? opponentHand : newHand,
        marketDeck: newMarket,
        discardPile: newDiscard,
        turnRole: oppRole,
        pendingPenalty: null,
        gameMessage: 'Opponent went to market (drew 1 card). Your turn!',
        lastAction: 'Opponent went to market',
      });
    }
  }, [
    isGameOver,
    turn,
    isChoosingShape,
    pendingPenalty,
    marketDeck,
    discardPile,
    playerHand,
    opponentHand,
    user,
    recordReplayStep,
    isP2P,
    isHost,
    sendP2pStateUpdate,
  ]);

  // AI Opponent Turn Handler
  useEffect(() => {
    if (isGameOver || turn !== 'opponent' || activeMatch?.isVsAi === false) return;

    const timer = setTimeout(() => {
      if (isGameOver) return;

      // Handle pending penalty defense or draw
      if (pendingPenalty) {
        const defenseCard = opponentHand.find((c) => c.number === pendingPenalty.type);
        if (defenseCard) {
          // AI defends!
          const newOppHand = opponentHand.filter((c) => c.id !== defenseCard.id);
          const isAiLastCard = newOppHand.length === 1;
          sound.playCardPlay();
          const typeText = pendingPenalty.type === 2 ? 'Pick Two!' : 'Pick Three!';
          sound.speak(isAiLastCard ? `Defended! ${typeText} Last card!` : `Defended! ${typeText}`);

          setOpponentHand(newOppHand);
          setDiscardPile((prev) => [defenseCard, ...prev]);
          setCurrentShape(defenseCard.shape);
          setCurrentNumber(defenseCard.number);

          const added = pendingPenalty.type === 2 ? 2 : 3;
          const newCount = pendingPenalty.count + added;
          setPendingPenalty({ count: newCount, type: pendingPenalty.type });
          setLastAction(`Opponent defended with ${pendingPenalty.type}! Penalty is now ${newCount}`);
          setGameMessage(`⚡ Opponent defended with ${pendingPenalty.type}! Penalty is now ${newCount}! Defend or Draw.`);
          recordReplayStep({
            turn: 'opponent',
            actorName: activeMatch?.opponent.displayName || 'Crimson Opponent',
            actorAvatar: activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            actionTitle: `Defended with ${pendingPenalty.type}!`,
            actionDescription: `Opponent counter-played ${pendingPenalty.type}. Penalty increased to ${newCount}.`,
            cardsCount: { player: playerHand.length, opponent: newOppHand.length },
          });
          setTurn('player');
          return;
        } else {
          // AI cannot defend: draws penalty cards and turn returns to player
          sound.playCardDraw();
          const count = pendingPenalty.count;
          const { drawn, newMarket, newDiscard } = drawFromPiles(count, marketDeck, discardPile);
          setOpponentHand((h) => [...h, ...drawn]);
          setMarketDeck(newMarket);
          setDiscardPile(newDiscard);
          setPendingPenalty(null);
          setLastAction(`Opponent drew ${count} penalty cards`);
          setGameMessage(`🎯 Opponent drew ${count} penalty cards! Your turn to play.`);
          recordReplayStep({
            turn: 'opponent',
            actorName: activeMatch?.opponent.displayName || 'Crimson Opponent',
            actorAvatar: activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            actionTitle: `Drew ${count} Penalty Cards`,
            actionDescription: `Opponent drew ${count} penalty cards from market.`,
            cardsCount: { player: playerHand.length, opponent: opponentHand.length + count },
          });
          setTurn('player');
          return;
        }
      }

      // Normal turn: find valid playable cards
      const validCards = opponentHand.filter((c) => {
        if (c.shape === 'whot' || c.number === 20) return true;
        if (currentNumber === null) return c.shape === currentShape;
        return c.shape === currentShape || c.number === currentNumber;
      });

      if (validCards.length > 0) {
        // AI selects best card: if down to 1 card, prioritize regular cards to legitimately win!
        let cardToPlay: WhotCard;

        if (opponentHand.length === 1) {
          cardToPlay =
            validCards.find((c) => !isSpecialWhotCard(c)) || validCards[0];
        } else {
          const shapeCounts = new Map<string, number>();
          for (const card of opponentHand) {
            if (card.shape !== 'whot') shapeCounts.set(card.shape, (shapeCounts.get(card.shape) || 0) + 1);
          }
          cardToPlay = validCards.reduce((best, card) => {
            const shape = card.shape === 'whot'
              ? [...shapeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
              : card.shape;
            const remainingSupport = shape
              ? opponentHand.filter((held) => held.id !== card.id && held.shape === shape).length
              : 0;
            const pressure = [2, 5].includes(card.number)
              ? 80 + Math.min(playerHand.length, 8) * 10
              : card.number === 14
                ? 50 + Math.min(playerHand.length, 8) * 5
                : [1, 8].includes(card.number) ? 40 : 0;
            const score = remainingSupport * 12 + pressure - (card.number === 20 ? 35 : 0)
              - (isSpecialWhotCard(card) ? 0 : 4);
            const bestShape = best.shape === 'whot'
              ? [...shapeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
              : best.shape;
            const bestSupport = bestShape
              ? opponentHand.filter((held) => held.id !== best.id && held.shape === bestShape).length
              : 0;
            const bestPressure = [2, 5].includes(best.number)
              ? 80 + Math.min(playerHand.length, 8) * 10
              : best.number === 14
                ? 50 + Math.min(playerHand.length, 8) * 5
                : [1, 8].includes(best.number) ? 40 : 0;
            const bestScore = bestSupport * 12 + bestPressure - (best.number === 20 ? 35 : 0)
              - (isSpecialWhotCard(best) ? 0 : 4);
            return score > bestScore ? card : best;
          }, validCards[0]);
        }

        const isAiFinishingAttempt = opponentHand.length === 1;
        const isAiSpecial = isSpecialWhotCard(cardToPlay);

        // Check authentic winning condition for AI: cannot finish on special card
        if (isAiFinishingAttempt && !isAiSpecial) {
          setIsGameOver(true);
          setOpponentHand([]);
          setDiscardPile((prev) => [cardToPlay, ...prev]);
          sound.stopSpeech();
          sound.playLoss();
          sound.speakCheckUp();
          telegram.triggerHaptic('error');
          recordReplayStep({
            turn: 'opponent',
            actorName: activeMatch?.opponent.displayName || 'Crimson Opponent',
            actorAvatar: activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            actionTitle: `🏆 CHECKOUT! Played ${cardToPlay.shape.toUpperCase()} ${cardToPlay.number}`,
            actionDescription: `Opponent legitimately checked out with ${cardToPlay.shape} ${cardToPlay.number}!`,
            cardsCount: { player: playerHand.length, opponent: 0 },
          });
          onGameOverRef.current('opponent');
          return;
        }

        let currentOppHand = opponentHand.filter((c) => c.id !== cardToPlay.id);
        let newMarketState = marketDeck;
        let newDiscardState = [cardToPlay, ...discardPile];

        // If AI attempted to finish on a special card, penalize with 1 card draw
        if (isAiFinishingAttempt && isAiSpecial) {
          const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, [cardToPlay, ...discardPile]);
          currentOppHand = drawn;
          newMarketState = newMarket;
          newDiscardState = newDiscard;
          setMarketDeck(newMarketState);
          setGameMessage(
            `Opponent tried to check out on special card (${cardToPlay.number === 20 ? 'WHOT 20' : cardToPlay.number}) and drew 1 penalty card!`
          );
        }

        setOpponentHand(currentOppHand);
        setDiscardPile(newDiscardState);

        recordReplayStep({
          turn: 'opponent',
          actorName: activeMatch?.opponent.displayName || 'Crimson Opponent',
          actorAvatar: activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          actionTitle: cardToPlay.number === 20 ? 'Played WHOT 20 (Wild)' : `Played ${cardToPlay.shape.toUpperCase()} ${cardToPlay.number}`,
          actionDescription: `Opponent played ${cardToPlay.shape} ${cardToPlay.number}. Hand remaining: ${currentOppHand.length}.`,
          cardsCount: { player: playerHand.length, opponent: currentOppHand.length },
        });

        const isAiLastCard = currentOppHand.length === 1;

        // Whot 20 played by AI
        if (cardToPlay.shape === 'whot' || cardToPlay.number === 20) {
          sound.playWhotWild();
          const shapeCounts: Record<string, number> = {};
          currentOppHand.forEach((c) => {
            if (c.shape !== 'whot') {
              shapeCounts[c.shape] = (shapeCounts[c.shape] || 0) + 1;
            }
          });
          const bestShape = (Object.keys(shapeCounts).sort(
            (a, b) => shapeCounts[b] - shapeCounts[a]
          )[0] || 'circle') as WhotShape;

          setCurrentShape(bestShape);
          setCurrentNumber(null);
          sound.speak(isAiLastCard ? `${bestShape}! Last card!` : `${bestShape}!`);
          setLastAction(`Opponent played WHOT 20 and called ${bestShape.toUpperCase()}`);
          setGameMessage(`🤖 Opponent played WHOT 20 and called for ${bestShape.toUpperCase()}!`);
          setTurn('player');
          return;
        }

        // Special Card: Pick Two (2)
        if (cardToPlay.number === 2) {
          sound.playCardPlay();
          sound.speak(isAiLastCard ? 'Pick Two! Last card!' : 'Pick Two!');
          setPendingPenalty({ count: 2, type: 2 });
          setCurrentShape(cardToPlay.shape);
          setCurrentNumber(2);
          setLastAction('Opponent played Pick Two (2)');
          setGameMessage('⚠️ Opponent played Pick Two! Play a 2 to defend or tap Market to draw.');
          setTurn('player');
          return;
        }

        // Special Card: Pick Three (5)
        if (cardToPlay.number === 5) {
          sound.playCardPlay();
          sound.speak(isAiLastCard ? 'Pick Three! Last card!' : 'Pick Three!');
          setPendingPenalty({ count: 3, type: 5 });
          setCurrentShape(cardToPlay.shape);
          setCurrentNumber(5);
          setLastAction('Opponent played Pick Three (5)');
          setGameMessage('⚠️ Opponent played Pick Three! Play a 5 to defend or tap Market to draw.');
          setTurn('player');
          return;
        }

        // Special Card: Hold On (1) -> Opponent plays again!
        if (cardToPlay.number === 1) {
          sound.playCardPlay();
          sound.speak(isAiLastCard ? 'Hold On! Last card!' : 'Hold On!');
          setCurrentShape(cardToPlay.shape);
          setCurrentNumber(1);
          setLastAction('Opponent played Hold On (1)');
          setGameMessage('⚡ Opponent called Hold On (1)! Opponent plays again...');
          // Opponent retains turn and takes next action cleanly
          setAiActionNonce((n) => n + 1);
          return;
        }

        // Special Card: Suspension (8) -> Player skipped, opponent plays again!
        if (cardToPlay.number === 8) {
          sound.playCardPlay();
          sound.speak(isAiLastCard ? 'Suspension! Last card!' : 'Suspension!');
          setCurrentShape(cardToPlay.shape);
          setCurrentNumber(8);
          setLastAction('Opponent played Suspension (8)');
          setGameMessage('🚫 Opponent played Suspension (8)! You were skipped. Opponent plays again...');
          setAiActionNonce((n) => n + 1);
          return;
        }

        // Special Card: General Market (14) -> Player draws 1, opponent plays again!
        if (cardToPlay.number === 14) {
          sound.playCardPlay();
          sound.speak(isAiLastCard ? 'General Market! Last card!' : 'General Market!');
          const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, [cardToPlay, ...discardPile]);
          setPlayerHand((h) => [...h, ...drawn]);
          setMarketDeck(newMarket);
          setDiscardPile(newDiscard);
          setCurrentShape(cardToPlay.shape);
          setCurrentNumber(14);
          setLastAction('Opponent called General Market (14)');
          setGameMessage('🛒 General Market (14)! You drew 1 card. Opponent plays again...');
          setAiActionNonce((n) => n + 1);
          return;
        }

        // Normal card played by AI
        sound.playCardPlay();
        if (isAiLastCard) {
          sound.speakLastCard();
        }
        setCurrentShape(cardToPlay.shape);
        setCurrentNumber(cardToPlay.number);
        setLastAction(`Opponent played ${cardToPlay.shape} ${cardToPlay.number}`);
        setGameMessage(`Opponent played ${cardToPlay.shape} ${cardToPlay.number}. Your turn!`);
        setTurn('player');
      } else {
        // AI has no valid move: draws 1 card from Market and turn passes to player
        sound.playCardDraw();
        const { drawn, newMarket, newDiscard } = drawFromPiles(1, marketDeck, discardPile);
        setOpponentHand((h) => [...h, ...drawn]);
        setMarketDeck(newMarket);
        setDiscardPile(newDiscard);
        setLastAction('Opponent went to market');
        setGameMessage('Opponent went to market (drew 1 card). Your turn!');
        recordReplayStep({
          turn: 'opponent',
          actorName: activeMatch?.opponent.displayName || 'Crimson Opponent',
          actorAvatar: activeMatch?.opponent.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          actionTitle: 'Went to Market (+1 Card)',
          actionDescription: 'Opponent had no valid move and drew 1 card from market.',
          cardsCount: { player: playerHand.length, opponent: opponentHand.length + 1 },
        });
        setTurn('player');
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [
    isGameOver,
    turn,
    aiActionNonce,
    opponentHand,
    pendingPenalty,
    currentShape,
    currentNumber,
    marketDeck,
    discardPile,
    playerHand.length,
    user,
    activeMatch,
    recordReplayStep,
  ]);

  return {
    playerHand,
    opponentHand,
    discardPile,
    marketDeckCount: marketDeck.length,
    currentShape,
    currentNumber,
    turn,
    isChoosingShape,
    gameMessage,
    lastAction,
    pendingPenalty,
    isCardPlayable,
    playCard,
    chooseShape,
    drawFromMarket,
    restartGame: initGame,
    turnTimeLeft,
    maxTurnTime,
    playerTimeoutCount,
    opponentTimeoutCount,
    maxTimeouts,
  };
}
