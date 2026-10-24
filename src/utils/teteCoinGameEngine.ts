import { GameMode, LudoToken, WhotCard, WhotShape, DraughtsPiece, DraughtsMove } from '../types';
import { BeadPiece, BeadPlayer, Move, applyBead16Move, checkBead16Winner, createInitialBead16Board, getBestBead16AIMove, getLegalBead16Moves } from './bead16Engine';

export type CoinGameState = Record<string, any> & { sequence: number; lastMoveId: string | null; turnDeadlineAt: number };
export type CoinGameAction =
  | { type: 'bead16_move'; from: number; to: number }
  | { type: 'whot_play'; cardId: string; declaredShape?: WhotShape }
  | { type: 'whot_choose_shape'; declaredShape: Exclude<WhotShape, 'whot'> }
  | { type: 'whot_draw' }
  | { type: 'draughts_move'; fromRow: number; fromCol: number; toRow: number; toCol: number }
  | { type: 'ludo_roll' }
  | { type: 'ludo_move'; tokenId: string }
  | { type: 'ludo_blitz_move'; tokenId: string; cardId: string }
  | { type: 'ludo_blitz_pass' };

export interface CoinGameTransition { state: CoinGameState; winner: BeadPlayer | null }
const deadline = (mode: GameMode) => Date.now() + (mode === 'ludo_blitz' ? 45 : 3600) * 1000;
const shuffle = <T,>(items: T[]) => { const a = [...items]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function initialWhotDeck(): WhotCard[] {
  const cards: WhotCard[] = [];
  let id = 0;
  const numbers: Record<Exclude<WhotShape, 'whot'>, number[]> = {
    circle: [1,2,3,4,5,7,8,10,11,12,13,14], triangle: [1,2,3,4,5,7,8,10,11,12,13,14],
    cross: [1,2,3,5,7,10,11,13,14], square: [1,2,3,5,7,10,11,13,14], star: [1,2,3,4,5,7,8],
  };
  for (const [shape, values] of Object.entries(numbers) as [Exclude<WhotShape, 'whot'>, number[]][]) for (const number of values) cards.push({ id: `wh_${++id}`, shape, number, isSpecial: [1,2,5,8,14].includes(number) });
  for (let i = 0; i < 5; i++) cards.push({ id: `wh_${++id}`, shape: 'whot', number: 20, isSpecial: true });
  return shuffle(cards);
}

function initialDraughts(): DraughtsPiece[] {
  const pieces: DraughtsPiece[] = []; let id = 1;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2 === 1) pieces.push({ id: `c_${id++}`, color: 'crimson', row: r, col: c, isKing: false });
  for (let r = 6; r < 10; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2 === 1) pieces.push({ id: `g_${id++}`, color: 'gold', row: r, col: c, isKing: false });
  return pieces;
}

export function createCoinGameState(mode: GameMode): CoinGameState {
  const common = { sequence: 0, lastMoveId: null, turnDeadlineAt: deadline(mode) };
  if (mode === 'bead16') return { ...common, board: createInitialBead16Board(), turn: 'p2' as BeadPlayer, mustContinueJumpNode: null, lastMoveTrail: null };
  if (mode === 'whot') { const deck = initialWhotDeck(); const playerHand = deck.splice(0, 6), opponentHand = deck.splice(0, 6); const topIdx = deck.findIndex(c => c.shape !== 'whot'); const top = deck.splice(topIdx, 1)[0]; return { ...common, playerHand, opponentHand, marketDeck: deck, discardPile: [top], turn: 'player', currentShape: top.shape, currentNumber: top.number, pendingPenalty: null, isChoosingShape: false }; }
  if (mode === 'draughts') return { ...common, pieces: initialDraughts(), turn: 'player', playerCapturedCount: 0, opponentCapturedCount: 0, chainPieceId: null };
  const token = (id: string, color: 'red' | 'yellow', index: number): LudoToken => ({ id, color, index, step: -1 });
  const playerTokens = Array.from({ length: 4 }, (_, i) => token(`p${i}`, 'red', i));
  const opponentTokens = Array.from({ length: 4 }, (_, i) => token(`o${i}`, 'yellow', i));
  if (mode === 'ludo_blitz') return { ...common, playerTokens, opponentTokens, turn: 'player', blitzCards: shuffle(Array.from({ length: 4 }, (_, i) => ({ id: `bc_${i}_${crypto.randomUUID()}`, value: i === 0 ? 6 : Math.ceil(Math.random() * 6) }))), opponentBlitzCards: shuffle(Array.from({ length: 4 }, (_, i) => ({ id: `obc_${i}_${crypto.randomUUID()}`, value: i === 0 ? 6 : Math.ceil(Math.random() * 6) }))), diceValue: null };
  return { ...common, playerTokens, opponentTokens, turn: 'player', diceValue: null };
}

