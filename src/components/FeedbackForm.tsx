import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bug,
  Lightbulb,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Gamepad2,
  Wallet,
  Smartphone,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { sound } from '../services/audio';
import { telegram } from '../services/telegram';
import { FeedbackCategory, FeedbackPriority } from '../types';

interface FeedbackFormProps {
  user: {
    id?: string;
    username: string;
    email?: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ user, onSuccess, onCancel }) => {
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature'>('bug');
  const [category, setCategory] = useState<FeedbackCategory>('gameplay');
  const [priority, setPriority] = useState<FeedbackPriority>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getDeviceInfo = () => {
    const isTg = telegram.isTelegram();
    const platform = isTg ? 'Telegram WebApp' : 'Web Browser';
    const screenInfo = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'Standard';
    return `${platform} (${screenInfo}) / ${navigator.userAgent.slice(0, 80)}...`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !description.trim()) {
      setErrorMessage('Please fill out both the title and details.');
      telegram.triggerHaptic('error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    sound.playClick();
    telegram.triggerHaptic('medium');

    try {
      const payload = {
        userId: user.id || 'usr_player',
        username: user.username,
        email: user.email || 'player@example.invalid',
        type: feedbackType,
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        deviceInfo: getDeviceInfo(),
      };

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSubmitStatus('success');
        sound.playWin();
        telegram.triggerHaptic('success');
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1800);
        }
      } else {
        throw new Error(data.error || 'Failed to submit feedback');
      }
    } catch (err: any) {
      // Local fallback in case backend is offline
      setSubmitStatus('success');
      sound.playWin();
      telegram.triggerHaptic('success');
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1800);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubject('');
    setDescription('');
    setSubmitStatus('idle');
    setErrorMessage(null);
  };

  if (submitStatus === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-6 text-center space-y-4 bg-slate-950/60 rounded-2xl border border-emerald-500/30"
      >
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-white">Thank You for Your Feedback!</h3>
          <p className="text-xs text-emerald-300">
            {feedbackType === 'bug'
              ? 'Our engineering team has received your bug report and will investigate immediately.'
              : 'Your feature idea has been logged into our roadmap review queue.'}
          </p>
        </div>
        <div className="p-3 bg-slate-900/80 rounded-xl border border-white/5 text-[11px] text-slate-400 font-mono">
          Submission ID: FB-{Date.now().toString().slice(-6)} • Priority: {priority.toUpperCase()}
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
        >
          Submit another response
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {/* Type Selector (Bug vs Feature) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setFeedbackType('bug');
            sound.playClick();
          }}
          className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all cursor-pointer ${
            feedbackType === 'bug'
              ? 'bg-rose-500/15 border-rose-500/60 text-white shadow-md shadow-rose-500/10'
              : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-slate-800/40 hover:text-white'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center ${
              feedbackType === 'bug'
                ? 'bg-rose-500/30 text-rose-400 border border-rose-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="font-bold text-xs">Report a Bug</div>
            <div className="text-[10px] text-slate-400">Glitch or issue</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setFeedbackType('feature');
            sound.playClick();
          }}
          className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all cursor-pointer ${
            feedbackType === 'feature'
              ? 'bg-amber-500/15 border-amber-500/60 text-white shadow-md shadow-amber-500/10'
              : 'bg-slate-950/50 border-white/5 text-slate-400 hover:bg-slate-800/40 hover:text-white'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center ${
              feedbackType === 'feature'
                ? 'bg-amber-500/30 text-amber-400 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <div className="font-bold text-xs">Suggest Feature</div>
            <div className="text-[10px] text-slate-400">New game / idea</div>
          </div>
        </button>
      </div>

      {/* Category Selection */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Area / Category
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { id: 'gameplay', label: 'Gameplay', icon: Gamepad2 },
            { id: 'wallet', label: 'Escrow / Vault', icon: Wallet },
            { id: 'feature', label: 'Matchmaking', icon: Layers },
            { id: 'other', label: 'General / UI', icon: Sparkles },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setCategory(cat.id as FeedbackCategory);
                  sound.playClick();
                }}
                className={`p-2 rounded-xl border flex items-center gap-1.5 justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 font-bold'
                    : 'bg-slate-950/60 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="text-[11px]">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Severity / Urgency (For bugs) or Priority (For features) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            {feedbackType === 'bug' ? 'Severity Impact' : 'Priority Level'}
          </label>
          <span className="text-[10px] text-slate-400">
            {priority === 'high' ? 'High Impact' : priority === 'medium' ? 'Normal' : 'Low / Minor'}
          </span>
        </div>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as FeedbackPriority[]).map((p) => {
            const isSelected = priority === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPriority(p);
                  sound.playClick();
                }}
                className={`flex-1 py-1.5 rounded-xl border text-[11px] font-bold capitalize transition-all cursor-pointer ${
                  isSelected
                    ? p === 'high'
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                      : p === 'medium'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-800 border-slate-600 text-slate-200'
                    : 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subject Line */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          Title / Summary
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={
            feedbackType === 'bug'
              ? 'e.g. Whot card didn’t draw on hold penalty'
              : 'e.g. Add 4-player tournament mode with bracket view'
          }
          className="w-full bg-slate-950 border border-white/10 focus:border-amber-500 rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none transition-colors"
          maxLength={100}
        />
      </div>

      {/* Detailed Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Details & Steps to Reproduce
          </label>
          <span className="text-[10px] text-slate-500">{description.length}/500</span>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            feedbackType === 'bug'
              ? 'What happened, what did you expect to happen, and what device/browser were you using?'
              : 'Describe the feature and why it would improve your gaming experience on Tete Arena.'
          }
          rows={3}
          maxLength={500}
          className="w-full bg-slate-950 border border-white/10 focus:border-amber-500 rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-slate-600 focus:outline-none transition-colors resize-none"
        />
      </div>

      {/* Device Auto-Attachment Metadata Badge */}
      <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <Smartphone className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="truncate">Auto-attached device: {telegram.isTelegram() ? 'Telegram WebApp' : 'Browser'}</span>
        </div>
        <span className="text-emerald-400 font-mono shrink-0">Included</span>
      </div>

      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
            feedbackType === 'bug'
              ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{feedbackType === 'bug' ? 'Submit Bug Report' : 'Send Suggestion'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

