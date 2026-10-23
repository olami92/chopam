import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { Trophy, Flame, CheckCircle2, Award, RotateCcw, ShieldCheck, Play, User } from 'lucide-react';
import { getStoredReplays } from '../services/replayService';
import { getDynamicAvatarUrl } from '../utils/avatar';

export interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  displayName: string;
  winRate: number;
  totalMatches: number;
  totalWon: number;
  avatar: string;
  tier: string;
  isCurrentUser?: boolean;
}

export const AnalyticsScreen: React.FC = () => {
  const { user, gameSkillMatrix, openReplay } = useGame();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'performance' | 'replays'>('performance');
  const [realLeaderboard, setRealLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const storedReplays = getStoredReplays();

  useEffect(() => {
    let isMounted = true;
    const fetchRealLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      try {
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.leaderboard) && data.leaderboard.length > 0) {
            const formatted: LeaderboardUser[] = data.leaderboard.map((item: any) => {
              const isMe = user?.username?.toLowerCase() === item.username?.toLowerCase();
              const effectiveWinRate = isMe && typeof user?.winRate === 'number' && user.winRate > 0
                ? user.winRate
                : (item.winRate || 0);
              const effectiveMatches = isMe && typeof user?.totalWagers === 'number' && user.totalWagers > 0
                ? user.totalWagers
                : (item.totalMatches || 0);
              const effectiveWon = isMe && (user?.netWinnings !== undefined || user?.availableBalance !== undefined)
                ? (user.netWinnings || user.availableBalance || 0)
                : (item.totalWon || 0);

              return {
                rank: item.rank,
                id: item.id,
                name: item.username,
                displayName: item.displayName || item.username,
                winRate: effectiveWinRate,
                totalMatches: effectiveMatches,
                totalWon: effectiveWon,
                avatar: item.avatarUrl || getDynamicAvatarUrl(item.username),
                tier: item.tier || 'Gold Staker',
                isCurrentUser: isMe,
              };
            });

            formatted.sort((a, b) => b.winRate - a.winRate || b.totalMatches - a.totalMatches || b.totalWon - a.totalWon);
            formatted.forEach((item, index) => {
              item.rank = index + 1;
            });

            if (isMounted) setRealLeaderboard(formatted);
            return;
          }
        }
      } catch {
        // fallback to live user context
      }

      // Local fallback with logged-in user and persistent registered players
      if (isMounted) {
        const localReal: LeaderboardUser[] = [];
        if (user && user.username) {
          localReal.push({
            rank: 1,
            id: user.id || 'usr_me',
            name: user.username,
            displayName: user.actualName || user.displayName || user.username,
            winRate: user.winRate || 0,
            totalMatches: user.totalWagers || 0,
            totalWon: user.netWinnings || user.availableBalance || 0,
            avatar: user.avatarUrl || getDynamicAvatarUrl(user.username),
            tier: user.tier || 'Grandmaster II',
            isCurrentUser: true,
          });
        }
        setRealLeaderboard(localReal);
      }
    };

    fetchRealLeaderboard();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Dynamic calculations for badges & streaks
  const maxStreak = Math.max(...gameSkillMatrix.map((g) => g.highestStreak), 0);
  const activeStreak = Math.max(...gameSkillMatrix.map((g) => g.currentStreak), 0);
  const totalVolume = gameSkillMatrix.reduce((acc, g) => acc + g.matches * 3500, 0);

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 space-y-4 pb-20 overflow-y-auto">
      {/* Tier Header Card */}
      <div
        id="analytics-tier-card"
        className="bg-gradient-to-br from-indigo-600/20 via-slate-900/60 to-slate-900/90 backdrop-blur-md border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl">
            <Trophy className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-black text-white">{user.tier}</h2>
              <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400/20" />
            </div>
            <p className="text-xs text-slate-300">Leaderboard Rank #{user.rank}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                Player Standings
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 uppercase tracking-wider block">Net Earnings</span>
          <span className="text-xl font-black text-emerald-400 font-mono">
            +₦{user.netWinnings.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Analytics Tabs Selector */}
      <div className="flex gap-2 p-1 bg-slate-950/60 backdrop-blur-md rounded-2xl border border-white/10">
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'performance'
            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
            : 'text-slate-400 hover:text-white'
            }`}
        >
          My Skill Matrix
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'leaderboard'
            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
            : 'text-slate-400 hover:text-white'
            }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('replays')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'replays'
            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
            : 'text-slate-400 hover:text-white'
            }`}
        >
          Match Replays ({storedReplays.length})
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'performance' ? (
        <div className="space-y-4">
          {/* Quick Metrics Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Overall Win Rate
              </span>
              <span className="text-xl font-black text-amber-400 font-mono">{user.winRate}%</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Total Battles
              </span>
              <span className="text-xl font-black text-white font-mono">{user.totalWagers}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Active Win Streak
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono flex items-center gap-1">
                <Flame className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                <span>{activeStreak} W</span>
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Highest Streak
              </span>
              <span className="text-xl font-black text-indigo-400 font-mono">{maxStreak} W</span>
            </div>
          </div>

          {/* Per-Game Performance Breakdown */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Game Mode Telemetry Matrix
            </h3>
            {gameSkillMatrix.map((game) => (
              <div
                key={game.gameMode}
                className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 flex items-center justify-between shadow-sm hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-amber-400 font-black text-sm">
                    {game.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                      <span>{game.name}</span>
                      <span className="text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.2 rounded-full border border-indigo-500/30">
                        {game.tier}
                      </span>
                    </h4>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{game.matches} Matches</span>
                      <span>•</span>
                      <span>{game.won} Won / {game.lost} Lost</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-emerald-400 font-mono block">
                    {game.winRate}% WR
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Net: ₦{game.profit.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Badges & Streaks */}
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Arena Badges & Streaks
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    {maxStreak}-Streak Master
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {activeStreak > 0 ? `${activeStreak} active win streak` : `${maxStreak} career max streak`}
                  </span>
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">Escrow Whale</span>
                  <span className="text-[10px] text-slate-400">
                    ₦{(totalVolume / 1000).toFixed(0)}k volume settled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'leaderboard' ? (
        <div className="space-y-2.5">
          {/* Real Registered Player Rows */}
          {realLeaderboard.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-white/5 space-y-2">
              <User className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-slate-300 font-bold text-xs">No players recorded yet</p>
              <p className="text-[11px] text-slate-500">Play matches to claim top positions on the leaderboard.</p>
            </div>
          ) : (
            realLeaderboard.map((staker) => (
              <div
                key={staker.id || staker.name}
                className={`p-3.5 rounded-2xl backdrop-blur-md border flex items-center justify-between shadow-sm transition-all ${staker.isCurrentUser
                  ? 'bg-amber-500/10 border-amber-500/40 text-white'
                  : 'bg-slate-900/50 border-white/10 text-slate-200'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full font-extrabold text-xs flex items-center justify-center ${staker.rank === 1
                      ? 'bg-amber-400 text-slate-950'
                      : staker.rank === 2
                        ? 'bg-slate-300 text-slate-950'
                        : staker.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                  >
                    {staker.rank}
                  </span>
                  <img
                    src={staker.avatar || getDynamicAvatarUrl(staker.name)}
                    alt={staker.displayName || staker.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-white/10"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block leading-tight flex items-center gap-1">
                      <span>@{staker.name}</span>
                      {staker.isCurrentUser && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40 font-bold">
                          YOU
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-slate-400">{staker.tier}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 font-mono block">
                    ₦{staker.totalWon.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">{staker.winRate}% Win Rate</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Replays Tab */
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Match History & Move Snapshots
              </span>
            </div>
            <span className="text-[10px] text-slate-400">Step-by-step re-rendering</span>
          </div>

          <div className="space-y-3">
            {storedReplays.map((replay) => {
              const isWin = replay.winner === 'player';
              return (
                <div
                  key={replay.id}
                  className="bg-slate-900/50 backdrop-blur-md border border-white/10 hover:border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-md ${isWin
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                      >
                        {isWin ? <Trophy className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white">
                            Match {replay.id} • vs @{replay.player2.username}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Mode: {replay.gameMode.toUpperCase()} | Stake: ₦{replay.stake.toLocaleString()} | Pot: ₦{replay.pot.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => openReplay(replay.id)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Replay</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
