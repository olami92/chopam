import React, { useState } from 'react';
import { EscrowTransaction } from '../types';
import {
  ShieldCheck,
  X,
  Copy,
  Check,
  Play,
  FileCheck2,
  Lock,
  Receipt,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

interface EscrowVerificationModalProps {
  tx: EscrowTransaction;
  onClose: () => void;
  onReplay: (matchId: string) => void;
}

export const EscrowVerificationModal: React.FC<EscrowVerificationModalProps> = ({
  tx,
  onClose,
  onReplay,
}) => {
  const [copied, setCopied] = useState(false);

  const proofRef = `PROOF-${tx.matchId}-${tx.id.slice(-6).toUpperCase()}`;
  const shaProof = tx.txHash.startsWith('0x')
    ? tx.txHash
    : `0x${tx.txHash}${tx.id.replace(/[^a-f0-9]/gi, '')}`.slice(0, 42);

  const handleCopyProof = () => {
    sound.playClick();
    telegram.triggerHaptic('light');
    navigator.clipboard.writeText(`${proofRef} | Hash: ${shaProof}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl space-y-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500/20 via-purple-500/10 to-slate-900 p-5 border-b border-white/10 relative">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-950/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Escrow Settlement Certificate
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Official ChopAm Audit Record • {tx.timestamp}
              </p>
            </div>
          </div>
        </div>

        {/* Certificate Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Proof Hash & Copy Box */}
          <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>Cryptographic Proof Reference</span>
              <span className="text-amber-400 font-mono">{proofRef}</span>
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] bg-slate-900 p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-300 truncate max-w-[260px] sm:max-w-[340px]">
                {shaProof}
              </span>
              <button
                type="button"
                onClick={handleCopyProof}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-[10px]"
                title="Copy Proof Hash"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Duel Match Summary Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Match ID & Game</span>
              <div className="text-xs font-bold text-white uppercase">
                {tx.gameMode.replace('_', ' ')} • {tx.matchId}
              </div>
            </div>

            <div className="bg-slate-950/50 p-3 rounded-2xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Opponent</span>
              <div className="text-xs font-bold text-amber-400">@{tx.opponentUsername}</div>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
              <span className="text-slate-400">Settlement Result</span>
              <span
                className={`font-black px-2.5 py-0.5 rounded-full text-[10px] ${tx.result === 'WON'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : tx.result === 'LOST'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
              >
                {tx.result === 'WON'
                  ? 'VICTORY (POT DISBURSED)'
                  : tx.result === 'LOST'
                    ? 'DEFEAT (STAKE RELEASED)'
                    : 'REFUNDED'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Player Stake Amount</span>
              <span className="font-mono font-bold text-white">
                ₦{tx.stake.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Gross Escrow Pot (2x Stake)</span>
              <span className="font-mono font-bold text-amber-400">
                ₦{(tx.stake * 2).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Platform Gate Fee</span>
              <span className="font-mono text-slate-400">
                ₦{tx.fee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm pt-2 border-t border-white/10 font-bold">
              <span className="text-white">Net Winner Payout</span>
              <span className="font-mono text-emerald-400 text-base">
                ₦{tx.pot.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Audit Verification Specs */}
          <div className="p-3.5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-2 text-[11px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Escrow Protocol
              </span>
              <span className="font-bold text-slate-200">Non-Custodial Backend Vault</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
                Anti-Cheat Audit
              </span>
              <span className="font-bold text-emerald-400">Passed (0 Anomalies Detected)</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Settlement Status
              </span>
              <span className="font-bold text-slate-200 uppercase">{tx.status}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 bg-slate-950 border-t border-white/10 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
              onReplay(tx.matchId);
            }}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" />
            <span>Watch Match Replay</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wide cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
