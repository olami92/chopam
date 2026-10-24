import { BeadPiece, BeadPlayer } from '../utils/bead16Engine';
import { ActiveMatch, GameMode } from '../types';
import { getDynamicAvatarUrl } from '../utils/avatar';

export interface AuthoritativeBead16State {
  board: BeadPiece[];
  turn: BeadPlayer;
  mustContinueJumpNode: number | null;
  lastMoveTrail: { from: number; to: number } | null;
  sequence: number;
  lastMoveId: string | null;
  turnDeadlineAt: number;
}

export interface CoinMatchResponse {
  matchId: string;
  state: any;
  status: 'ACTIVE' | 'SETTLED';
  winner?: BeadPlayer | null;
  balance: number;
  stake: number;
}

const sessionToken = () => localStorage.getItem('skillstake_session_v1') || '';
const pendingStartKey = 'skillstake_tete_coin_pending_start_v1';
const sequenceKey = (matchId: string) => `skillstake_tete_coin_sequence_${matchId}`;
const pendingActionKey = 'skillstake_tete_coin_pending_action_v1';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken()}`,
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || 'Tete Coin match request failed.'), { remainingSeconds: data.remainingSeconds, status: response.status });
  return data as T;
}

export const TeteCoinMatchService = {
  start: async (stake: number, gameMode: GameMode = 'bead16') => {
    let pending: { requestId: string; stake: number; gameMode: GameMode } | null = null;
    try { pending = JSON.parse(localStorage.getItem(pendingStartKey) || 'null'); } catch { pending = null; }
    const requestId = pending?.stake === stake && pending?.gameMode === gameMode ? pending.requestId : crypto.randomUUID();
    localStorage.setItem(pendingStartKey, JSON.stringify({ requestId, stake, gameMode }));
    const match = await request<CoinMatchResponse>('/api/coins/ai-matches', {
      method: 'POST', body: JSON.stringify({ stake, gameMode, requestId }),
    });
    localStorage.removeItem(pendingStartKey);
    localStorage.setItem(sequenceKey(match.matchId), String(Number(match.state?.sequence || 0)));
    return match;
  },
  load: async (matchId: string) => {
    const match = await request<CoinMatchResponse>(`/api/coins/ai-matches/${encodeURIComponent(matchId)}`);
    localStorage.setItem(sequenceKey(matchId), String(Number(match.state?.sequence || 0)));
    try { const pending = JSON.parse(localStorage.getItem(pendingActionKey) || 'null'); if (pending?.matchId === matchId && pending?.moveId === match.state?.lastMoveId) localStorage.removeItem(pendingActionKey); } catch { localStorage.removeItem(pendingActionKey); }
    return match;
  },
  move: (matchId: string, from: number, to: number, expectedSequence: number) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/moves`,
    { method: 'POST', body: JSON.stringify({ from, to, expectedSequence, moveId: crypto.randomUUID() }) }
  ),
  act: async (matchId: string, action: Record<string, unknown>) => {
    const expectedSequence = Number(localStorage.getItem(sequenceKey(matchId)) || 0);
    let pending: any = null;
    try { pending = JSON.parse(localStorage.getItem(pendingActionKey) || 'null'); } catch { pending = null; }
    const samePending = pending?.matchId === matchId && pending?.expectedSequence === expectedSequence && JSON.stringify(pending.action) === JSON.stringify(action);
    const moveId = samePending ? pending.moveId : crypto.randomUUID();
    localStorage.setItem(pendingActionKey, JSON.stringify({ matchId, expectedSequence, action, moveId }));
    let match: CoinMatchResponse;
    try {
      match = await request<CoinMatchResponse>(`/api/coins/ai-matches/${encodeURIComponent(matchId)}/moves`, {
        method: 'POST', body: JSON.stringify({ action, expectedSequence, moveId }),
      });
    } catch (error: any) {
      if (error?.status !== 409) localStorage.removeItem(pendingActionKey);
      throw error;
    }
    localStorage.removeItem(pendingActionKey);
    localStorage.setItem(sequenceKey(matchId), String(Number(match.state?.sequence || expectedSequence)));
    return match;
  },
  forfeit: (matchId: string) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/forfeit`,
    { method: 'POST', body: '{}' }
  ),
  timeout: (matchId: string) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/timeout`,
    { method: 'POST', body: '{}' }
  ),
};

export function publishCoinGameState(gameMode: GameMode, match: CoinMatchResponse) {
  const state = match.state || {};
  const settled = match.status === 'SETTLED';
  const winnerRole = match.winner === 'p2' ? 'host' : match.winner === 'p1' ? 'challenger' : undefined;
  let detail: Record<string, unknown>;
  if (gameMode === 'whot') detail = { ...state, turn: state.turn, isGameOver: settled, winnerRole, lastAction: 'Tete Coin match state restored' };
  else if (gameMode === 'draughts') detail = { ...state, goldCapturedCount: Math.max(0, 20 - state.pieces?.filter((p: any) => p.color === 'crimson').length), crimsonCapturedCount: Math.max(0, 20 - state.pieces?.filter((p: any) => p.color === 'gold').length), isGameOver: settled, winnerRole, lastAction: 'Tete Coin match state restored' };
  else if (gameMode === 'ludo_classic' || gameMode === 'ludo_blitz') detail = { ...state, isGameOver: settled, winnerRole, lastAction: 'Tete Coin match state restored' };
  else return;
  window.dispatchEvent(new CustomEvent('p2p_game_state_update', { detail }));
}

export async function startTeteCoinBead16Match(stake: number, coinBalance: number, username: string, authenticated: boolean, matchAlreadyActive: boolean, gameMode: GameMode = 'bead16') {
  if (!authenticated) throw new Error('Sign in with a verified account to play for Tete Coins.');
  if (matchAlreadyActive) throw new Error('Finish or forfeit your current Tete Coin match first.');
  if (!Number.isSafeInteger(stake) || stake < 1 || coinBalance < stake) throw new Error('Choose a stake within your available Tete Coin balance.');
  const match = await TeteCoinMatchService.start(stake, gameMode);
  const activeMatch: ActiveMatch = {
    id: match.matchId,
    coinMatchId: match.matchId,
    roomCode: match.matchId,
    gameMode,
    turnMode: gameMode === 'ludo_blitz' ? 'fast_blitz' : 'casual',
    turnDeadlineAt: Number((match.state as any).turnDeadlineAt || Date.now() + (gameMode === 'ludo_blitz' ? 45 : 3600) * 1000),
    stake: match.stake,
    pot: match.stake * 2,
    fee: 0,
    status: 'locked_escrow',
    hostUsername: username,
    opponent: { id: 'bot_odogwuking', username: 'odogwuking', displayName: 'Odogwuking', avatarUrl: getDynamicAvatarUrl('odogwuking'), winRate: 67.2 },
    isPrivate: false,
    // Reuse the existing network-game renderer while suppressing client-side AI;
    // all AI actions for coin matches are generated and committed by the server.
    isVsAi: false,
    isP2P: false,
  };
  return { match, activeMatch };
}
