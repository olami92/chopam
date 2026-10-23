import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { EscrowTransaction } from '../types';
import {
  Wallet,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Receipt,
  Check,
  Play,
  History,
  FileCheck,
  Coins,
  Copy,
} from 'lucide-react';
import { DepositModal } from '../components/DepositModal';
import { WithdrawModal } from '../components/WithdrawModal';
import { EscrowVerificationModal } from '../components/EscrowVerificationModal';
import { sound } from '../services/audio';
import { EscrowApiService } from '../services/escrowService';
import { telegram } from '../services/telegram';

export const WalletScreen: React.FC = () => {
  const { user, escrowHistory, walletTransactions, openReplay } = useGame();
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [txFilter, setTxFilter] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [selectedAuditTx, setSelectedAuditTx] = useState<EscrowTransaction | null>(null);
  const [coinProfile, setCoinProfile] = useState<{ balance: number; referralCode: string; referrals: number; rewards: { gameWin: number; referralFirstGame: number } } | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    EscrowApiService.fetchPlatformCoinProfile(user.id, user.username).then((profile) => {
      if (alive && profile) setCoinProfile(profile);
    });
    return () => { alive = false; };
  }, [user.id, user.username, user.coinBalance]);

  const handleCopyReferral = async () => {
    if (!coinProfile?.referralCode) return;
    const link = telegram.getReferralDeepLink(coinProfile.referralCode);
    try {
      await navigator.clipboard.writeText(link);
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 1800);
    } catch {
      window.prompt('Copy your referral link', link);
    }
  };

  const totalVault = user.availableBalance + user.escrowBalance;
  const usdtEquivalent = (totalVault / 1500).toFixed(2);

  const filteredTransactions = walletTransactions.filter((tx) => {
    if (txFilter === 'deposit') return tx.type === 'deposit';
    if (txFilter === 'withdrawal') return tx.type === 'withdrawal';
    return true;
  });

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 space-y-4 pb-20 overflow-y-auto">
      <section className="bg-gradient-to-r from-indigo-950/90 via-slate-900/90 to-amber-950/60 border border-indigo-400/20 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-400/15 border border-amber-300/30 text-amber-300 flex items-center justify-center"><Coins className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-200">Skill Coins · cosmetics rewards</p>
            <p className="text-2xl font-black text-white">{(coinProfile?.balance ?? user.coinBalance ?? 0).toLocaleString()} <span className="text-sm text-amber-300">coins</span></p>
            <p className="text-[11px] text-slate-400">Earn {coinProfile?.rewards.gameWin ?? 5} for each win and {coinProfile?.rewards.referralFirstGame ?? 10} when a friend you invite finishes their first game.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 mr-1">{coinProfile?.referrals ?? 0} invited</span>
          <button type="button" onClick={handleCopyReferral} disabled={!coinProfile?.referralCode} className="py-2.5 px-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 disabled:opacity-50">
            {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {referralCopied ? 'Copied' : 'Invite & earn'}
          </button>
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Wallet Vault Card & Deposit/Withdrawal Transaction History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Wallet Vault Card */}
          <div
            id="wallet-vault-card"
            className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Escrow Vault Balance
                </span>
              </div>

              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <ShieldCheck className="w-3 h-3" />
                Polygon Audited
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-baseline gap-2">
                <h2 className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">
                  ₦{totalVault.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </h2>
                <span className="text-sm font-mono font-bold text-purple-300">
                  ≈ ${usdtEquivalent} USDT
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Total assets under non-custodial smart escrow protocol
              </p>
            </div>

            {/* Breakdown row */}
            <div className="grid grid-cols-2 gap-2.5 mt-5 pt-4 border-t border-white/10">
              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                  <span className="uppercase text-[10px] font-bold tracking-wider">Available Cash</span>
                </div>
                <span className="text-base font-extrabold text-white">
                  ₦{user.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 text-amber-400 mb-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span className="uppercase text-[10px] font-bold tracking-wider">Locked in Escrow</span>
                </div>
                <span className="text-base font-extrabold text-amber-400">
                  ₦{user.escrowBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Deposit & Withdraw CTA */}
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button
                id="btn-vault-deposit"
                onClick={() => {
                  sound.playClick();
                  setShowDeposit(true);
                }}
                className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wide shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ArrowDownLeft className="w-4 h-4 text-slate-950" />
                <span>Deposit Funds</span>
              </button>

              <button
                id="btn-vault-withdraw"
                onClick={() => {
                  sound.playClick();
                  setShowWithdraw(true);
                }}
                className="py-3.5 px-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-white/10 font-bold text-xs uppercase tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <span>Withdraw Payout</span>
              </button>
            </div>
          </div>

          {/* Deposit & Withdrawal Transaction History Card */}
          <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl p-5 border border-white/10 space-y-3.5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Transaction History</h4>
                  <span className="text-[10px] text-slate-400">Deposits & Withdrawals</span>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-white/5 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setTxFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    txFilter === 'all'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setTxFilter('deposit');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    txFilter === 'deposit'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Deposits
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setTxFilter('withdrawal');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    txFilter === 'withdrawal'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Withdrawals
                </button>
              </div>
            </div>

            {/* Transaction List */}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {filteredTransactions.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-1 bg-slate-950/40 rounded-2xl border border-white/5">
                  <History className="w-6 h-6 mx-auto text-slate-500 opacity-50" />
                  <p className="text-xs font-bold text-slate-300">No Transactions Found</p>
                  <p className="text-[10px] text-slate-500">Deposit or withdraw funds to see history here.</p>
                </div>
              ) : (
                filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === 'deposit'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {tx.type === 'deposit' ? (
                          <ArrowDownLeft className="w-4.5 h-4.5 text-emerald-400" />
                        ) : (
                          <ArrowUpRight className="w-4.5 h-4.5 text-amber-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white capitalize">
                            {tx.type}
                          </span>
                          <span className="text-[10px] text-slate-400">• {tx.method}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {tx.timestamp} {tx.reference ? `• ${tx.reference}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold font-mono ${
                          tx.type === 'deposit' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {tx.type === 'deposit' ? `+₦${tx.amount.toLocaleString()}` : `-₦${tx.amount.toLocaleString()}`}
                      </div>

                      <div className="mt-0.5">
                        {tx.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Processing
                          </span>
                        ) : tx.status === 'successful' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            Successful
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Escrow Audit Log */}
        <div className="lg:col-span-7">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                Escrow Settlement Audit Log
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {escrowHistory.length} Transactions
            </span>
          </div>

          <div className="space-y-2.5">
            {escrowHistory.length === 0 ? (
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center space-y-2 text-slate-400">
                <Receipt className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                <p className="text-sm font-bold text-slate-300">No Escrow Transactions Yet</p>
                <p className="text-xs text-slate-500">Your match staking audit records and winner payouts will appear here.</p>
              </div>
            ) : (
              escrowHistory.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-sm space-y-2.5 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                          tx.result === 'WON'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : tx.result === 'LOST'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {tx.result === 'WON' ? 'W' : tx.result === 'LOST' ? 'L' : 'R'}
                      </div>

                      <div>
                        <span className="text-xs font-bold text-white block leading-tight">
                          vs @{tx.opponentUsername}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase">
                          {tx.gameMode.replace('_', ' ')} • Match {tx.matchId}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono block ${
                          tx.result === 'WON'
                            ? 'text-emerald-400'
                            : tx.result === 'LOST'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {tx.result === 'WON'
                          ? `+₦${(tx.pot - tx.stake).toLocaleString()}`
                          : `-₦${tx.stake.toLocaleString()}`}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {tx.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Proof Certificate & Escrow status pill */}
                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        sound.playClick();
                        setSelectedAuditTx(tx);
                      }}
                      className="text-slate-400 hover:text-amber-400 font-mono flex items-center gap-1.5 transition-colors cursor-pointer group bg-slate-950/60 px-2.5 py-1 rounded-lg border border-white/5 hover:border-amber-500/30"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Proof: PROOF-{tx.matchId}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openReplay(tx.matchId)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-amber-400" />
                        <span>Replay</span>
                      </button>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          tx.status === 'RELEASED'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : tx.status === 'FEE_DEDUCTED'
                            ? 'bg-slate-800 text-slate-300 border-white/10'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
      {selectedAuditTx && (
        <EscrowVerificationModal
          tx={selectedAuditTx}
          onClose={() => setSelectedAuditTx(null)}
          onReplay={(matchId) => openReplay(matchId)}
        />
      )}
    </div>
  );
};

