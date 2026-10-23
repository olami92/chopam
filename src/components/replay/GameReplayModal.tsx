import React, { useState, useEffect, useRef } from 'react';
import { MatchReplayData } from '../../types/replay';
import { LudoReplayBoard } from './LudoReplayBoard';
import { WhotReplayBoard } from './WhotReplayBoard';
import { DraughtsReplayBoard } from './DraughtsReplayBoard';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Frown,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles,
  Layers,
  Clock,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { sound } from '../../services/audio';
import { telegram } from '../../services/telegram';

interface GameReplayModalProps {
  replay: MatchReplayData;
  onClose: () => void;
}

export const GameReplayModal: React.FC<GameReplayModalProps> = ({ replay, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeLogRef = useRef<HTMLDivElement | null>(null);

  const totalSteps = replay.steps.length;
  const currentStep = replay.steps.find((s) => s.stepIndex === currentStepIndex) || replay.steps[0];
  const isWin = replay.winner === 'player';

  // Auto-play timer effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(1800 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= totalSteps) {
            setIsPlaying(false);
            return prev;
          }
          sound.playClick();
          return prev + 1;
        });
      }, intervalMs);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalSteps]);

  // Scroll active log into view
  useEffect(() => {
    if (activeLogRef.current) {
      activeLogRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < totalSteps) {
      sound.playClick();
      telegram.triggerHaptic('light');
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 1) {
      sound.playClick();
      telegram.triggerHaptic('light');
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleJumpToStart = () => {
    sound.playClick();
    setCurrentStepIndex(1);
    setIsPlaying(false);
  };

  const handleJumpToEnd = () => {
    sound.playClick();
    setCurrentStepIndex(totalSteps);
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    sound.playClick();
    telegram.triggerHaptic('medium');
    if (currentStepIndex >= totalSteps) {
      setCurrentStepIndex(1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="game-replay-modal"
        className="w-full max-w-4xl max-h-[92vh] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Game Replay & State Analysis</h3>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase">
                  {replay.gameMode.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Match {replay.id} • Room {replay.roomCode} • Duration: {replay.duration}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close Replay"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Visual Game Board Re-renderer */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-4">
            {replay.gameMode === 'whot' ? (
              <WhotReplayBoard
                snapshot={currentStep.whotState}
                actorName={currentStep.actorName}
                turn={currentStep.turn}
              />
            ) : replay.gameMode === 'draughts' ? (
              <DraughtsReplayBoard
                snapshot={currentStep.draughtsState}
                actorName={currentStep.actorName}
                turn={currentStep.turn}
              />
            ) : (
              <LudoReplayBoard
                snapshot={currentStep.ludoState}
                actorName={currentStep.actorName}
                turn={currentStep.turn}
              />
            )}

            {/* Step-by-Step Playback Controls Bar */}
            <div className="w-full max-w-[440px] bg-slate-950/80 border border-white/10 rounded-2xl p-3.5 space-y-3 shadow-xl">
              {/* Timeline Scrubber */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-400">
                    Step {currentStepIndex} of {totalSteps}
                  </span>
                  <span className="text-amber-400 font-mono">
                    {currentStep.timestampOffset} / {replay.duration}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={totalSteps}
                  value={currentStepIndex}
                  onChange={(e) => {
                    setCurrentStepIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>

              {/* Main Playback Buttons */}
              <div className="flex items-center justify-between pt-1">
                {/* Speed selector */}
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/5 text-[10px] font-bold">
                  {([0.5, 1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2 py-1 rounded-lg transition-all ${
                        playbackSpeed === spd
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Central playback cluster */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleJumpToStart}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                    title="Jump to Start"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePrev}
                    disabled={currentStepIndex <= 1}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
                    title="Previous Step"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleTogglePlay}
                    className="p-3 rounded-2xl bg-amber-500 hover:brightness-110 text-slate-950 font-black shadow-lg shadow-amber-500/25 transition-all cursor-pointer"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-slate-950" /> : <Play className="w-5 h-5 fill-slate-950" />}
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={currentStepIndex >= totalSteps}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white border border-white/5 transition-colors cursor-pointer"
                    title="Next Step"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleJumpToEnd}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                    title="Jump to Final Outcome"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Move Feed & Escrow Settlement Info */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Match Settlement Recap Card */}
            <div className="bg-slate-950/70 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isWin ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isWin ? <Trophy className="w-4 h-4" /> : <Frown className="w-4 h-4" />}
                  </div>
                  <span className="text-xs font-black text-white">
                    {isWin ? 'Victorious Duel' : 'Defeat Settlement'}
                  </span>
                </div>

                <span className="text-xs font-mono font-bold text-emerald-400">
                  {isWin ? `+₦${(replay.pot - replay.stake).toLocaleString()}` : `-₦${replay.stake.toLocaleString()}`}
                </span>
              </div>

              {/* Stake & Pot Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-900/60 rounded-xl border border-white/5 text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Stake</span>
                  <span className="font-extrabold text-white font-mono">₦{replay.stake.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Net Pot</span>
                  <span className="font-extrabold text-emerald-400 font-mono">₦{replay.pot.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase block font-bold">Gate Fee</span>
                  <span className="font-extrabold text-amber-400 font-mono">₦{replay.fee.toLocaleString()}</span>
                </div>
              </div>

              {/* Smart Contract Proof Hash */}
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                <span className="text-amber-400 font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Proof: PROOF-{replay.id}</span>
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  Oracle Verified
                </span>
              </div>
            </div>

            {/* Current Active Move Highlight */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Active Move #{currentStep.stepIndex}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {currentStep.timestampOffset}
                </span>
              </div>
              <h4 className="text-sm font-black text-white">{currentStep.actionTitle}</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {currentStep.actionDescription}
              </p>
            </div>

            {/* Scrollable Turn-by-Turn Move History List */}
            <div className="flex-1 min-h-[220px] max-h-[300px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                Complete Move Chronology ({totalSteps} Steps)
              </div>
              {replay.steps.map((step) => {
                const isActive = step.stepIndex === currentStepIndex;

                return (
                  <div
                    key={step.stepIndex}
                    ref={isActive ? activeLogRef : null}
                    onClick={() => {
                      sound.playClick();
                      setCurrentStepIndex(step.stepIndex);
                      setIsPlaying(false);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isActive
                        ? 'bg-amber-500/20 border-amber-500/50 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-slate-900/50 hover:bg-slate-900 border-white/5 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {step.stepIndex}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-white' : 'text-slate-300'
                          }`}
                        >
                          {step.actorName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {step.timestampOffset}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {step.actionTitle}
                      </p>
                    </div>

                    {step.isKeyMoment && (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
