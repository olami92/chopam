export type BeadPlayer = 'p1' | 'p2'; // p1: Red (top), p2: Blue (bottom)
export type BeadPiece = BeadPlayer | null;

export interface BoardNode {
  id: number;
  x: number;
  y: number;
  label?: string;
}

export interface Move {
  from: number;
  to: number;
  captured?: number; // node index of captured piece if jump move
}

// 37 Node Definitions for Bead 16 / Sholo Guti Board Layout
export const BEAD16_NODES: BoardNode[] = [
  // Top Triangle Extension (Nodes 0 - 5)
  { id: 0, x: 200, y: 30 },
  { id: 1, x: 160, y: 65 },
  { id: 2, x: 200, y: 65 },
  { id: 3, x: 240, y: 65 },
  { id: 4, x: 120, y: 100 },
  { id: 5, x: 200, y: 100 },
  { id: 6, x: 280, y: 100 },

  // Main 5x5 Grid Row 0 (Nodes 7 - 11, y = 145)
  { id: 7, x: 40, y: 145 },
  { id: 8, x: 120, y: 145 },
  { id: 9, x: 200, y: 145 },
  { id: 10, x: 280, y: 145 },
  { id: 11, x: 360, y: 145 },

  // Main 5x5 Grid Row 1 (Nodes 12 - 16, y = 210)
  { id: 12, x: 40, y: 210 },
  { id: 13, x: 120, y: 210 },
  { id: 14, x: 200, y: 210 },
  { id: 15, x: 280, y: 210 },
  { id: 16, x: 360, y: 210 },

  // Main 5x5 Grid Row 2 (Middle Neutral Row, Nodes 17 - 21, y = 275)
  { id: 17, x: 40, y: 275 },
  { id: 18, x: 120, y: 275 },
  { id: 19, x: 200, y: 275 }, // Center node
  { id: 20, x: 280, y: 275 },
  { id: 21, x: 360, y: 275 },

  // Main 5x5 Grid Row 3 (Nodes 22 - 26, y = 340)
  { id: 22, x: 40, y: 340 },
  { id: 23, x: 120, y: 340 },
  { id: 24, x: 200, y: 340 },
  { id: 25, x: 280, y: 340 },
  { id: 26, x: 360, y: 340 },

  // Main 5x5 Grid Row 4 (Nodes 27 - 31, y = 405)
  { id: 27, x: 40, y: 405 },
  { id: 28, x: 120, y: 405 },
  { id: 29, x: 200, y: 405 },
  { id: 30, x: 280, y: 405 },
  { id: 31, x: 360, y: 405 },

  // Bottom Triangle Extension (Nodes 32 - 36)
  { id: 32, x: 120, y: 450 },
  { id: 33, x: 200, y: 450 },
  { id: 34, x: 280, y: 450 },
  { id: 35, x: 160, y: 485 },
  { id: 36, x: 200, y: 485 },
  { id: 37, x: 240, y: 485 },
];

// Straight line connection graph (fromNode -> list of connected neighbors)
export const ADJACENCY_LIST: Record<number, number[]> = {
  // Top Triangle
  0: [1, 2, 3],
  1: [0, 2, 4],
  2: [0, 1, 3, 5],
  3: [0, 2, 6],
  4: [1, 5, 8],
  5: [2, 4, 6, 9],
  6: [3, 5, 10],

  // Row 0 of Main Grid
  7: [8, 12, 13],
  8: [4, 7, 9, 13],
  9: [5, 8, 10, 14],
  10: [6, 9, 11, 15],
  11: [10, 15, 16],

  // Row 1 of Main Grid
  12: [7, 13, 17],
  13: [7, 8, 12, 14, 18],
  14: [9, 13, 15, 19],
  15: [10, 11, 14, 16, 20],
  16: [11, 15, 21],

  // Row 2 of Main Grid (Middle Neutral)
  17: [12, 18, 22],
  18: [13, 17, 19, 23],
  19: [14, 18, 20, 24],
  20: [15, 19, 21, 25],
  21: [16, 20, 26],

  // Row 3 of Main Grid
  22: [17, 23, 27],
  23: [18, 22, 24, 28],
  24: [19, 23, 25, 29],
  25: [20, 24, 26, 30],
  26: [21, 25, 31],

  // Row 4 of Main Grid
  27: [22, 28],
  28: [23, 27, 29, 32],
  29: [24, 28, 30, 33],
  30: [25, 29, 31, 34],
  31: [26, 30],

  // Bottom Triangle
  32: [28, 33, 35],
  33: [29, 32, 34, 36],
  34: [30, 33, 37],
  35: [32, 36],
  36: [33, 35, 37],
  37: [34, 36],
};

// Straight line direction mapping (A -> B -> C in a straight line)
// Helper to find the node C directly behind B along line A->B
export function getStraightJumpTarget(a: number, b: number): number | null {
  const nA = BEAD16_NODES[a];
  const nB = BEAD16_NODES[b];
  if (!nA || !nB) return null;

  const dx = nB.x - nA.x;
  const dy = nB.y - nA.y;

  const targetX = nB.x + dx;
  const targetY = nB.y + dy;

  // Find neighbor of B that matches targetX, targetY within tolerance
  const neighbors = ADJACENCY_LIST[b] || [];
  for (const nIdx of neighbors) {
    const candidate = BEAD16_NODES[nIdx];
    if (candidate && Math.abs(candidate.x - targetX) < 15 && Math.abs(candidate.y - targetY) < 15) {
      return candidate.id;
    }
  }

  return null;
}

