import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  X,
  Check,
  AlertCircle,
  ArrowUpRight,
  Building2,
  ShieldCheck,
  CreditCard,
  User,
  Zap,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

interface WithdrawModalProps {
  onClose: () => void;
}

const PRESET_AMOUNTS_NGN = [2000, 5000, 10000, 25000, 50000];

const NIGERIAN_BANKS = [
  'OPAY Digital Services',
  'Palmpay',
  'Moniepoint MFB',
  'Kuda Microfinance Bank',
  'GTBank (Guaranty Trust Bank)',
  'Access Bank',
  'Zenith Bank',
  'United Bank for Africa (UBA)',
  'First Bank of Nigeria',
  'Fidelity Bank',
  'Stanbic IBTC Bank',
  'Sterling Bank',
  'Union Bank',
  'FCMB',
  'Wema Bank (ALAT)',
  'Other Bank (Specify)',
];

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ onClose }) => {
  const { user, withdraw } = useGame();

  const [amountNgn, setAmountNgn] = useState<number>(5000);
  const [bankName, setBankName] = useState<string>('OPAY Digital Services');
  const [customBankName, setCustomBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>(
    user.actualName || user.displayName || user.username || ''
  );

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const maxNgnAvailable = user.availableBalance;
  const effectiveBankName = bankName === 'Other Bank (Specify)' ? customBankName.trim() : bankName;

  const handleSubmitWithdrawal = () => {
    setErrorMsg(null);

    if (amountNgn < 1000) {
      setErrorMsg('Minimum withdrawal amount is ₦1,000');
      return;
    }

    if (amountNgn > user.availableBalance) {
      setErrorMsg(
        `Insufficient balance. Requested: ₦${amountNgn.toLocaleString()}, Available: ₦${user.availableBalance.toLocaleString()}`
      );
      return;
    }

    if (!effectiveBankName) {
      setErrorMsg('Please select or enter your Bank Name');
      return;
    }

    const cleanAccNum = accountNumber.replace(/\D/g, '');
    if (cleanAccNum.length !== 10) {
      setErrorMsg('Please enter a valid 10-digit Nigerian NUBAN account number');
      return;
    }

    if (!accountName.trim() || accountName.trim().length < 3) {
      setErrorMsg('Please enter your full Bank Account Holder Name');
      return;
    }

    setIsProcessing(true);
    sound.playClick();
    telegram.triggerHaptic('medium');

    setTimeout(() => {
      const ok = withdraw(amountNgn, effectiveBankName, cleanAccNum, {
        bankName: effectiveBankName,
        accountName: accountName.trim(),
      });

      setIsProcessing(false);

      if (ok) {
        setIsSuccess(true);
        telegram.triggerHaptic('success');
        sound.playWin();
      } else {
        setErrorMsg('Withdrawal request could not be completed. Please check your balance.');
      }
    }, 1000);
  };

  return (
    <div
      id="withdraw-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        id="withdraw-modal-container"
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Bank Payout Vault</h2>
              <p className="text-[11px] text-slate-400">Direct Nigerian Bank Transfer Disbursal</p>
            </div>
          </div>
          <button
            id="close-withdraw-modal"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-white">Withdrawal Request Dispatched!</h3>
            <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
              Your request for <strong className="text-emerald-400 font-bold">₦{amountNgn.toLocaleString()}</strong> to{' '}
              <span className="font-bold text-white">{effectiveBankName}</span> ({accountNumber.replace(/\D/g, '')} -{' '}
              {accountName.trim()}) has been queued and sent to Admin on Telegram for instant disbursal.
            </p>

            <div className="mt-2 text-[11px] bg-slate-950/70 p-3 rounded-xl border border-white/10 text-slate-400 w-full text-left space-y-1">
              <div className="flex justify-between">
                <span>Bank:</span>
                <span className="font-semibold text-white">{effectiveBankName}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Number:</span>
                <span className="font-mono font-semibold text-white">{accountNumber.replace(/\D/g, '')}</span>
              </div>
              <div className="flex justify-between">
                <span>Account Name:</span>
                <span className="font-semibold text-white">{accountName.trim()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-white/5">
                <span>Status:</span>
                <span className="text-emerald-400 font-bold">Processing Disbursal</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg cursor-pointer transition-all"
            >
              Done & Return to Arena
            </button>
          </div>
        ) : (
          <>
            {/* Balance Pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/10 text-xs">
              <span className="text-slate-400">Available to Withdraw:</span>
              <span className="font-extrabold text-amber-400 text-sm">
                ₦{user.availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Amount Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">Withdrawal Amount (₦)</label>
                <button
                  type="button"
                  onClick={() => {
                    setAmountNgn(maxNgnAvailable);
                    sound.playClick();
                  }}
                  className="text-[10px] text-amber-400 hover:underline font-bold uppercase tracking-wider cursor-pointer"
                >
                  Max (₦{maxNgnAvailable.toLocaleString()})
                </button>
              </div>

              {/* Preset Amount Chips */}
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_AMOUNTS_NGN.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setAmountNgn(amt);
                      sound.playClick();
                    }}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      amountNgn === amt
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-800/80 hover:bg-slate-800 border-white/5 text-slate-300'
                    }`}
                  >
                    ₦{(amt / 1000).toFixed(0)}k
                  </button>
                ))}
              </div>

              {/* Amount Input */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-400">
                  ₦
                </span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={amountNgn || ''}
                  onChange={(e) => setAmountNgn(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-950/70 border border-amber-500/30 rounded-xl py-2.5 pl-8 pr-4 text-sm font-semibold text-white focus:outline-none focus:border-amber-400 font-mono"
                  placeholder="Enter amount in Naira"
                />
              </div>
            </div>

            {/* Bank Details Inputs */}
            <div className="space-y-3 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>Beneficiary Bank Details</span>
              </div>

              {/* Bank Name Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Select Nigerian Bank
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b} className="bg-slate-900 text-white">
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Bank Name if "Other Bank" selected */}
              {bankName === 'Other Bank (Specify)' && (
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Enter Bank Name
                  </label>
                  <input
                    type="text"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    placeholder="e.g. Providus Bank, Taj Bank"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Account Number */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  10-Digit NUBAN Account Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 0123456789"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 px-3 text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Account Holder Name */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Account Holder Full Name
                  </label>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Must match bank record</span>
                  </span>
                </div>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Enter full name as on bank account"
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Policy Pill */}
            <div className="text-[11px] text-slate-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Withdrawals are disbursed directly to your bank account via instant NIP transfer.
              </span>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Confirm Button */}
            <button
              type="button"
              id="btn-confirm-bank-withdraw"
              disabled={isProcessing || amountNgn < 1000 || amountNgn > maxNgnAvailable}
              onClick={handleSubmitWithdrawal}
              className={`w-full py-3 rounded-xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${
                isProcessing || amountNgn < 1000 || amountNgn > maxNgnAvailable
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25 cursor-pointer'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting Payout Request...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Withdraw ₦{amountNgn.toLocaleString()} to Bank</span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
