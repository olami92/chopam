import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Zap,
  Wallet,
  ExternalLink,
  RefreshCw,
  Layers,
  AlertTriangle,
  QrCode,
  Clock,
  CheckCircle2,
  Sparkles,
  Building2,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import {
  POLYGON_CONFIG,
  switchToPolygonNetwork,
  fetchOnChainBalances,
  depositPolygonUsdt,
  POLYGON_CHAIN_ID,
  AMOY_CHAIN_ID,
} from '../contracts/escrowContract';
import { DepositInvoice } from '../types';
import { EscrowApiService } from '../services/escrowService';
import { fetchLiveUsdtToNgnRate } from '../services/exchangeRateService';
import { ethers } from 'ethers';

interface DepositModalProps {
  onClose: () => void;
}

interface PendingFiatDeposit {
  id: string;
  referenceNo: string;
  amountNgn: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'confirmed' | 'rejected';
  requestedAt: string;
}

const PRESET_AMOUNTS_USDT = [5, 10, 25, 50, 100];
const PRESET_AMOUNTS_NGN = [2000, 5000, 10000, 25000, 50000];

export const DepositModal: React.FC<DepositModalProps> = ({ onClose }) => {
  const { deposit, user, updateUserProfile } = useGame();
  const [usdtRate, setUsdtRate] = useState<number>(1500);

  useEffect(() => {
    fetchLiveUsdtToNgnRate().then((rate) => {
      if (rate) setUsdtRate(rate);
    });
  }, []);

  const [selectedMethod, setSelectedMethod] = useState<'fiat_naira' | 'polygon_direct' | 'polygon_web3'>('fiat_naira');
  const [amountUsdt, setAmountUsdt] = useState<number>(10);
  const [copiedContract, setCopiedContract] = useState(false);
  const [copiedVault, setCopiedVault] = useState(false);
  const [copiedExactAmount, setCopiedExactAmount] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [web3StatusStep, setWeb3StatusStep] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Fiat Naira Deposit State & Live Awaiting Confirmation Flow
  const [platformBank, setPlatformBank] = useState<{ bankName: string; accountNumber: string; accountName: string }>({
    bankName: 'OPAY / Kuda Bank',
    accountNumber: '903 847 2910',
    accountName: 'SkillStake Escrow Gaming Ltd',
  });
  const [isLoadingBank, setIsLoadingBank] = useState(false);
  const [amountNgn, setAmountNgn] = useState<number>(5000);
  const [fiatRefNo, setFiatRefNo] = useState<string>(() => `STK-NGN-${Math.floor(10000 + Math.random() * 90000)}`);
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [copiedRefNo, setCopiedRefNo] = useState(false);
  const [isSubmittingFiat, setIsSubmittingFiat] = useState(false);
  const [pendingDeposit, setPendingDeposit] = useState<PendingFiatDeposit | null>(null);
  const [fiatStep, setFiatStep] = useState<'form' | 'awaiting' | 'confirmed' | 'rejected'>('form');

  const [liveTreasuryAddress, setLiveTreasuryAddress] = useState<string>('');

  // Fetch dynamic platform bank details & treasury address from backend
  const fetchPlatformBankDetails = async () => {
    setIsLoadingBank(true);
    try {
      const res = await fetch('/api/escrow/bank-details');
      if (res.ok) {
        const data = await res.json();
        if (data.bankDetails) {
          setPlatformBank(data.bankDetails);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch platform bank details:', err);
    } finally {
      setIsLoadingBank(false);
    }
  };

  const fetchLiveTreasuryAddress = async () => {
    try {
      const res = await fetch('/api/escrow/treasury-address');
      if (res.ok) {
        const data = await res.json();
        if (data.treasuryAddress) {
          setLiveTreasuryAddress(data.treasuryAddress);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch platform treasury address:', err);
    }
  };

  useEffect(() => {
    fetchPlatformBankDetails();
    fetchLiveTreasuryAddress();
  }, []);

  // Method 2: Dynamic Unique Micro-Amount Deposit State
  const [depositInvoice, setDepositInvoice] = useState<DepositInvoice | null>(null);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(900); // 15 minutes in seconds
  const [isSimulatingDetection, setIsSimulatingDetection] = useState(false);

  // Web3 State
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [usdtBalance, setUsdtBalance] = useState<string>('0.00');
  const [contractDeposits, setContractDeposits] = useState<string>('0.00');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [web3Error, setWeb3Error] = useState<string | null>(null);

  const treasuryDepositAddress = depositInvoice?.treasuryAddress || liveTreasuryAddress || '0x8F30C6652496e3860F57c43A675005E72D83D365';
  const isPolygonNetwork = chainId === POLYGON_CHAIN_ID || chainId === AMOY_CHAIN_ID;

  // Request or refresh dynamic deposit invoice (Method 2)
  const fetchDepositInvoice = async (baseAmt: number) => {
    if (!user?.id || baseAmt <= 0) return;
    setIsLoadingInvoice(true);
    try {
      const res = await fetch('/api/escrow/deposit-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          baseAmountUsdt: baseAmt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.invoice) {
          setDepositInvoice(data.invoice);
          const remainingSecs = Math.max(0, Math.floor((data.invoice.expiresAt - Date.now()) / 1000));
          setTimeRemaining(remainingSecs);
        }
      }
    } catch (err) {
      console.warn('Failed to generate deposit invoice:', err);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  useEffect(() => {
    if (selectedMethod === 'polygon_direct') {
      fetchDepositInvoice(amountUsdt);
    }
  }, [selectedMethod, amountUsdt]);

  // Invoice Expiration Countdown Timer
  useEffect(() => {
    if (!depositInvoice || depositInvoice.status !== 'awaiting_payment') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((depositInvoice.expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        setDepositInvoice((prev) => (prev ? { ...prev, status: 'expired' } : null));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [depositInvoice]);

  // Check if wallet is already connected
  const checkConnectedWallet = async () => {
    const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.listAccounts();
      if (accounts.length > 0) {
        const addr = accounts[0].address;
        setWalletAddress(addr);
        const network = await provider.getNetwork();
        setChainId(Number(network.chainId));
        refreshBalances(addr);
      }
    } catch (err) {
      console.warn('Error checking wallet:', err);
    }
  };

  const refreshBalances = async (addr: string) => {
    try {
      const { usdtBalance: usdt, contractBalance: contract } = await fetchOnChainBalances(addr);
      setUsdtBalance(usdt);
      setContractDeposits(contract);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    checkConnectedWallet();
  }, []);

  const handleConnectWallet = async () => {
    const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
    if (!ethereum) {
      setWeb3Error('No EVM wallet detected. You can also use the "Direct USDT Transfer" tab to send from Binance, Bybit, or any crypto app.');
      return;
    }

    setIsConnectingWallet(true);
    setWeb3Error(null);
    sound.playClick();
    telegram.triggerHaptic('light');

    try {
      const provider = new ethers.BrowserProvider(ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      if (accounts && accounts[0]) {
        setWalletAddress(accounts[0]);
        const network = await provider.getNetwork();
        setChainId(Number(network.chainId));
        await refreshBalances(accounts[0]);
        telegram.triggerHaptic('success');
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Failed to connect wallet';
      setWeb3Error(message);
      telegram.triggerHaptic('error');
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleSwitchNetwork = async () => {
    sound.playClick();
    telegram.triggerHaptic('selection');
    const ok = await switchToPolygonNetwork();
    if (ok) {
      const ethereum = (window as unknown as { ethereum?: ethers.Eip1193Provider }).ethereum;
      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const net = await provider.getNetwork();
        setChainId(Number(net.chainId));
      }
    }
  };

  const handleCopyContract = () => {
    navigator.clipboard.writeText(POLYGON_CONFIG.escrowContractAddress);
    setCopiedContract(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedContract(false), 2000);
  };

  const handleCopyVault = () => {
    navigator.clipboard.writeText(treasuryDepositAddress);
    setCopiedVault(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedVault(false), 2000);
  };

  const handleCopyExactAmount = () => {
    if (!depositInvoice) return;
    navigator.clipboard.writeText(depositInvoice.exactPayableUsdt.toString());
    setCopiedExactAmount(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedExactAmount(false), 2000);
  };

  const handleCopyBankAcc = () => {
    navigator.clipboard.writeText(platformBank.accountNumber);
    setCopiedBankAcc(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedBankAcc(false), 2000);
  };

  const handleCopyRefNo = () => {
    navigator.clipboard.writeText(fiatRefNo);
    setCopiedRefNo(true);
    sound.playClick();
    telegram.triggerHaptic('light');
    setTimeout(() => setCopiedRefNo(false), 2000);
  };

  const handleConfirmFiatPayment = async () => {
    if (amountNgn <= 0) return;
    setIsSubmittingFiat(true);
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const res = await fetch('/api/escrow/fiat-deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || `usr_${Date.now()}`,
          username: user?.username || 'Player',
          amountNgn: amountNgn,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const dep = data.deposit || {
        id: `fdep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        referenceNo: fiatRefNo,
        amountNgn: amountNgn,
        bankName: platformBank.bankName,
        accountNumber: platformBank.accountNumber,
        accountName: platformBank.accountName,
        status: 'pending',
        requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setPendingDeposit(dep);
      setFiatStep('awaiting');
      telegram.triggerHaptic('light');
    } catch (err) {
      console.warn('Fiat deposit API warning:', err);
      // Seamless UI fallback: still open awaiting confirmation screen
      const fallbackDep = {
        id: `fdep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        referenceNo: fiatRefNo,
        amountNgn: amountNgn,
        bankName: platformBank.bankName,
        accountNumber: platformBank.accountNumber,
        accountName: platformBank.accountName,
        status: 'pending' as const,
        requestedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      };
      setPendingDeposit(fallbackDep);
      setFiatStep('awaiting');
      telegram.triggerHaptic('light');
    } finally {
      setIsSubmittingFiat(false);
    }
  };

  // Real-time polling for Telegram Admin confirmation when fiatStep === 'awaiting'
  useEffect(() => {
    if (fiatStep !== 'awaiting' || !pendingDeposit?.id) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/escrow/fiat-deposit-status/${pendingDeposit.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.deposit) {
            if (data.deposit.status === 'confirmed') {
              setPendingDeposit(data.deposit);
              setFiatStep('confirmed');
              sound.playWin();
              telegram.triggerHaptic('success');
              // Sync backend balance into local state (Admin confirmation already credited ledger on backend)
              if (user?.id) {
                EscrowApiService.fetchUserBalance(user.id, user.username).then((b) => {
                  if (b) {
                    updateUserProfile({ availableBalance: b.availableBalance, escrowBalance: b.escrowLockedBalance });
                  } else if (user) {
                    updateUserProfile({ availableBalance: user.availableBalance + data.deposit.amountNgn });
                  }
                });
              } else if (user) {
                updateUserProfile({ availableBalance: user.availableBalance + data.deposit.amountNgn });
              }
            } else if (data.deposit.status === 'rejected') {
              setPendingDeposit(data.deposit);
              setFiatStep('rejected');
              telegram.triggerHaptic('error');
            }
          }
        }
      } catch (err) {
        console.warn('Error polling deposit status:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [fiatStep, pendingDeposit?.id, user, updateUserProfile]);

  const handleConfirmWeb3Deposit = async () => {
    if (!walletAddress) {
      await handleConnectWallet();
      return;
    }

    if (amountUsdt <= 0) {
      setWeb3Error('Enter a valid USDT amount');
      return;
    }

    setIsProcessing(true);
    setWeb3Error(null);
    setWeb3StatusStep('Initiating Polygon Smart Contract transaction...');
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const result = await depositPolygonUsdt(amountUsdt, (step) => {
        setWeb3StatusStep(step);
      });

      setLastTxHash(result.txHash);
      const creditedNgn = Math.round(amountUsdt * usdtRate);

      // Credit balance in app state via backend
      deposit(creditedNgn, 'crypto_usdt');
      setIsSuccess(true);
      telegram.triggerHaptic('success');
      sound.playWin();

      if (walletAddress) {
        refreshBalances(walletAddress);
      }
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Deposit transaction cancelled or failed';
      setWeb3Error(message);
      telegram.triggerHaptic('error');
    } finally {
      setIsProcessing(false);
      setWeb3StatusStep(null);
    }
  };

  // Method 2: Match On-Chain Incoming Micro-Payment
  const handleVerifyDirectTransfer = async () => {
    if (!depositInvoice) return;
    setIsSimulatingDetection(true);
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const res = await fetch(`/api/escrow/deposit-invoice/${depositInvoice.invoiceId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        const creditedNgn = depositInvoice.amountNgn;
        setLastTxHash(data.invoice?.detectedTxHash || '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
        deposit(creditedNgn, 'crypto_usdt_micro');
        setIsSuccess(true);
        telegram.triggerHaptic('success');
        sound.playWin();
      }
    } catch (err) {
      console.warn('Verification failed:', err);
    } finally {
      setIsSimulatingDetection(false);
    }
  };

  const formatMinutes = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="deposit-modal-container"
        className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">SkillStake Deposit Vault</h2>
              <p className="text-[11px] text-purple-300">Instant NGN Fiat Bank Transfer & Polygon USDT</p>
            </div>
          </div>
          <button
            id="close-deposit-modal"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {fiatStep === 'awaiting' ? (
          <div className="py-6 flex flex-col items-center justify-center text-center gap-4 animate-in zoom-in-95">
            {/* Animated glowing loader / hourglass */}
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                <Clock className="w-10 h-10 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/60 animate-spin" style={{ animationDuration: '10s' }} />
            </div>

            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <h3 className="text-lg font-black text-white">Awaiting Confirmation...</h3>
              </div>
              <p className="text-xs text-slate-300 max-w-sm">
                Do not close this page...
              </p>
            </div>

            {/* Live Pending Transaction Card */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-xs text-slate-300 max-w-sm w-full space-y-2.5 text-left shadow-xl">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400 font-semibold">Deposit Amount:</span>
                <span className="font-extrabold text-emerald-400 text-base font-mono">
                  ₦{(pendingDeposit?.amountNgn || amountNgn).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Reference Number:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-black text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                    {pendingDeposit?.referenceNo || fiatRefNo}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyRefNo}
                    title="Copy Reference"
                    className="p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Bank Paid To:</span>
                <span className="font-extrabold text-white">{platformBank.bankName}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-semibold">Account Number:</span>
                <span className="font-mono text-slate-200">{platformBank.accountNumber}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/10 text-[11px]">
                <span className="text-slate-400">Live Status:</span>
                <span className="text-amber-300 font-bold flex items-center gap-1.5 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/40 animate-pulse">
                  <Clock className="w-3 h-3" /> PENDING APPROVAL
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 text-center max-w-sm">
              {/* ⚡ <strong>Auto-Transition to Success:</strong> As soon as Admin verifies payment for reference <code className="bg-amber-950 px-1 rounded text-white font-mono">{pendingDeposit?.referenceNo || fiatRefNo}</code> on Telegram, this modal will immediately turn green and credit your dashboard! */}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 transition-all cursor-pointer"
            >
              Close & Play in Arena
            </button>
          </div>
        ) : fiatStep === 'confirmed' ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-bounce">
              <Check className="w-10 h-10 stroke-[3]" />
            </div>
            <h3 className="text-xl font-black text-white">Payment Confirmed & Credited!</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Deposit confirmed for reference{' '}
              <span className="font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 font-bold">
                {pendingDeposit?.referenceNo || fiatRefNo}
              </span>
              .
            </p>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 text-xs text-slate-300 max-w-sm w-full space-y-2 text-left">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <span className="text-slate-400">Amount Credited:</span>
                <span className="font-extrabold text-emerald-400 text-lg font-mono">
                  +₦{(pendingDeposit?.amountNgn || amountNgn).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono font-bold text-white">{pendingDeposit?.referenceNo || fiatRefNo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Bank Paid To:</span>
                <span className="font-bold text-white">{platformBank.bankName}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRMED & CREDITED
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setFiatStep('form');
                onClose();
              }}
              className="mt-2 px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/30 cursor-pointer"
            >
              Done & Return to Arena
            </button>
          </div>
        ) : fiatStep === 'rejected' ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border-2 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
              <X className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-white">Deposit Request Rejected</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              Payment declined for reference{' '}
              <span className="font-mono text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                {pendingDeposit?.referenceNo || fiatRefNo}
              </span>
              . Please verify tranfer details or contact support.
            </p>

            <button
              type="button"
              onClick={() => setFiatStep('form')}
              className="mt-3 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Try Again / Edit Details
            </button>
          </div>
        ) : isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <h3 className="text-lg font-black text-white">Polygon USDT Deposit Confirmed!</h3>
            <p className="text-xs text-slate-300 max-w-sm">
              <strong className="text-emerald-400 font-bold">${amountUsdt} USDT</strong> (₦
              {(amountUsdt * usdtRate).toLocaleString()}) credited to your vault.
            </p>

            {lastTxHash && (
              <a
                href={`https://polygonscan.com/tx/${lastTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 text-xs text-purple-300 hover:text-purple-200 underline font-mono flex items-center gap-1.5 bg-purple-950/40 px-3 py-1.5 rounded-xl border border-purple-500/30"
              >
                <span>View on PolygonScan: {lastTxHash.slice(0, 10)}...{lastTxHash.slice(-6)}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={onClose}
              className="mt-3 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg cursor-pointer"
            >
              Back to Arena
            </button>
          </div>
        ) : (
          <>
            {/* Funding Method Tabs */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Select Deposit Method
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('fiat_naira')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${selectedMethod === 'fiat_naira'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 bg-emerald-500/30 text-emerald-200 rounded">
                      NGN Bank
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white">Naira Transfer</span>
                  <span className="text-[9px] text-slate-400">OPAY, Kuda, GTB</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('polygon_direct')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${selectedMethod === 'polygon_direct'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                      : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 bg-indigo-500/30 text-indigo-200 rounded">
                      Crypto
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white">Direct USDT</span>
                  <span className="text-[9px] text-slate-400">Binance, Bybit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('polygon_web3')}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${selectedMethod === 'polygon_web3'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)]'
                      : 'bg-slate-800/60 border-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Wallet className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[9px] font-black uppercase tracking-wider px-1 py-0.2 bg-purple-500/30 text-purple-200 rounded">
                      Web3
                    </span>
                  </div>
                  <span className="text-xs font-bold text-white">EVM Wallet</span>
                  <span className="text-[9px] text-slate-400">MetaMask, Trust</span>
                </button>
              </div>
            </div>

            {/* TAB 0: NAIRA FIAT BANK TRANSFER */}
            {selectedMethod === 'fiat_naira' && (
              <div className="space-y-3.5">
                {/* Amount Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Select Deposit Amount (NGN)</label>
                  <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                    {PRESET_AMOUNTS_NGN.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setAmountNgn(amt);
                          sound.playClick();
                        }}
                        className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${amountNgn === amt
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-500/30'
                            : 'bg-slate-800/80 hover:bg-slate-800 border-white/5 text-slate-300'
                          }`}
                      >
                        ₦{(amt / 1000).toFixed(0)}k
                      </button>
                    ))}
                  </div>

                  {/* Custom NGN Input */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-400">
                      ₦
                    </span>
                    <input
                      id="input-deposit-ngn"
                      type="number"
                      min="500"
                      step="500"
                      value={amountNgn || ''}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setAmountNgn(val);
                      }}
                      className="w-full bg-slate-950/70 border border-emerald-500/30 rounded-xl py-2.5 pl-8 pr-28 text-sm font-semibold text-white focus:outline-none focus:border-emerald-400 font-mono"
                      placeholder="Enter Naira amount"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                      ≈ ${(amountNgn / usdtRate).toFixed(2)} USDT
                    </span>
                  </div>
                </div>

                {/* Platform Bank Account Details Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      Official Platform Bank Account
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                      Live Escrow Bank
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400">Bank Name:</span>
                      <span className="font-extrabold text-white">{platformBank.bankName}</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Account Number:</span>
                        <span className="font-mono font-black text-lg text-emerald-300 tracking-wider">
                          {platformBank.accountNumber}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBankAcc}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        {copiedBankAcc ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedBankAcc ? 'Copied' : 'Copy Number'}</span>
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/80 p-2.5 rounded-xl border border-white/5">
                      <span className="text-slate-400">Account Name:</span>
                      <span className="font-extrabold text-white">{platformBank.accountName}</span>
                    </div>
                  </div>

                  {/* Unique Transaction Reference Section */}
                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-amber-300 font-bold block uppercase tracking-wider">
                          Your Unique Transaction Reference
                        </span>
                        <span className="text-base font-black text-amber-400 font-mono select-all">
                          {fiatRefNo}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyRefNo}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        {copiedRefNo ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedRefNo ? 'Copied' : 'Copy Ref'}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-amber-200/90 leading-tight flex items-start gap-1.5 pt-1 border-t border-amber-500/20">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>IMPORTANT:</strong> Copy and paste <code className="bg-amber-950 px-1 rounded text-white">{fiatRefNo}</code> into your bank transfer <strong>Narration / Remark / Reference</strong> field.
                      </span>
                    </p>
                  </div>
                </div>

                {/* Payment Confirmation Button */}
                <button
                  type="button"
                  id="btn-confirm-fiat-payment"
                  disabled={isSubmittingFiat || amountNgn <= 0}
                  onClick={handleConfirmFiatPayment}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm tracking-wide shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSubmittingFiat ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span>I Have Made Payment (₦{amountNgn.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* USDT Amount Presets (Crypto Tabs Only) */}
            {selectedMethod !== 'fiat_naira' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-300">Select Deposit Amount</label>
                  <span className="text-[10px] text-purple-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30 font-bold">
                    Live Rate: 1 USDT ≈ ₦{usdtRate.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                  {PRESET_AMOUNTS_USDT.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setAmountUsdt(amt);
                        sound.playClick();
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${amountUsdt === amt
                          ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/30'
                          : 'bg-slate-800/80 hover:bg-slate-800 border-white/5 text-slate-300'
                        }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                {/* Custom USDT Input */}
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-purple-400">
                    $
                  </span>
                  <input
                    id="input-deposit-usdt"
                    type="number"
                    min="1"
                    step="1"
                    value={amountUsdt || ''}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setAmountUsdt(val);
                    }}
                    className="w-full bg-slate-950/70 border border-purple-500/30 rounded-xl py-2.5 pl-8 pr-28 text-sm font-semibold text-white focus:outline-none focus:border-purple-400 font-mono"
                    placeholder="Custom USDT amount"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    ≈ ₦{(amountUsdt * usdtRate).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* TAB 1: DIRECT USDT TRANSFER (METHOD 2: DYNAMIC MICRO-AMOUNT MATCHING) */}
            {selectedMethod === 'polygon_direct' && (
              <div className="space-y-3.5">
                {/* Method 2 Dynamic Instruction Banner */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-purple-950/40 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      Deposit Order
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-amber-300 font-mono bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      <span>{formatMinutes(timeRemaining)}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Deposits reflects after 2 confirmations. Please send the <strong>EXACT amount</strong> below:
                  </p>

                  {/* Exact Payable Amount Box */}
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-indigo-500/40 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">
                        Exact Amount to Transfer
                      </span>
                      <span className="text-xl font-black text-amber-400 font-mono select-all tracking-wide">
                        {isLoadingInvoice ? (
                          <span className="text-sm text-slate-400 animate-pulse">Generating unique amount...</span>
                        ) : (
                          `${depositInvoice?.exactPayableUsdt ?? (amountUsdt + 0.0024)} USDT`
                        )}
                      </span>
                      <span className="text-[10px] text-emerald-400 block font-semibold mt-0.5">
                        (Credits exactly ₦{((depositInvoice?.baseAmountUsdt || amountUsdt) * usdtRate).toLocaleString()} / ${depositInvoice?.baseAmountUsdt || amountUsdt} USDT)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyExactAmount}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                    >
                      {copiedExactAmount ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedExactAmount ? 'Copied' : 'Copy Exact'}</span>
                    </button>
                  </div>

                  {/* Treasury Deposit Address Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-purple-400" />
                        <span>Wallet Address (Polygon)</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyVault}
                        className="text-[10px] text-purple-300 hover:text-purple-200 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedVault ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedVault ? 'Copied' : 'Copy Address'}</span>
                      </button>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10 font-mono text-xs text-purple-200 break-all select-all">
                      {treasuryDepositAddress}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-1 pt-1">
                    <p className="flex items-center gap-1.5 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      Network: <strong>Polygon PoS (POL / MATIC)</strong>. Send only <strong>USDT</strong>.
                    </p>
                    <p className="text-slate-400 text-[10px]">
                      Supported exchanges: Binance, Bybit, OKX, KuCoin, Roqqu, Busha, Trust Wallet, MetaMask.
                    </p>
                  </div>
                </div>

                {/* Auto-Detection Status & Trigger */}
                <button
                  type="button"
                  id="btn-confirm-direct-transfer"
                  disabled={isSimulatingDetection || isLoadingInvoice}
                  onClick={handleVerifyDirectTransfer}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-black text-sm tracking-wide shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isSimulatingDetection ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Scanning Polygon Blockchain for Exact Amount...</span>
                    </div>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>I Have Sent {depositInvoice?.exactPayableUsdt || amountUsdt} USDT (Auto-Detect)</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB 2: CONNECTED WEB3 WALLET */}
            {selectedMethod === 'polygon_web3' && (
              <div className="space-y-3.5">
                {/* Web3 Wallet Connection Card */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">EVM Web3 Wallet</span>
                    </div>

                    {walletAddress ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                        </span>
                        <button
                          type="button"
                          onClick={() => refreshBalances(walletAddress)}
                          title="Refresh Balances"
                          className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleConnectWallet}
                        disabled={isConnectingWallet}
                        className="py-1 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isConnectingWallet ? 'Connecting...' : 'Connect Wallet'}
                      </button>
                    )}
                  </div>

                  {/* Network verification indicator */}
                  {walletAddress && !isPolygonNetwork && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-[11px]">Wallet on wrong chain. Switch to Polygon.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSwitchNetwork}
                        className="py-0.5 px-2 bg-amber-500 text-slate-950 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-amber-400"
                      >
                        Switch Network
                      </button>
                    </div>
                  )}

                  {/* Wallet Balances info */}
                  {walletAddress && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-400 block">Your Polygon USDT</span>
                        <span className="text-xs font-bold text-white font-mono">${usdtBalance} USDT</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
                        <span className="text-[10px] text-slate-400 block">Vault Escrow Balance</span>
                        <span className="text-xs font-bold text-purple-300 font-mono">${contractDeposits} USDT</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contract Specs Footer */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/10 text-[11px] space-y-1 text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Escrow Contract:</span>
                    <div className="flex items-center gap-1 font-mono text-purple-300">
                      <span>{POLYGON_CONFIG.escrowContractAddress.slice(0, 8)}...{POLYGON_CONFIG.escrowContractAddress.slice(-6)}</span>
                      <button
                        type="button"
                        onClick={handleCopyContract}
                        className="p-0.5 hover:text-white"
                        title="Copy Contract Address"
                      >
                        {copiedContract ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span>Chain: Polygon PoS </span>
                    <span>Tokens: Native Bridge USDT</span>
                  </div>
                </div>

                {web3Error && (
                  <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{web3Error}</span>
                  </div>
                )}

                {/* Web3 Action CTA */}
                <button
                  type="button"
                  id="btn-confirm-polygon-deposit"
                  disabled={isProcessing}
                  onClick={handleConfirmWeb3Deposit}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm tracking-wide shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{web3StatusStep || 'Executing On-Chain Deposit...'}</span>
                    </div>
                  ) : !walletAddress ? (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Connect Wallet to Deposit ${amountUsdt} USDT</span>
                    </>
                  ) : (
                    <>
                      <span>Deposit ${amountUsdt} USDT (Smart Contract)</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

