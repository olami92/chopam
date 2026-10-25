export interface BackendUserBalance {
  userId: string;
  username: string;
  availableBalance: number;
  escrowLockedBalance: number;
  currency: 'NGN' | 'USDT';
}

export interface BackendMatchSession {
  matchId: string;
  roomCode: string;
  gameType: 'LUDO' | 'WHOT' | 'DRAUGHTS' | 'BEAD16';
  player1Id: string;
  player1Username: string;
  player2Id: string;
  player2Username: string;
  stakePerPlayer: number;
  grossPot: number;
  houseFeePercent: number;
  houseFeeAmount: number;
  winnerPayout: number;
  status: 'INITIALIZING' | 'STAKED_IN_ESCROW' | 'ACTIVE' | 'SETTLING' | 'SETTLED' | 'REFUNDED';
  winnerId?: string;
  loserId?: string;
  settlementTxHash?: string;
  createdAt: number;
  settledAt?: number;
  finishReason?: string;
}

export interface SettlementResponse {
  success: boolean;
  result: {
    session: BackendMatchSession;
    winner: BackendUserBalance;
    loser: BackendUserBalance;
    settlementTxHash: string;
    verifiedNetPayout: number;
    verifiedHouseFee: number;
    coinRewards?: Array<{ userId: string; amount: number; reason: string; balance?: number }>;
  };
}

