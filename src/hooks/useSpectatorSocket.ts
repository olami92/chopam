import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveSpectateMatch, SpectatorReaction } from '../types';

export interface UseSpectatorSocketReturn {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  liveMatches: LiveSpectateMatch[];
  currentMatch: LiveSpectateMatch | null;
  spectatorCount: number;
  reactions: SpectatorReaction[];
  latency: number | null;
  isReadOnly: boolean;
  spectate: (matchId: string) => void;
  leaveSpectate: () => void;
  sendCheer: (emoji: string, username?: string) => void;
  refreshMatches: () => void;
}

export function useSpectatorSocket(initialSpectatingMatchId?: string | null): UseSpectatorSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');
  const [liveMatches, setLiveMatches] = useState<LiveSpectateMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState<LiveSpectateMatch | null>(null);
  const [spectatorCount, setSpectatorCount] = useState<number>(0);
  const [reactions, setReactions] = useState<SpectatorReaction[]>([]);
  const [latency, setLatency] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const activeMatchIdRef = useRef<string | null>(initialSpectatingMatchId || null);
  const pingStartRef = useRef<number>(0);
  const reconnectTimerRef = useRef<any>(null);

  // Initial fetch via REST API to guarantee instant rendering
  const fetchLiveMatchesRest = useCallback(async () => {
    try {
      const res = await fetch('/api/live-matches');
      if (res.ok) {
        const data = await res.json();
        setLiveMatches(data);
        if (activeMatchIdRef.current) {
          const match = data.find((m: LiveSpectateMatch) => m.id === activeMatchIdRef.current);
          if (match) {
            setCurrentMatch(match);
            setSpectatorCount(match.spectatorCount);
          }
        }
      }
    } catch {
      // Offline / initial fallback
    }
  }, []);

  const connect = useCallback(() => {
    try {
      if (socketRef.current) {
        socketRef.current.close();
      }

      setConnectionStatus('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');

        // If a match was requested prior to connect, subscribe immediately
        if (activeMatchIdRef.current) {
          ws.send(JSON.stringify({ type: 'spectate', matchId: activeMatchIdRef.current }));
        }

        // Measure ping
        pingStartRef.current = Date.now();
        ws.send(JSON.stringify({ type: 'ping' }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'init':
              if (msg.matches) {
                setLiveMatches(msg.matches);
              }
              break;

            case 'matches_list':
              if (msg.matches) {
                setLiveMatches(msg.matches);
              }
              break;

            case 'spectate_sync':
              if (msg.match) {
                setCurrentMatch(msg.match);
                setSpectatorCount(msg.match.spectatorCount);
              }
              break;

            case 'match_update':
              if (msg.match && msg.match.id === activeMatchIdRef.current) {
                setCurrentMatch(msg.match);
              }
              // Also update list entry
              if (msg.match) {
                setLiveMatches((prev) =>
                  prev.map((m) => (m.id === msg.match.id ? { ...m, ...msg.match } : m))
                );
              }
              break;

            case 'spectator_count':
              if (msg.matchId === activeMatchIdRef.current) {
                setSpectatorCount(msg.count);
              }
              setLiveMatches((prev) =>
                prev.map((m) => (m.id === msg.matchId ? { ...m, spectatorCount: msg.count } : m))
              );
              break;

            case 'spectator_reaction':
              setReactions((prev) => [
                ...prev.slice(-15),
                {
                  id: msg.id || String(Date.now()),
                  matchId: msg.matchId,
                  emoji: msg.emoji,
                  username: msg.username,
                  timestamp: msg.timestamp || Date.now(),
                },
              ]);
              break;

            case 'pong':
              setLatency(Date.now() - pingStartRef.current);
              break;

            case 'error':
              console.warn('[Spectator WS Warning]:', msg.message);
              break;

            default:
              break;
          }
        } catch {
          // Ignore
        }
      };

      ws.onerror = () => {
        setConnectionStatus('error');
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        // Schedule auto-reconnect
        reconnectTimerRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      setConnectionStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchLiveMatchesRest();
    connect();

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        pingStartRef.current = Date.now();
        socketRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, fetchLiveMatchesRest]);

  // Clean old spectator reactions after 3.5 seconds
  useEffect(() => {
    if (reactions.length === 0) return;
    const timer = setTimeout(() => {
      const cutoff = Date.now() - 3500;
      setReactions((prev) => prev.filter((r) => r.timestamp > cutoff));
    }, 1000);
    return () => clearTimeout(timer);
  }, [reactions]);

  const spectate = useCallback((matchId: string) => {
    activeMatchIdRef.current = matchId;
    // Set immediate cached state if available
    setLiveMatches((prev) => {
      const match = prev.find((m) => m.id === matchId);
      if (match) {
        setCurrentMatch(match);
        setSpectatorCount(match.spectatorCount + 1);
      }
      return prev;
    });

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'spectate', matchId }));
    }
  }, []);

  const leaveSpectate = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && activeMatchIdRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'leave_spectate', matchId: activeMatchIdRef.current }));
    }
    activeMatchIdRef.current = null;
    setCurrentMatch(null);
  }, []);

  const sendCheer = useCallback((emoji: string, username?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN && activeMatchIdRef.current) {
      socketRef.current.send(
        JSON.stringify({
          type: 'spectator_cheer',
          matchId: activeMatchIdRef.current,
          emoji,
          username: username || 'Spectator',
        })
      );
    }
  }, []);

  const refreshMatches = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'get_matches' }));
    } else {
      fetchLiveMatchesRest();
    }
  }, [fetchLiveMatchesRest]);

  return {
    connectionStatus,
    liveMatches,
    currentMatch,
    spectatorCount,
    reactions,
    latency,
    isReadOnly: true, // Guarantees read-only
    spectate,
    leaveSpectate,
    sendCheer,
    refreshMatches,
  };
}
