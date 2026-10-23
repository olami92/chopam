import { GameMode, WhotCard, WhotShape, LudoToken, DraughtsPiece } from '../types';

export interface LudoReplaySnapshot {
  dice: number;
  playerTokens: LudoToken[];
  opponentTokens: LudoToken[];
  movedTokenId?: string;
  capturedTokenId?: string;
  isHomeOut?: boolean;
  blitzCardPlayed?: string;
}

export interface WhotReplaySnapshot {
  topCard: WhotCard;
  currentShape: WhotShape;
  currentNumber: number | null;
  player1Hand: WhotCard[];
  player2HandCount: number;
  playedCard?: WhotCard;
  marketDrawn?: boolean;
  penaltyApplied?: string;
}

export interface DraughtsReplaySnapshot {
  pieces: DraughtsPiece[];
  lastMove?: {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    captured?: boolean;
  };
  capturedGold: number;
  capturedCrimson: number;
}

export interface ReplayStep {
  stepIndex: number;
  turn: 'player' | 'opponent';
  actorName: string;
  actorAvatar: string;
  actionTitle: string;
  actionDescription: string;
  timestampOffset: string;
  isKeyMoment?: boolean;
  ludoState?: LudoReplaySnapshot;
  whotState?: WhotReplaySnapshot;
  draughtsState?: DraughtsReplaySnapshot;
}

export interface MatchReplayData {
  id: string; // e.g. 'M-7712'
  gameMode: GameMode;
  roomCode: string;
  stake: number;
  pot: number;
  fee: number;
  winner: 'player' | 'opponent';
  player1: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  player2: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  totalTurns: number;
  duration: string;
  timestamp: string;
  txHash: string;
  finalReason: string;
  steps: ReplayStep[];
}