export class EscrowApiService {
  public static async fetchPlatformCoinProfile(userId: string, username: string): Promise<{ balance: number; referralCode: string; referrals: number; rewards: { gameWin: number; referralFirstGame: number } } | null> {
    try {
      const response = await fetch(`/api/coins/${encodeURIComponent(userId)}?username=${encodeURIComponent(username)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('Platform coin profile unavailable:', error);
      return null;
    }
  }

  /**
   * Fetch authoritative user balance from the Node.js backend database
   */
  public static async fetchUserBalance(userId: string, username?: string): Promise<BackendUserBalance | null> {
    try {
      const url = `/api/escrow/user/${encodeURIComponent(userId)}/balance${username ? `?username=${encodeURIComponent(username)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch balance: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.warn('Backend fetchUserBalance error:', err);
      return null;
    }
  }

  /**
   * Sync/register user with backend database
   */
  public static async syncUser(
    userId: string,
    username: string,
    initialBalance = 0,
    displayName?: string,
    email?: string,
    totalMatchesPlayed?: number,
    matchesWon?: number,
    matchesLost?: number
  ): Promise<BackendUserBalance | null> {
    try {
      const res = await fetch('/api/escrow/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, username, initialBalance, displayName, email, totalMatchesPlayed, matchesWon, matchesLost }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to sync user with backend ledger');
      }
      const data = await res.json();
      return data.balance;
    } catch (err) {
      console.warn('Backend syncUser error:', err);
      return null;
    }
  }

  /**
   * Start match: Backend verifies user active database balance >= stake, then locks in escrow
   */
  public static async startMatch(params: {
    matchId: string;
    roomCode: string;
    gameType: 'LUDO' | 'WHOT' | 'DRAUGHTS' | 'BEAD16';
    player1Id: string;
    player1Username: string;
    player2Id: string;
    player2Username: string;
    stakeAmount: number;
  }): Promise<{ session: BackendMatchSession; player1Balance: BackendUserBalance }> {
    const res = await fetch('/api/escrow/start-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start match on backend');
    }

    return data;
  }

  public static async reserveMatch(params: {
    matchId: string;
    roomCode: string;
    gameType: 'LUDO' | 'WHOT' | 'DRAUGHTS' | 'BEAD16';
    playerId: string;
    playerUsername: string;
    stakeAmount: number;
  }): Promise<{ session: BackendMatchSession; playerBalance: BackendUserBalance }> {
    const res = await fetch('/api/escrow/reserve-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to reserve match stake');
    return data;
  }

  /**
   * Verify and settle game: Backend calculates 95% net pot and credits winner's database balance
   */
  public static async verifyAndSettle(params: {
    matchId: string;
    winnerId: string;
    reason: string;
    evidence?: Record<string, any>;
  }): Promise<SettlementResponse['result'] & { coinRewards?: Array<{ userId: string; amount: number; reason: string; balance?: number }> }> {
    const res = await fetch('/api/game/verify-and-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: params.matchId,
        winnerId: params.winnerId,
        reason: params.reason,
        evidence: params.evidence,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Game outcome verification and settlement failed on backend');
    }

    return data.result;
  }

  /**
   * Deposit: Backend validates input, credits database balance, and logs audit
   */
  public static async deposit(
    userId: string,
    username: string,
    amount: number,
    method: string,
    metadata?: Record<string, any>
  ): Promise<{ user: BackendUserBalance; auditLogId: string }> {
    const res = await fetch('/api/escrow/deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, amount, method, metadata }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Deposit failed on backend');
    }

    return data;
  }

  /**
   * Withdraw: Backend strictly validates active balance, executes deduction, and logs audit
   */
  public static async withdraw(
    userId: string,
    username: string,
    amount: number,
    destination: string,
    accountNumber: string,
    bankDetails?: { bankName?: string; accountName?: string }
  ): Promise<{ user: BackendUserBalance; txHash: string; auditLogId: string }> {
    const res = await fetch('/api/escrow/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        username,
        amount,
        destination,
        accountNumber,
        bankName: bankDetails?.bankName,
        accountName: bankDetails?.accountName,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Withdrawal failed on backend');
    }

    return data;
  }

  /**
   * Refund match: Backend unlocks escrow and restores database balance
   */
  public static async refundMatch(matchId: string, reason?: string): Promise<BackendMatchSession> {
    const res = await fetch('/api/escrow/refund-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, reason }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Refund failed on backend');
    }

    return data.session;
  }

  /**
   * Simulation Settlement: Calculates test results strictly on backend
   */
  public static async simulateSettlement(params: {
    userId: string;
    username: string;
    gameMode: string;
    stakeAmount: number;
    outcome: 'WON' | 'LOST';
  }): Promise<{ user: BackendUserBalance; txHash: string; pot: number; fee: number; profitDelta: number }> {
    const res = await fetch('/api/escrow/simulate-settle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Backend simulation calculation failed');
    }

    return data;
  }

  /**
   * Register created room on backend server for cross-device room joining
   */
  public static async registerRoom(tableData: Record<string, any>): Promise<any> {
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tableData),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('registerRoom warning:', err);
    }
    return null;
  }

  /**
   * Fetch room details from backend by room code
   */
  public static async fetchRoomByCode(roomCode: string): Promise<any> {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        return data.room || null;
      }
    } catch (err) {
      console.warn('fetchRoomByCode warning:', err);
    }
    return null;
  }

  /**
   * Register player 2 joining room on backend server
   */
  public static async joinRoom(roomCode: string, player2Data: Record<string, any>, turnMode?: string): Promise<any> {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode.trim().toUpperCase())}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player2: player2Data, turnMode }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.room || null;
      }
    } catch (err) {
      console.warn('joinRoom warning:', err);
    }
    return null;
  }

  /**
   * Public Cryptographic Escrow & Pool Reference Verification (USDT & FIAT)
   */
  public static async verifyReference(reference: string): Promise<any> {
    try {
      const res = await fetch(`/api/escrow/verify/${encodeURIComponent(reference.trim())}`);
      if (res.ok) {
        const data = await res.json();
        return data.data || data;
      }
    } catch (err) {
      console.warn('verifyReference error:', err);
    }
    return null;
  }

  /**
   * Fetch live deposit and withdrawal transaction history for a user from backend
   */
  public static async fetchUserTransactions(userId: string): Promise<any[]> {
    try {
      const res = await fetch(`/api/escrow/transactions/${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        return data.transactions || [];
      }
    } catch (err) {
      console.warn('fetchUserTransactions warning:', err);
    }
    return [];
  }
}


