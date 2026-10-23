import React from 'react';
import { Timer, AlertTriangle, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface TurnTimerBarProps {
  timeLeft: number;
  maxTime: number;
  isPlayerTurn: boolean;
  theme?: 'blitz' | 'classic' | 'whot' | 'draughts' | 'bead16';
}

export const TurnTimerBar: React.FC<TurnTimerBarProps> = ({
  timeLeft,
  maxTime,
  isPlayerTurn,
  theme = 'classic',
}) => {
  const percentage = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));
  const isUrgent = isPlayerTurn && timeLeft <= 5;

  // Theme-specific styles
  const getThemeStyles = () => {
    switch (theme) {
      case 'bead16':
        return {
          container: isUrgent
            ? 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.35)]'
            : isPlayerTurn
            ? 'bg-cyan-950/50 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            : 'bg-slate-950/60 border-white/10',
          barColor: isUrgent
            ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400'
            : 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500',
          badge: isUrgent
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse'
            : isPlayerTurn
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            : 'bg-slate-800 text-slate-400 border-white/10',
          text: isUrgent
            ? 'text-rose-300 font-mono'
            : isPlayerTurn
            ? 'text-cyan-200 font-mono'
            : 'text-slate-400 font-mono',
        };
      case 'blitz':
        return {
          container: isUrgent
            ? 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.35)]'
            : isPlayerTurn
            ? 'bg-cyan-950/50 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
            : 'bg-slate-950/60 border-white/10',
          barColor: isUrgent
            ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400'
            : 'bg-gradient-to-r from-cyan-400 to-blue-500',
          badge: isUrgent
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse'
            : isPlayerTurn
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            : 'bg-slate-800 text-slate-400 border-white/10',
          text: isUrgent
            ? 'text-rose-300 font-mono'
            : isPlayerTurn
            ? 'text-cyan-200 font-mono'
            : 'text-slate-400 font-mono',
        };
      case 'whot':
        return {
          container: isUrgent
            ? 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            : isPlayerTurn
            ? 'bg-amber-950/50 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-slate-950/60 border-white/10',
          barColor: isUrgent
            ? 'bg-gradient-to-r from-rose-500 to-amber-400'
            : 'bg-gradient-to-r from-amber-400 to-yellow-500',
          badge: isUrgent
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse'
            : isPlayerTurn
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-slate-800 text-slate-400 border-white/10',
          text: isUrgent
            ? 'text-rose-300'
            : isPlayerTurn
            ? 'text-amber-200'
            : 'text-slate-400',
        };
      case 'draughts':
        return {
          container: isUrgent
            ? 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            : isPlayerTurn
            ? 'bg-amber-950/50 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-slate-950/60 border-white/10',
          barColor: isUrgent
            ? 'bg-gradient-to-r from-rose-500 to-amber-400'
            : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500',
          badge: isUrgent
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse'
            : isPlayerTurn
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-slate-800 text-slate-400 border-white/10',
          text: isUrgent
            ? 'text-rose-300'
            : isPlayerTurn
            ? 'text-amber-200'
            : 'text-slate-400',
        };
      case 'classic':
      default:
        return {
          container: isUrgent
            ? 'bg-rose-950/60 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            : isPlayerTurn
            ? 'bg-slate-900/90 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
            : 'bg-slate-950/60 border-white/10',
          barColor: isUrgent
            ? 'bg-gradient-to-r from-rose-500 to-amber-400'
            : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400',
          badge: isUrgent
            ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 animate-pulse'
            : isPlayerTurn
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-slate-800 text-slate-400 border-white/10',
          text: isUrgent
            ? 'text-rose-300'
            : isPlayerTurn
            ? 'text-emerald-200'
            : 'text-slate-400',
        };
    }
  };

  const styles = getThemeStyles();
  const formatTime = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remainder = safe % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
      : `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  return (
    <div
      className={`mx-3 mb-1 px-3 py-1.5 rounded-xl border transition-all duration-300 overflow-hidden ${styles.container}`}
    >
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-1.5 font-bold">
          {isPlayerTurn ? (
            <>
              {isUrgent ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
              ) : (
                <Timer className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span className={styles.text}>
                {isUrgent ? 'Hurry! Turn Ending' : 'Your Turn'}
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5 text-slate-500 animate-spin-slow" />
              <span className="text-slate-400 font-medium">Opponent's Turn</span>
            </>
          )}
        </div>

        {/* Countdown Badge */}
        <div className="flex items-center gap-1">
          {isPlayerTurn ? (
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-black border font-mono tracking-tight flex items-center gap-1 transition-all ${styles.badge}`}
            >
              <span>{formatTime(timeLeft)}</span>
              <span className="text-[9px] opacity-70 font-normal">/ {formatTime(maxTime)}</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] text-slate-500 bg-slate-900 border border-white/5 font-mono">
              Waiting...
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/5">
        <motion.div
          className={`h-full rounded-full transition-all ${styles.barColor}`}
          initial={false}
          animate={{
            width: isPlayerTurn ? `${percentage}%` : '0%',
          }}
          transition={{ duration: 0.3, ease: 'linear' }}
        />
      </div>
    </div>
  );
};
