import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, ShieldCheck, Headphones, Sparkles, Circle, CheckCheck, ChevronUp, Minus, Minimize2 } from 'lucide-react';
import { useGame } from '../context/GameContext';

interface ChatMessage {
  id: string;
  sender: 'visitor' | 'support';
  text: string;
  timestamp: number;
}

export const LiveChatWidget: React.FC = () => {
  const { isAuthenticated } = useGame();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('skillstake_chat_collapsed') === 'true';
  });
  const [sessionId, setSessionId] = useState<string>('');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Listen for programmatic open_live_chat events (from profile menu or topbar)
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      setIsCollapsed(false);
    };
    window.addEventListener('open_live_chat', handleOpenChat);
    return () => window.removeEventListener('open_live_chat', handleOpenChat);
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('skillstake_chat_collapsed', String(next));
      return next;
    });
  };

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize or restore unique client sessionId
  useEffect(() => {
    let sid = sessionStorage.getItem('skillstake_chat_session_id');
    if (!sid || !/^User_\w+$/.test(sid)) {
      const randomHex = Math.random().toString(36).substring(2, 8);
      sid = `User_${randomHex}`;
      sessionStorage.setItem('skillstake_chat_session_id', sid);
    }
    setSessionId(sid);

    // Initial greeting from support bot
    setMessages([
      {
        id: 'msg_welcome',
        sender: 'support',
        text: '👋 Welcome to Tete Arena Live Support! How can we assist you with deposits, withdrawals, or game rules today?',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  // Connect & maintain WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/livechat`;

      try {
        ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          // Register sessionId with server
          ws?.send(
            JSON.stringify({
              type: 'livechat_init',
              sessionId: sessionId,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chat_message' && data.text) {
              // Ignore visitor echoed messages as they are added locally on send
              if (data.sender === 'visitor') return;

              const newMsg: ChatMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                sender: 'support',
                text: data.text,
                timestamp: data.timestamp || Date.now(),
              };

              setMessages((prev) => [...prev, newMsg]);
              setUnreadCount((c) => c + 1);
            }
          } catch {
            // If raw text string received
            if (typeof event.data === 'string' && event.data.trim()) {
              const newMsg: ChatMessage = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                sender: 'support',
                text: event.data.trim(),
                timestamp: Date.now(),
              };

              setMessages((prev) => [...prev, newMsg]);
              setUnreadCount((c) => c + 1);
            }
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Auto-reconnect after 3 seconds
          reconnectTimeout = setTimeout(connectWS, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
        };
      } catch {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connectWS, 4000);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleToggleOpen = () => {
    setIsOpen((prev) => !prev);
    if (!isOpen) {
      setUnreadCount(0);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const visitorMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'visitor',
      text: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, visitorMsg]);
    if (!textToSend) setInputMessage('');

    // Emit down WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          sessionId: sessionId,
          text: text,
        })
      );
    } else {
      // Fallback HTTP retry if socket disconnected
      fetch('/api/livechat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text }),
      }).catch(() => { });
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-[90vw] max-w-[380px] h-[520px] mb-4 bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-500 p-[1px]">
                    <div className="w-full h-full bg-slate-900 rounded-[11px] flex items-center justify-center">
                      <Headphones className="w-5 h-5 text-amber-400" />
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm text-slate-100">ChopAm Live Help</h3>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>Replies typically within seconds</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">{isConnected ? 'Online' : 'Connecting...'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 bg-slate-800/60 rounded border border-slate-700/50">
                  {sessionId}
                </span>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsCollapsed(true);
                    localStorage.setItem('skillstake_chat_collapsed', 'true');
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Minimize Live Support"
                  title="Minimize to icon"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToggleOpen}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  aria-label="Close Live Support"
                  title="Close Chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
              {messages.map((msg) => {
                const isVisitor = msg.sender === 'visitor';
                return (
                  <div key={msg.id} className={`flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-sm ${isVisitor
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none'
                          : 'bg-slate-800/90 border border-slate-700/50 text-slate-200 rounded-bl-none'
                        }`}
                    >
                      {!isVisitor && (
                        <div className="text-[10px] font-medium text-amber-400 mb-0.5 flex items-center gap-1">
                          <Headphones className="w-3 h-3 text-amber-400" /> Support Desk
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isVisitor && <CheckCheck className="w-3 h-3 text-indigo-400" />}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            {messages.length <= 2 && (
              <div className="px-3 py-1.5 border-t border-slate-800/60 bg-slate-950/40 flex flex-wrap gap-1.5">
                {[
                  '💳 How do NGN deposits work?',
                  '💸 Check my withdrawal status',
                  '🎮 Rules for Whot / Ludo',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-[10px] px-2.5 py-1 bg-slate-800/70 hover:bg-indigo-900/50 hover:border-indigo-500/50 border border-slate-700/60 rounded-full text-slate-300 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type your message..."
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim()}
                className="p-2.5 bg-gradient-to-r from-indigo-500 to-amber-500 hover:from-indigo-400 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all shadow-md flex items-center justify-center"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button / Collapsed Badge (Only shown to non-authenticated visitors to prevent blocking game elements) */}
      {!isOpen && !isAuthenticated && (
        isCollapsed ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="relative flex items-center gap-1.5"
          >
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleToggleOpen}
              className="relative p-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-amber-500 text-slate-950 rounded-full shadow-2xl hover:shadow-indigo-500/30 transition-all flex items-center justify-center cursor-pointer border border-white/20"
              aria-label="Open Live Chat Support"
              title="Open Live Chat Support"
            >
              <Headphones className="w-5 h-5 text-slate-950 fill-slate-950/20" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white font-bold text-[10px] flex items-center justify-center rounded-full border-2 border-slate-950 shadow-md animate-bounce">
                  {unreadCount}
                </span>
              )}
            </motion.button>
            <button
              onClick={toggleCollapse}
              className="p-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full border border-slate-700/80 shadow-md transition-all cursor-pointer"
              title="Expand Support Bar"
              aria-label="Expand Support Bar"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative flex items-center gap-1 bg-gradient-to-r from-indigo-600 via-indigo-500 to-amber-500 text-slate-950 rounded-2xl p-1 shadow-2xl hover:shadow-indigo-500/30 transition-all border border-white/20"
          >
            <button
              onClick={handleToggleOpen}
              className="flex items-center gap-2 px-3 py-2 text-slate-950 font-bold text-xs tracking-wide cursor-pointer"
              aria-label="Open Live Chat Support"
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5 text-slate-950 fill-slate-950/20" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white font-bold text-[10px] flex items-center justify-center rounded-full border-2 border-slate-950 shadow-md">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">Live Chat Support</span>
            </button>
            <button
              onClick={toggleCollapse}
              className="p-1.5 hover:bg-black/15 text-slate-950/80 hover:text-slate-950 rounded-xl transition-colors cursor-pointer"
              title="Collapse Support Bar"
              aria-label="Collapse Support Bar"
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )
      )}
    </div>
  );
};
