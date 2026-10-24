import { BeadPiece, BeadPlayer } from '../utils/bead16Engine';
import { ActiveMatch } from '../types';
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
  state: AuthoritativeBead16State;
  status: 'ACTIVE' | 'SETTLED';
  winner?: BeadPlayer | null;
  balance: number;
  stake: number;
}

const sessionToken = () => localStorage.getItem('skillstake_session_v1') || '';
const pendingStartKey = 'skillstake_tete_coin_pending_start_v1';

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
  start: async (stake: number) => {
    const requestId = localStorage.getItem(pendingStartKey) || crypto.randomUUID();
    localStorage.setItem(pendingStartKey, requestId);
    const match = await request<CoinMatchResponse>('/api/coins/ai-matches', {
      method: 'POST', body: JSON.stringify({ stake, requestId }),
    });
    localStorage.removeItem(pendingStartKey);
    return match;
  },
  load: (matchId: string) => request<CoinMatchResponse>(`/api/coins/ai-matches/${encodeURIComponent(matchId)}`),
  move: (matchId: string, from: number, to: number, expectedSequence: number) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/moves`,
    { method: 'POST', body: JSON.stringify({ from, to, expectedSequence, moveId: crypto.randomUUID() }) }
  ),
  forfeit: (matchId: string) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/forfeit`,
    { method: 'POST', body: '{}' }
  ),
  timeout: (matchId: string) => request<CoinMatchResponse>(
    `/api/coins/ai-matches/${encodeURIComponent(matchId)}/timeout`,
    { method: 'POST', body: '{}' }
  ),
};

export async function startTeteCoinBead16Match(stake: number, coinBalance: number, username: string, authenticated: boolean, matchAlreadyActive: boolean) {
  if (!authenticated) throw new Error('Sign in with a verified account to play for Tete Coins.');
  if (matchAlreadyActive) throw new Error('Finish or forfeit your current Tete Coin match first.');
  if (!Number.isSafeInteger(stake) || stake < 1 || coinBalance < stake) throw new Error('Choose a stake within your available Tete Coin balance.');
  const match = await TeteCoinMatchService.start(stake);
  const activeMatch: ActiveMatch = {
    id: match.matchId,
    coinMatchId: match.matchId,
    roomCode: match.matchId,
    gameMode: 'bead16',
    turnMode: 'casual',
    turnDeadlineAt: Date.now() + 60 * 60 * 1000,
    stake: match.stake,
    pot: match.stake * 2,
    fee: 0,
    status: 'locked_escrow',
    hostUsername: username,
    opponent: { id: 'bot_odogwuking', username: 'odogwuking', displayName: 'Odogwuking', avatarUrl: getDynamicAvatarUrl('odogwuking'), winRate: 67.2 },
    isPrivate: false,
    isVsAi: true,
    isP2P: false,
  };
  return { match, activeMatch };
}