function draughtsMoves(pieces: DraughtsPiece[], color: DraughtsPiece['color'], chainPieceId: string | null): DraughtsMove[] {
  const at = (r: number, c: number) => pieces.find(p => p.row === r && p.col === c);
  const captures: DraughtsMove[] = []; const quiet: DraughtsMove[] = [];
  for (const p of pieces.filter(x => x.color === color && (!chainPieceId || x.id === chainPieceId))) {
    for (const dr of [-1,1]) for (const dc of [-1,1]) {
      const r = p.row + dr, c = p.col + dc;
      if (p.isKing || (p.color === 'gold' ? dr === -1 : dr === 1)) { if (r >= 0 && r < 10 && c >= 0 && c < 10 && !at(r,c) && !chainPieceId) quiet.push({ fromRow:p.row,fromCol:p.col,toRow:r,toCol:c }); }
      const tr = p.row + 2*dr, tc = p.col + 2*dc, mid = at(r,c);
      if (tr >= 0 && tr < 10 && tc >= 0 && tc < 10 && mid && mid.color !== color && !at(tr,tc)) captures.push({ fromRow:p.row,fromCol:p.col,toRow:tr,toCol:tc,capturedPiece:mid });
    }
  }
  return captures.length ? captures : quiet;
}

export function getBestDraughtsAIMove(pieces: DraughtsPiece[], aiColor: DraughtsPiece['color'], chainPieceId: string | null = null): DraughtsMove | null {
  const other = (color: DraughtsPiece['color']) => color === 'gold' ? 'crimson' : 'gold';
  const evaluate = (board: DraughtsPiece[]) => board.reduce((score, piece) => {
    const sign = piece.color === aiColor ? 1 : -1;
    const advancement = piece.color === 'crimson' ? piece.row : 9 - piece.row;
    const center = 4.5 - Math.abs(piece.col - 4.5);
    return score + sign * ((piece.isKing ? 180 : 100) + advancement * (piece.isKing ? 1 : 3) + center * 2);
  }, 0);
  const apply = (board: DraughtsPiece[], move: DraughtsMove, color: DraughtsPiece['color']) => {
    const piece = board.find(p => p.row === move.fromRow && p.col === move.fromCol)!;
    const next = board.filter(p => p.id !== move.capturedPiece?.id).map(p => p.id === piece.id
      ? { ...p, row: move.toRow, col: move.toCol, isKing: p.isKing || (p.color === 'gold' ? move.toRow === 0 : move.toRow === 9) }
      : p);
    const moved = next.find(p => p.id === piece.id)!;
    const chain = Boolean(move.capturedPiece && draughtsMoves(next, color, moved.id).some(m => m.capturedPiece));
    return { board: next, chainId: chain ? moved.id : null };
  };
  const search = (board: DraughtsPiece[], color: DraughtsPiece['color'], forcedId: string | null, turnsLeft: number, alpha: number, beta: number): number => {
    if (turnsLeft <= 0) return evaluate(board);
    const moves = draughtsMoves(board, color, forcedId);
    if (!moves.length) return color === aiColor ? -10000 - turnsLeft : 10000 + turnsLeft;
    const maximizing = color === aiColor;
    let best = maximizing ? -Infinity : Infinity;
    for (const move of moves) {
      const next = apply(board, move, color);
      const sameTurn = Boolean(next.chainId);
      const score = search(next.board, sameTurn ? color : other(color), next.chainId, sameTurn ? turnsLeft : turnsLeft - 1, alpha, beta);
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
      if (maximizing) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  };

  const moves = draughtsMoves(pieces, aiColor, chainPieceId);
  if (!moves.length) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = apply(pieces, move, aiColor);
    const sameTurn = Boolean(next.chainId);
    const score = search(next.board, sameTurn ? aiColor : other(aiColor), next.chainId, sameTurn ? 3 : 2, -Infinity, Infinity);
    if (score > bestScore) { bestScore = score; best = move; }
  }
  return best;
}