// Initial Board Setup: 16 Red (P1) on top (nodes 0..15), 5 Empty middle (nodes 16..20), 16 Blue (P2) on bottom (nodes 21..36)
export function createInitialBead16Board(): BeadPiece[] {
  const board: BeadPiece[] = Array(38).fill(null);
  
  // P1 (Red / Top): Nodes 0 through 15 (16 beads)
  for (let i = 0; i <= 15; i++) {
    board[i] = 'p1';
  }

  // Nodes 16 through 20 are middle neutral empty nodes (5 nodes: 16, 17, 18, 19, 20)

  // P2 (Blue / Bottom): Nodes 21 through 36 (16 beads)
  for (let i = 21; i <= 36; i++) {
    board[i] = 'p2';
  }

  return board;
}

// Get all legal moves for active player
export function getLegalBead16Moves(
  board: BeadPiece[],
  player: BeadPlayer,
  mustContinueJumpFromNode?: number | null
): Move[] {
  const opponent: BeadPlayer = player === 'p1' ? 'p2' : 'p1';
  const moves: Move[] = [];
  const captureMoves: Move[] = [];

  const sourceNodes = mustContinueJumpFromNode !== null && mustContinueJumpFromNode !== undefined
    ? [mustContinueJumpFromNode]
    : BEAD16_NODES.map(n => n.id).filter(id => board[id] === player);

  for (const fromId of sourceNodes) {
    const neighbors = ADJACENCY_LIST[fromId] || [];

    for (const neighborId of neighbors) {
      const neighborPiece = board[neighborId];

      // Jump capture move
      if (neighborPiece === opponent) {
        const jumpTarget = getStraightJumpTarget(fromId, neighborId);
        if (jumpTarget !== null && board[jumpTarget] === null) {
          captureMoves.push({
            from: fromId,
            to: jumpTarget,
            captured: neighborId,
          });
        }
      }
      // Simple step move (only if not restricted to multi-jump sequence)
      else if (neighborPiece === null && (mustContinueJumpFromNode === null || mustContinueJumpFromNode === undefined)) {
        moves.push({
          from: fromId,
          to: neighborId,
        });
      }
    }
  }

  // Compulsory capture rule: if any capture move is available, captures must be prioritized
  if (captureMoves.length > 0) {
    return captureMoves;
  }

  return mustContinueJumpFromNode !== null && mustContinueJumpFromNode !== undefined ? [] : moves;
}

// Apply move to board state
export function applyBead16Move(board: BeadPiece[], move: Move): BeadPiece[] {
  const nextBoard = [...board];
  const piece = nextBoard[move.from];

  nextBoard[move.from] = null;
  nextBoard[move.to] = piece;

  if (move.captured !== undefined && move.captured !== null) {
    nextBoard[move.captured] = null;
  }

  return nextBoard;
}

// Check for game winner
export function checkBead16Winner(board: BeadPiece[]): { winner: BeadPlayer | null; p1Count: number; p2Count: number } {
  let p1Count = 0;
  let p2Count = 0;

  for (const piece of board) {
    if (piece === 'p1') p1Count++;
    if (piece === 'p2') p2Count++;
  }

  if (p1Count === 0) return { winner: 'p2', p1Count, p2Count };
  if (p2Count === 0) return { winner: 'p1', p1Count, p2Count };

  // Check if player has no legal moves
  const p1Moves = getLegalBead16Moves(board, 'p1');
  if (p1Moves.length === 0) return { winner: 'p2', p1Count, p2Count };

  const p2Moves = getLegalBead16Moves(board, 'p2');
  if (p2Moves.length === 0) return { winner: 'p1', p1Count, p2Count };

  return { winner: null, p1Count, p2Count };
}

// AI decision maker for singleplayer VS Bot mode
export function getBestBead16AIMove(board: BeadPiece[], aiPlayer: BeadPlayer): Move | null {
  const moves = getLegalBead16Moves(board, aiPlayer);
  if (moves.length === 0) return null;

  // 1. Prioritize capture moves (especially multi-jump potentials)
  const captureMoves = moves.filter(m => m.captured !== undefined && m.captured !== null);
  if (captureMoves.length > 0) {
    let bestCapture = captureMoves[0];
    let maxChain = 0;

    for (const cap of captureMoves) {
      const simulated = applyBead16Move(board, cap);
      const followUps = getLegalBead16Moves(simulated, aiPlayer, cap.to);
      if (followUps.length > maxChain) {
        maxChain = followUps.length;
        bestCapture = cap;
      }
    }
    return bestCapture;
  }

  // 2. Evaluate step moves to control center node (19) or defend
  let bestMove = moves[0];
  let bestScore = -9999;

  for (const move of moves) {
    const simulated = applyBead16Move(board, move);
    const opponent = aiPlayer === 'p1' ? 'p2' : 'p1';
    const opponentCaptures = getLegalBead16Moves(simulated, opponent).filter(m => m.captured !== undefined);

    let score = 0;

    // Penalty if move leaves piece vulnerable to opponent capture
    score -= opponentCaptures.length * 50;

    // Bonus for center control (node 19)
    if (move.to === 19) score += 30;

    // Bonus for advancing toward opponent territory
    if (aiPlayer === 'p2') {
      score += (BEAD16_NODES[move.from].y - BEAD16_NODES[move.to].y);
    } else {
      score += (BEAD16_NODES[move.to].y - BEAD16_NODES[move.from].y);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}
