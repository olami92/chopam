import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGame } from '../context/GameContext';
import { GameMode, OpenTable, LiveSpectateMatch } from '../types';
import {
  Swords,
  Plus,
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Flame,
  Users,
  Eye,
  Radio,
  Wifi,
  Sparkles,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { CreateRoomModal } from '../components/CreateRoomModal';
import { JoinRoomModal } from '../components/JoinRoomModal';
import { SpectatorScreen } from './SpectatorScreen';
import { useSpectatorSocket } from '../hooks/useSpectatorSocket';
import { sound } from '../services/audio';

export const LobbyScreen: React.FC = () => {
  const { openTables, joinTable, user, spectatingMatchId, setSpectatingMatchId } = useGame();
  const [lobbyView, setLobbyView] = useState<'play' | 'spectate'>('play');
  const [selectedFilter, setSelectedFilter] = useState<'all' | GameMode>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [copiedTableCodeId, setCopiedTableCodeId] = useState<string | null>(null);

  const handleCopyTableCode = (table: OpenTable, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(table.roomCode);
    setCopiedTableCodeId(table.id);
    sound.playClick();
    setTimeout(() => setCopiedTableCodeId(null), 2000);
  };

  // Read-only WebSocket spectator connection
  const {
    connectionStatus,
    liveMatches,
    currentMatch,
    spectatorCount,
    reactions,
    latency,
    spectate,
    leaveSpectate,
    sendCheer,
  } = useSpectatorSocket(spectatingMatchId);

  // If currently spectating a match, render the live SpectatorScreen
  if (spectatingMatchId && currentMatch) {
    return (
      <SpectatorScreen
        match={currentMatch}
        spectatorCount={spectatorCount}
        connectionStatus={connectionStatus}
        latency={latency}
        reactions={reactions}
        onExit={() => {
          leaveSpectate();
          setSpectatingMatchId(null);
        }}
        onSendCheer={(emoji) => sendCheer(emoji, user.username)}
      />
    );
  }

  const filterChips: { id: 'all' | GameMode; label: string }[] = [
    { id: 'all', label: 'All Arenas' },
    { id: 'whot', label: 'Naija Whot' },
    { id: 'ludo_classic', label: 'Classic Ludo' },
    { id: 'ludo_blitz', label: 'Ludo Blitz' },
    { id: 'draughts', label: 'Draughts' },
  ];

  const filteredTables = openTables.filter((table) => {
    if (selectedFilter === 'all') return true;
    return table.gameMode === selectedFilter;
  });

  const filteredLiveMatches = liveMatches.filter((match) => {
    if (selectedFilter === 'all') return true;
    return match.gameMode === selectedFilter;
  });

  const handleJoin = (table: OpenTable) => {
    sound.playClick();
    joinTable(table);
  };

  const handleStartSpectating = (match: LiveSpectateMatch) => {
    sound.playClick();
    spectate(match.id);
    setSpectatingMatchId(match.id);
  };

  return (
    <div className="flex-1 px-3 sm:px-6 py-4 space-y-4 pb-20 overflow-y-auto">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-1.5">
            <Swords className="w-5 h-5 text-amber-400" />
            <span>Matchmaking & Spectate Lobby</span>
          </h1>
          <p className="text-xs text-slate-400">
            Join staking tables or watch live battles in real-time via WebSocket
          </p>
        </div>

        {lobbyView === 'play' && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowJoinModal(true)}
              className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-indigo-400 border border-indigo-500/30 shadow-sm cursor-pointer transition-colors"
              title="Join with Room Code"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 px-4 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Host Table</span>
            </button>
          </div>
        )}
      </div>

      {/* Segmented View Switcher: Stake Tables vs Live Spectate */}
      <div className="flex p-1 bg-slate-900/80 border border-white/10 rounded-2xl gap-1">
        <button
          onClick={() => {
            setLobbyView('play');
            sound.playClick();
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            lobbyView === 'play'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>Wager Tables ({filteredTables.length})</span>
        </button>

        <button
          onClick={() => {
            setLobbyView('spectate');
            sound.playClick();
          }}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer relative ${
            lobbyView === 'spectate'
              ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 animate-pulse text-rose-300" />
            <Eye className="w-4 h-4" />
            <span>Spectate Live ({liveMatches.length})</span>
          </span>
          <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-rose-600/60 text-white border border-rose-400/50 uppercase">
            0 Wager
          </span>
        </button>
      </div>

      {/* Filter Chips Carousel */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filterChips.map((chip) => {
          const isSelected = selectedFilter === chip.id;
          return (
            <motion.button
              key={chip.id}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              onClick={() => {
                setSelectedFilter(chip.id);
                sound.playClick();
              }}
              className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-white/10'
              }`}
            >
              {chip.label}
            </motion.button>
          );
        })}
      </div>

      {/* SECTION 1: SPECTATE LIVE VIEW */}
      {lobbyView === 'spectate' && (
        <div className="space-y-3.5">
          {/* Spectator Mode Safety Banner */}
          <div className="bg-slate-900/70 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200">
                  Read-Only Real-Time WebSocket Stream
                </div>
                <div className="text-[11px] text-slate-400">
                  Spectate active matches live with zero wager deductions. Your available vault balance remains untouched.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg shrink-0">
              <Wifi className="w-3 h-3" />
              <span>{latency ? `${latency}ms` : connectionStatus}</span>
            </div>
          </div>

          {/* Live Matches Grid */}
          {filteredLiveMatches.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-white/5">
              <Eye className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No active matches to spectate in this category right now.</p>
              <button
                onClick={() => setSelectedFilter('all')}
                className="py-2 px-4 rounded-xl bg-slate-800 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                View All Categories
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredLiveMatches.map((match, idx) => {
                const gameTitle =
                  match.gameMode === 'whot'
                    ? 'Naija Whot'
                    : match.gameMode === 'ludo_classic'
                    ? 'Classic Ludo'
                    : match.gameMode === 'ludo_blitz'
                    ? 'Ludo Blitz'
                    : match.gameMode === 'bead16'
                    ? 'Bead 16 Tactics'
                    : 'Draughts';

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.04 }}
                    whileHover={{
                      scale: 1.02,
                      y: -3,
                      transition: { type: 'spring', stiffness: 400, damping: 22 },
                    }}
                    className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-rose-500/40 rounded-3xl p-4 shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    {/* Top status bar: LIVE pulse, Game Mode, Viewers */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-rose-500/20 border border-rose-500/30 text-rose-400 px-2 py-0.5 rounded-full text-[10px] font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                          <span>LIVE</span>
                        </div>
                        <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.2 rounded-full">
                          {gameTitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-lg border border-white/5">
                        <Users className="w-3 h-3 text-amber-400" />
                        <span>{match.spectatorCount}</span>
                      </div>
                    </div>

                    {/* Players Duel Matchup */}
                    <div className="flex items-center justify-between py-1 bg-slate-950/50 p-2.5 rounded-2xl border border-white/5">
                      {/* Player 1 */}
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={match.player1.avatarUrl}
                          alt={match.player1.displayName}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-400/80 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate max-w-[90px]">
                            @{match.player1.username}
                          </div>
                          <div className="text-[9px] text-emerald-400 font-semibold">
                            {match.player1.winRate}% WR
                          </div>
                        </div>
                      </div>

                      <div className="text-[10px] font-black text-amber-400 bg-slate-900 px-2 py-1 rounded-full border border-white/10 shrink-0">
                        VS
                      </div>

                      {/* Player 2 */}
                      <div className="flex items-center gap-2 min-w-0 text-right justify-end">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate max-w-[90px]">
                            @{match.player2.username}
                          </div>
                          <div className="text-[9px] text-emerald-400 font-semibold">
                            {match.player2.winRate}% WR
                          </div>
                        </div>
                        <img
                          src={match.player2.avatarUrl}
                          alt={match.player2.displayName}
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-rose-400/80 shrink-0"
                        />
                      </div>
                    </div>

                    {/* Live Action Ticker Snippet */}
                    <div className="text-[11px] text-amber-300/90 truncate bg-slate-950/40 px-2.5 py-1.5 rounded-xl border border-white/5 flex items-center gap-1.5">
                      <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse shrink-0" />
                      <span className="truncate">{match.lastAction}</span>
                    </div>

                    {/* Bottom: Escrow Pot & Spectate Button */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold block">
                          Locked Escrow Pot:
                        </span>
                        <span className="font-mono text-xs font-black text-emerald-400">
                          ₦{match.pot.toLocaleString()}
                        </span>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartSpectating(match)}
                        className="py-2 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs shadow-md shadow-rose-500/20 flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Spectate</span>
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: WAGER TABLES VIEW (EXISTING OPEN TABLES) */}
      {lobbyView === 'play' && (
        <div className="space-y-4">
          {/* Quick Spectate Banner Teaser */}
          {liveMatches.length > 0 && (
            <div
              onClick={() => {
                setLobbyView('spectate');
                sound.playClick();
              }}
              className="bg-gradient-to-r from-rose-950/50 via-slate-900/70 to-indigo-950/50 border border-rose-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-md hover:border-rose-400/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>{liveMatches.length} High-Stakes Matches Live Now</span>
                    <span className="px-1.5 py-0.2 text-[9px] font-black rounded-full bg-rose-500 text-white">
                      LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Watch top gladiators battle for ₦10,000+ pots with zero wager risk
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 shrink-0">
                <span>Spectate</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          )}

          {/* Tables Status Counter */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <span className="font-semibold text-slate-300">{filteredTables.length} Active Tables Ready</span>
            </span>
            <span className="text-amber-500 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Escrow Guaranteed
            </span>
          </div>

          {/* Open Tables List Grid */}
          {filteredTables.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-white/5">
              <Flame className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No open tables in this category right now.</p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCreateModal(true)}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:brightness-110 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
              >
                Be First to Host Table
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredTables.map((table, idx) => {
                const gameTitle =
                  table.gameMode === 'whot'
                    ? 'Naija Whot'
                    : table.gameMode === 'ludo_classic'
                    ? 'Classic Ludo'
                    : table.gameMode === 'ludo_blitz'
                    ? 'Ludo Blitz'
                    : table.gameMode === 'bead16'
                    ? 'Bead 16 Tactics'
                    : 'Draughts';

                return (
                  <motion.div
                    key={table.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: idx * 0.04 }}
                    whileHover={{
                      scale: 1.02,
                      y: -3,
                      transition: { type: 'spring', stiffness: 400, damping: 22 },
                    }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-slate-900/50 backdrop-blur-md border border-white/10 hover:border-indigo-500/40 rounded-3xl p-4 shadow-lg hover:shadow-xl hover:shadow-indigo-500/10 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    {/* Host Info & Mode */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={table.hostAvatar}
                          alt={table.hostName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-400/80 p-0.5 bg-indigo-500/20"
                        />
                        <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 w-2.5 h-2.5 rounded-full ring-1 ring-slate-950 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white truncate max-w-[110px]">
                            @{table.hostUsername}
                          </span>
                          <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.2 rounded-full">
                            {gameTitle}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyTableCode(table, e)}
                            title="Copy Room Code to share or join"
                            className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-slate-950/80 border border-white/10 hover:border-amber-400/50 px-1.5 py-0.2 rounded-md transition-colors cursor-pointer"
                          >
                            <span>{table.roomCode}</span>
                            {copiedTableCodeId === table.id ? (
                              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stake, Pot & Join CTA */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block leading-tight">
                          Pot:
                        </span>
                        <span className="font-black text-xs text-emerald-400 font-mono">
                          ₦{table.pot.toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          Stake ₦{table.stake.toLocaleString()}
                        </span>
                      </div>

                        {(() => {
                          const isSelfTable = Boolean(
                            user &&
                              table.hostUsername &&
                              user.username.trim().toLowerCase() === table.hostUsername.trim().toLowerCase()
                          );
                          return (
                            <motion.button
                              whileHover={isSelfTable ? {} : { scale: 1.05 }}
                              whileTap={isSelfTable ? {} : { scale: 0.94 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoin(table);
                              }}
                              className={`py-2 px-3.5 rounded-xl font-black text-xs shadow-md transition-all ${
                                isSelfTable
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700/60 opacity-80 cursor-pointer'
                                  : 'bg-white text-black hover:bg-slate-200 cursor-pointer'
                              }`}
                            >
                              {isSelfTable ? 'Host (You)' : 'Join Table'}
                            </motion.button>
                          );
                        })()}
                      </div>
                    </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showCreateModal && <CreateRoomModal onClose={() => setShowCreateModal(false)} />}
      {showJoinModal && <JoinRoomModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
};