function chooseWhotCard(hand: WhotCard[], state: CoinGameState, playerHandCount: number): WhotCard | null {
  const penalty = state.pendingPenalty as { count: number; type: 2 | 5 } | null;
  const valid = hand.filter(card => penalty
    ? card.number === penalty.type
    : card.shape === 'whot' || (state.currentNumber === null ? card.shape === state.currentShape : card.shape === state.currentShape || card.number === state.currentNumber));
  if (!valid.length) return null;
  const frequency = new Map<string, number>();
  for (const card of hand) if (card.shape !== 'whot') frequency.set(card.shape, (frequency.get(card.shape) || 0) + 1);
  return valid.reduce((best, card) => {
    const after = hand.filter(c => c.id !== card.id);
    const shape = card.shape === 'whot'
      ? [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
      : card.shape;
    const shapeSupport = shape ? after.filter(c => c.shape === shape).length : 0;
    const canFinish = after.length === 0 && !card.isSpecial && card.number !== 20;
    const tactical = card.number === 2 || card.number === 5 ? 90 + Math.min(playerHandCount, 8) * 8
      : card.number === 14 ? 45 + Math.min(playerHandCount, 8) * 3
      : card.number === 1 || card.number === 8 ? 40
      : 0;
    const score = (canFinish ? 10000 : 0) + tactical + shapeSupport * 12 - (card.number === 20 ? 35 : 0) - (card.isSpecial ? 0 : 4);
    const bestScore = (() => {
      const bestAfter = hand.filter(c => c.id !== best.id);
      const bestShape = best.shape === 'whot' ? [...frequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : best.shape;
      const bestSupport = bestShape ? bestAfter.filter(c => c.shape === bestShape).length : 0;
      return (bestAfter.length === 0 && !best.isSpecial && best.number !== 20 ? 10000 : 0)
        + (best.number === 2 || best.number === 5 ? 90 + Math.min(playerHandCount, 8) * 8 : best.number === 14 ? 45 + Math.min(playerHandCount, 8) * 3 : best.number === 1 || best.number === 8 ? 40 : 0)
        + bestSupport * 12 - (best.number === 20 ? 35 : 0) - (best.isSpecial ? 0 : 4);
    })();
    return score > bestScore ? card : best;
  }, valid[0]);
}

function chooseLudoToken(state: CoinGameState, side: 'player' | 'opponent', value: number): LudoToken | null {
  const own: LudoToken[] = state[side === 'player' ? 'playerTokens' : 'opponentTokens'];
  const enemy: LudoToken[] = state[side === 'player' ? 'opponentTokens' : 'playerTokens'];
  const color = side === 'player' ? 'red' : 'yellow';
  const safe = [0, 8, 13, 21, 26, 34, 39, 47];
  const choices = own.filter(token => canLudoMove(token, value));
  if (!choices.length) return null;
  const scoreToken = (token: LudoToken) => {
    const step = token.step === -1 ? 0 : token.step + value;
    const absolute = step < 51 ? ((color === 'red' ? step : step + 26) % 52) : null;
    const capture = absolute !== null && !safe.includes(absolute) && enemy.some(e => e.step >= 0 && e.step < 51 && ((e.color === 'red' ? e.step : e.step + 26) % 52) === absolute);
    const threatened = step < 51 && own.some(other => other.id !== token.id && other.step >= 0 && other.step < 51 && Math.abs(other.step - step) <= 6);
    return (capture ? 1000 : 0) + (step === 56 ? 1500 : 0) + (token.step === -1 ? 180 : 0)
      + (absolute !== null && safe.includes(absolute) ? 100 : 0) + step * 3 + (threatened ? -20 : 0);
  };
  return choices.reduce((best, token) => scoreToken(token) > scoreToken(best) ? token : best, choices[0]);
}

function chooseLudoCard(state: CoinGameState, hand: { id: string; value: number }[]): { card: { id: string; value: number }; token: LudoToken } | null {
  const options = hand.map(card => ({ card, token: chooseLudoToken(state, 'opponent', card.value) }))
    .filter((item): item is { card: { id: string; value: number }; token: LudoToken } => Boolean(item.token));
  if (!options.length) return null;
  const score = (item: { card: { id: string; value: number }; token: LudoToken }) => {
    const after = item.token.step === -1 ? 0 : item.token.step + item.card.value;
    const color = item.token.color;
    const absolute = after < 51 ? ((color === 'red' ? after : after + 26) % 52) : null;
    const safe = [0, 8, 13, 21, 26, 34, 39, 47];
    const victims = state.playerTokens as LudoToken[];
    const capture = absolute !== null && !safe.includes(absolute) && victims.some(t => t.step >= 0 && t.step < 51 && ((t.color === 'red' ? t.step : t.step + 26) % 52) === absolute);
    return (capture ? 1000 : 0) + (after === 56 ? 1500 : 0) + (item.token.step === -1 ? 180 : 0) + after * 3;
  };
  return options.reduce((best, item) => score(item) > score(best) ? item : best, options[0]);
}

function canLudoMove(token: LudoToken, value: number) { return token.step < 56 && (token.step === -1 ? value === 6 : token.step + value <= 56); }
function moveLudo(state: CoinGameState, player: 'player'|'opponent', tokenId: string, value: number) {
  const mineKey = player === 'player' ? 'playerTokens' : 'opponentTokens', otherKey = player === 'player' ? 'opponentTokens' : 'playerTokens';
  let mine: LudoToken[] = state[mineKey].map((t: LudoToken) => ({ ...t })); let other: LudoToken[] = state[otherKey].map((t: LudoToken) => ({ ...t }));
  const token = mine.find(t => t.id === tokenId); if (!token || !canLudoMove(token,value)) throw new Error('That token cannot move with this roll.');
  token.step = token.step === -1 ? 0 : token.step + value;
  if (token.step < 51) {
    const absolute = (token.color === 'red' ? token.step : token.step + 26) % 52;
    if (![0,8,13,21,26,34,39,47].includes(absolute)) { const victim = other.find(t => t.step >= 0 && t.step < 51 && ((t.color === 'red' ? t.step : t.step + 26) % 52) === absolute); if (victim) victim.step = -1; }
  }
  state[mineKey] = mine; state[otherKey] = other;
  return mine.every(t => t.step === 56);
}

function doWhotPlay(state: CoinGameState, who: 'player'|'opponent', cardId: string, declaredShape?: WhotShape) {
  const handKey = who === 'player' ? 'playerHand' : 'opponentHand'; let hand: WhotCard[] = [...state[handKey]];
  const idx = hand.findIndex(c => c.id === cardId); if (idx < 0) throw new Error('That card is not in your hand.');
  const card = hand[idx], penalty = state.pendingPenalty as {count:number;type:2|5}|null;
  const playable = penalty ? card.number === penalty.type : card.shape === 'whot' || state.isChoosingShape ? (card.shape === 'whot' || card.shape === state.currentShape) : card.shape === state.currentShape || card.number === state.currentNumber;
  if (!playable) throw new Error('That card does not match the active Whot card.');
  hand.splice(idx,1); let winner: BeadPlayer|null = hand.length === 0 && !card.isSpecial && card.number !== 20 ? (who === 'player' ? 'p2' : 'p1') : null;
  state[handKey] = hand; state.discardPile = [card,...state.discardPile]; state.currentShape = card.shape === 'whot' ? declaredShape : card.shape; state.currentNumber = card.number === 20 ? null : card.number; state.isChoosingShape = card.number === 20 && !declaredShape;
  if (card.number === 20 && declaredShape && !['circle','triangle','cross','square','star'].includes(String(declaredShape))) throw new Error('Choose a shape for Whot 20.');
  if (card.number === 2 || card.number === 5) state.pendingPenalty = { type: card.number, count: penalty && penalty.type === card.number ? penalty.count + (card.number === 5 ? 3 : 2) : card.number === 5 ? 3 : 2 };
  else if (penalty) state.pendingPenalty = null;
  if (hand.length === 0 && !winner) { const drawn = state.marketDeck.shift(); if (drawn) hand.push(drawn); state[handKey] = hand; }
  const next = who === 'player' ? 'opponent' : 'player';
  state.turn = card.number === 20 && !declaredShape ? who : ([1, 8].includes(card.number) ? who : next);
  if (card.number === 14 && who === 'opponent') {
    const drawn = state.marketDeck.shift(); if (drawn) state.playerHand.push(drawn);
    state.turn = 'player';
  } else if (card.number === 14 && who === 'player') {
    const drawn = state.marketDeck.shift(); if (drawn) state.opponentHand.push(drawn);
    state.turn = 'player';
  }
  return winner;
}

function drawWhotCards(state: CoinGameState, who: 'player'|'opponent', requested: number) {
  const handKey = who === 'player' ? 'playerHand' : 'opponentHand';
  for (let i=0; i<requested; i++) {
    if (!state.marketDeck.length && state.discardPile.length > 1) { const top=state.discardPile[0]; state.marketDeck=shuffle(state.discardPile.slice(1)); state.discardPile=[top]; }
    const card=state.marketDeck.shift(); if (!card) break; state[handKey].push(card);
  }
}

export function applyCoinGameAction(mode: GameMode, current: CoinGameState, action: CoinGameAction): CoinGameTransition {
  const state: CoinGameState = structuredClone(current); let winner: BeadPlayer|null = null;
  if (mode === 'bead16' && action.type === 'bead16_move') {
    if (state.turn !== 'p2') throw new Error('It is not your turn.');
    const move = getLegalBead16Moves(state.board as BeadPiece[], 'p2', state.mustContinueJumpNode).find((m: Move) => m.from === action.from && m.to === action.to);
    if (!move) throw new Error('That move is not legal.');
    const apply = (m: Move, p: BeadPlayer) => { state.board = applyBead16Move(state.board,m); state.lastMoveTrail = {from:m.from,to:m.to}; const follow = m.captured !== undefined ? getLegalBead16Moves(state.board,p,m.to).filter(x=>x.captured!==undefined) : []; if (follow.length) state.mustContinueJumpNode=m.to; else { state.mustContinueJumpNode=null; const result=checkBead16Winner(state.board); if(result.winner) winner=result.winner; else state.turn=p==='p1'?'p2':'p1'; } };
    apply(move,'p2'); let n=0; while (!winner && state.turn==='p1' && n++<40) { const moves=getLegalBead16Moves(state.board,'p1',state.mustContinueJumpNode); const best=getBestBead16AIMove(state.board,'p1'); const pick=best && moves.some(m=>m.from===best.from&&m.to===best.to)?best:moves[0]; if(!pick){winner='p2';break;} apply(pick,'p1'); }
  } else if (mode === 'whot' && (action.type === 'whot_play' || action.type === 'whot_draw' || action.type === 'whot_choose_shape')) {
    if (state.turn !== 'player') throw new Error('It is not your turn.');
    if (action.type === 'whot_draw') { if(state.isChoosingShape) throw new Error('Choose a shape before continuing.'); const penalty=state.pendingPenalty as {count:number;type:2|5}|null; drawWhotCards(state,'player',penalty?.count||1); state.pendingPenalty=null; state.isChoosingShape=false; state.turn='opponent'; }
    else if(action.type==='whot_choose_shape'){if(!state.isChoosingShape)throw new Error('You do not need to choose a shape.');state.currentShape=action.declaredShape;state.isChoosingShape=false;state.turn='opponent';}
    else winner=doWhotPlay(state,'player',action.cardId,action.declaredShape);
    if(!winner && state.turn==='opponent') {
      let aiTurns=0;
      while(state.turn==='opponent'&&aiTurns++<30&&!winner) {
        const hand=state.opponentHand as WhotCard[];
        const valid=chooseWhotCard(hand,state,(state.playerHand as WhotCard[]).length);
        if(!valid) { const penalty=state.pendingPenalty as {count:number;type:2|5}|null; drawWhotCards(state,'opponent',penalty?.count||1); state.pendingPenalty=null; state.isChoosingShape=false; state.turn='player'; break; }
        const shapeCounts = new Map<string, number>();
        for (const card of hand) if (card.id !== valid.id && card.shape !== 'whot') shapeCounts.set(card.shape, (shapeCounts.get(card.shape) || 0) + 1);
        const declaredShape = valid.shape === 'whot'
          ? [...shapeCounts.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] as WhotShape | undefined || 'circle'
          : undefined;
        winner=doWhotPlay(state,'opponent',valid.id,declaredShape);
        if(state.isChoosingShape){state.currentShape='circle';state.isChoosingShape=false;state.turn='player';}
      }
      if(aiTurns>=30&&state.turn==='opponent') throw new Error('AI turn exceeded its action limit.');
    }
  } else if (mode === 'draughts' && action.type === 'draughts_move') {
    if(state.turn!=='player') throw new Error('It is not your turn.');
    const legal=draughtsMoves(state.pieces,'gold',state.chainPieceId);
    const move=legal.find(m=>m.fromRow===action.fromRow&&m.fromCol===action.fromCol&&m.toRow===action.toRow&&m.toCol===action.toCol); if(!move) throw new Error('That Draughts move is not legal.');
    const apply=(m:DraughtsMove,color:'gold'|'crimson')=>{ const piece=state.pieces.find((p:DraughtsPiece)=>p.row===m.fromRow&&p.col===m.fromCol); state.pieces=state.pieces.filter((p:DraughtsPiece)=>p.id!==m.capturedPiece?.id).map((p:DraughtsPiece)=>p.id===piece.id?{...p,row:m.toRow,col:m.toCol,isKing:p.isKing||(p.color==='gold'&&m.toRow===0)||(p.color==='crimson'&&m.toRow===9)}:p); if(m.capturedPiece){const further=draughtsMoves(state.pieces,color,piece.id); if(further.some(x=>x.capturedPiece)){state.chainPieceId=piece.id; return true;}} state.chainPieceId=null; state.turn=color==='gold'?'opponent':'player'; return false; };
    let chain=apply(move,'gold'); let loops=0; while(state.turn==='opponent'&&loops++<40){ const ai=getBestDraughtsAIMove(state.pieces,'crimson',state.chainPieceId); if(!ai){winner='p2';break;} chain=apply(ai,'crimson'); if(chain) continue; if(!draughtsMoves(state.pieces,'gold',null).length) winner='p1'; break; }
    if(!winner&&!state.pieces.some((p:DraughtsPiece)=>p.color==='crimson')) winner='p2'; if(!winner&&!state.pieces.some((p:DraughtsPiece)=>p.color==='gold')) winner='p1';
  } else if ((mode==='ludo_classic'||mode==='ludo_blitz') && (action.type==='ludo_roll'||action.type==='ludo_move'||action.type==='ludo_blitz_move'||action.type==='ludo_blitz_pass')) {
    if(state.turn!=='player') throw new Error('It is not your turn.');
    const doTurn=(who:'player'|'opponent',value:number,tokenId?:string)=>{ const tokens=(who==='player'?state.playerTokens:state.opponentTokens) as LudoToken[]; const choices=tokens.filter(t=>canLudoMove(t,value)); if(tokenId){if(!choices.some(t=>t.id===tokenId)) throw new Error('That token cannot move with this roll.'); const win=moveLudo(state,who,tokenId,value); return {win,extra:value===6};} const pick=chooseLudoToken(state,who,value); if(pick){return {win:moveLudo(state,who,pick.id,value),extra:value===6};} return {win:false,extra:false}; };
    if(mode==='ludo_classic'&&action.type==='ludo_roll'){ if(state.diceValue!==null) throw new Error('Move your token before rolling again.'); const val=1+Math.floor(Math.random()*6); state.diceValue=val; if(!(state.playerTokens as LudoToken[]).some(t=>canLudoMove(t,val))){state.diceValue=null;state.turn='opponent';let loops=0;while(state.turn==='opponent'&&!winner&&loops++<20){const aiVal=1+Math.floor(Math.random()*6);const ai=doTurn('opponent',aiVal);if(ai.win){winner='p1';break;}state.turn=ai.extra?'opponent':'player';}} }
    else if(mode==='ludo_classic'&&action.type==='ludo_move'){ if(!state.diceValue) throw new Error('Roll before moving.'); const val=state.diceValue; const player=doTurn('player',val,action.tokenId); state.diceValue=null;if(player.win)winner='p2';else if(!player.extra){state.turn='opponent';let loops=0;while(state.turn==='opponent'&&!winner&&loops++<20){const aiVal=1+Math.floor(Math.random()*6);const ai=doTurn('opponent',aiVal);if(ai.win){winner='p1';break;}state.turn=ai.extra?'opponent':'player';}} }
    else if(mode==='ludo_blitz'&&(action.type==='ludo_blitz_move'||action.type==='ludo_blitz_pass')){
      const hand=state.blitzCards as {id:string;value:number}[];
      if(action.type==='ludo_blitz_pass'){
        if(hand.some(c=>(state.playerTokens as LudoToken[]).some(t=>canLudoMove(t,c.value))))throw new Error('You still have a legal card move.');
        state.blitzCards=hand.slice(1).concat({id:`bc_${crypto.randomUUID()}`,value:1+Math.floor(Math.random()*6)});
      } else {
        const card=hand.find(c=>c.id===action.cardId);if(!card)throw new Error('That move card is not in your hand.');
        const player=doTurn('player',card.value,action.tokenId);
        state.blitzCards=hand.filter(c=>c.id!==card.id).concat({id:`bc_${crypto.randomUUID()}`,value:1+Math.floor(Math.random()*6)});
        if(player.win)winner='p2';
      }
      if(!winner){
        state.turn='opponent';
        const aiHand=state.opponentBlitzCards as {id:string;value:number}[];
        const choice=chooseLudoCard(state,aiHand);
        if(choice){const ai=doTurn('opponent',choice.card.value,choice.token.id);state.opponentBlitzCards=aiHand.filter(c=>c.id!==choice.card.id).concat({id:`obc_${crypto.randomUUID()}`,value:1+Math.floor(Math.random()*6)});if(ai.win)winner='p1';}
        else state.opponentBlitzCards=aiHand.slice(1).concat({id:`obc_${crypto.randomUUID()}`,value:1+Math.floor(Math.random()*6)});
        state.turn='player';
      }
    }
  } else throw new Error('Action does not match this game mode.');
  state.sequence=Number(current.sequence||0)+1; state.lastMoveId=null; state.turnDeadlineAt=deadline(mode);
  return {state,winner};
}
