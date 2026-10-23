import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { X, KeyRound, ArrowRight, AlertCircle, Clipboard, Check } from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';

interface JoinRoomModalProps {
  onClose: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({ onClose }) => {
  const { joinByRoomCode } = useGame();
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasteStatus, setPasteStatus] = useState<string | null>(null);

  const handlePasteFromClipboard = async () => {
    sound.playClick();
    telegram.triggerHaptic('light');
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Extract room code format TG-XXXX or clean uppercase alphanumeric with dash
        const match = text.match(/TG-\d{4}/i) || text.match(/[A-Z0-9]{2,4}-[A-Z0-9]{3,6}/i);
        const extracted = match ? match[0].toUpperCase() : text.trim().toUpperCase();
        setCode(extracted);
        setPasteStatus('Pasted!');
        setTimeout(() => setPasteStatus(null), 2000);
      }
    } catch {
      setPasteStatus('Paste unavailable');
      setTimeout(() => setPasteStatus(null), 2000);
    }
  };

  const handleJoin = async () => {
    setErrorMsg(null);
    const clean = code.trim().toUpperCase();
    if (!clean) {
      setErrorMsg('Please enter a room code');
      return;
    }

    sound.playClick();
    telegram.triggerHaptic('medium');

    const success = await joinByRoomCode(clean);
    if (success) {
      onClose();
    } else {
      setErrorMsg('Failed to join room. Check code and balance.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        id="join-room-modal"
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Join Private Table</h2>
              <p className="text-[11px] text-slate-400">Enter room code shared by your opponent (via WhatsApp, SMS, or Telegram)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">Room Code</label>
          <div className="relative flex items-center">
            <input
              id="input-room-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. TG-8842"
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl py-3 pl-4 pr-24 text-center font-mono text-base font-bold tracking-widest text-amber-400 uppercase placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              id="btn-paste-room-code"
              onClick={handlePasteFromClipboard}
              className="absolute right-2 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              {pasteStatus === 'Pasted!' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
              <span>{pasteStatus || 'Paste'}</span>
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {['TG-8842', 'TG-1044', 'TG-4401'].map((sample) => (
              <motion.button
                key={sample}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCode(sample)}
                className="text-[10px] text-slate-400 hover:text-amber-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-white/5 font-mono cursor-pointer"
              >
                {sample}
              </motion.button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <motion.button
          id="btn-submit-join-room"
          whileHover={{ scale: code.trim() ? 1.02 : 1 }}
          whileTap={{ scale: code.trim() ? 0.97 : 1 }}
          onClick={handleJoin}
          disabled={!code.trim()}
          className="w-full py-3.5 px-4 rounded-xl bg-indigo-500 hover:brightness-110 text-white font-black text-sm shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>Connect & Stake</span>
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </div>
  );
};
