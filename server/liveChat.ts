import 'dotenv/config';
import type { WebSocket } from 'ws';

/**
 * LiveChatService according to telegrambot.md protocol specifications:
 * - ADMIN_TELEGRAM_CHAT_ID: static destination chat ID for routing outbound web visitor inquiries.
 * - SESSION_MAP: internal state map linking random client strings (e.g. "User_7b2a9x") to active WebSocket handles.
 * - THREAD_MAP: map linking Telegram message_id (number) -> sessionId (string)
 */
class LiveChatService {
  private botToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  private adminChatId: string = process.env.TELEGRAM_ADMIN_CHAT_ID || '';

  // sessionId -> Set of active WebSocket handles
  private sessionMap: Map<string, Set<WebSocket>> = new Map();
  // WebSocket handle -> sessionId
  private socketToSessionMap: Map<WebSocket, string> = new Map();
  // Telegram message_id -> sessionId
  private threadMap: Map<number, string> = new Map();
  // Last active visitor sessionId for single-session fallback routing
  private lastActiveSessionId: string | null = null;

  constructor() {
    this.reloadConfig();
  }

  public reloadConfig() {
    this.botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/['"]/g, '');
    this.adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim().replace(/['"]/g, '');
  }

  public generateSessionId(): string {
    const randomHex = Math.random().toString(36).substring(2, 8);
    return `User_${randomHex}`;
  }

  public registerSession(sessionId: string, ws: WebSocket) {
    if (!this.sessionMap.has(sessionId)) {
      this.sessionMap.set(sessionId, new Set());
    }
    this.sessionMap.get(sessionId)!.add(ws);
    this.socketToSessionMap.set(ws, sessionId);
    this.lastActiveSessionId = sessionId;
    console.log(`[LiveChat] Registered socket for sessionId: ${sessionId} (Active sockets for session: ${this.sessionMap.get(sessionId)!.size})`);
  }

  public unregisterSocket(ws: WebSocket) {
    const sessionId = this.socketToSessionMap.get(ws);
    if (sessionId) {
      this.socketToSessionMap.delete(ws);
      const set = this.sessionMap.get(sessionId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.sessionMap.delete(sessionId);
        }
      }
      console.log(`[LiveChat] Unregistered socket for sessionId: ${sessionId}`);
    }
  }

  public getSessionIdForSocket(ws: WebSocket): string | undefined {
    return this.socketToSessionMap.get(ws);
  }

  /**
   * Protocol 1: Inbound Web Message -> Outbound Telegram Data
   * When a client sends a message through the website WebSocket:
   * 1. Extract or generate distinct sessionId.
   * 2. Format payload: "[{{sessionId}}]\n👤 Visitor: {{original_message_body}}"
   * 3. Send via Telegram Bot API (sendMessage method).
   * 4. Map resulting Telegram message_id to sessionId in state.
   */
  public async handleInboundWebMessage(
    ws: WebSocket,
    requestedSessionId: string | undefined,
    messageBody: string
  ): Promise<{ success: boolean; sessionId: string; messageId?: number }> {
    this.reloadConfig();
    const cleanBody = String(messageBody || '').trim();
    if (!cleanBody) {
      return { success: false, sessionId: '' };
    }

    // 1. Extract or generate distinct sessionId
    let sessionId = requestedSessionId || (ws ? this.socketToSessionMap.get(ws) : undefined);
    if (!sessionId || !/^User_\w+$/.test(sessionId)) {
      sessionId = this.generateSessionId();
    }

    if (ws) {
      this.registerSession(sessionId, ws);
    } else {
      this.lastActiveSessionId = sessionId;
    }

    if (!this.botToken || !this.adminChatId) {
      console.warn('[LiveChat] Telegram bot token or admin chat ID not configured in .env');
      return { success: false, sessionId };
    }

    // 2. Format structured text payload exactly as specified in Protocol 1
    const outboundMessage = `[${sessionId}]\n👤 Visitor: ${cleanBody}`;

    // 3. Send to admin chat using Telegram Bot API (sendMessage)
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.adminChatId,
          text: outboundMessage,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: `💬 Fast Reply to ${sessionId}`,
                  switch_inline_query_current_chat: `[${sessionId}] `,
                },
                {
                  text: `ℹ️ How to Reply`,
                  callback_data: `reply_prompt:${sessionId}`,
                },
              ],
            ],
          },
        }),
      });

      const data = await res.json();
      if (data && data.ok && data.result && data.result.message_id) {
        const messageId = Number(data.result.message_id);

        // 4. Map resulting Telegram message_id directly to sessionId in state to handle contextual threading
        this.threadMap.set(messageId, sessionId);
        console.log(`[LiveChat] Web message from [${sessionId}] sent to Telegram Admin (Chat ID: ${this.adminChatId}, Telegram msg_id: ${messageId})`);
        return { success: true, sessionId, messageId };
      } else {
        console.error('[LiveChat] Telegram sendMessage error:', data);
        return { success: false, sessionId };
      }
    } catch (err) {
      console.error('[LiveChat] Error posting web message to Telegram:', err);
      return { success: false, sessionId };
    }
  }

  /**
   * Protocol 2: Inbound Telegram Message -> Outbound Web Event
   * When a message event arrives via Telegram Bot Webhook or Polling:
   * 1. Verify chat.id strictly matches authorized ADMIN_TELEGRAM_CHAT_ID. Discard if unauthorized.
   * 2. Check if incoming payload contains reply_to_message object:
   *    - IF TRUE: Lookup reply_to_message.message_id within active thread mapping state to find sessionId.
   *    - IF FALSE: Use regular expression pattern /^\[(User_\w+)\]/ to extract sessionId directly from beginning text wrapper of manual entry.
   * 3. Once target sessionId is resolved, isolate clean response text (stripping away manual routing headers).
   * 4. Emit plain text socket string or clean JSON frame directly down specific socket pipe tied to active sessionId.
   */
  public async handleInboundTelegramMessage(telegramMessage: any): Promise<{ success: boolean; sessionId?: string; text?: string }> {
    this.reloadConfig();
    if (!telegramMessage || !telegramMessage.chat) {
      return { success: false };
    }

    // Ignore bot's own automated messages
    if (telegramMessage.from && telegramMessage.from.is_bot) {
      return { success: false };
    }

    const incomingChatId = String(telegramMessage.chat.id).trim();
    const authorizedChatId = String(this.adminChatId).trim();

    // 1. Verify chat.id strictly matches authorized ADMIN_TELEGRAM_CHAT_ID. Discard if unauthorized.
    if (!authorizedChatId || incomingChatId !== authorizedChatId) {
      console.warn(`[LiveChat Discard] Mismatched Telegram chat_id: "${incomingChatId}" (Expected: "${authorizedChatId}")`);
      return { success: false };
    }

    const rawText = String(telegramMessage.text || '').trim();
    if (!rawText) {
      return { success: false };
    }

    let targetSessionId: string | undefined = undefined;

    // 2. Check if payload contains reply_to_message object
    if (telegramMessage.reply_to_message) {
      const replyMsgId = Number(telegramMessage.reply_to_message.message_id);
      if (replyMsgId) {
        targetSessionId = this.threadMap.get(replyMsgId);
      }

      // Fallback A: search for (User_\w+) inside replied message text/caption if threadMap was reset by server restart
      const repliedText = String(telegramMessage.reply_to_message.text || telegramMessage.reply_to_message.caption || '');
      if (!targetSessionId && repliedText) {
        const matchReplied = repliedText.match(/(User_\w+)/);
        if (matchReplied) {
          targetSessionId = matchReplied[1];
        }
      }
    }

    // IF FALSE (or targetSessionId not resolved via reply_to_message):
    if (!targetSessionId) {
      const regexMatch = rawText.match(/(User_\w+)/);
      if (regexMatch) {
        targetSessionId = regexMatch[1];
      }
    }

    // Fallback B: Route to last active session or sole active session if admin typed direct response without tags/reply
    if (!targetSessionId) {
      if (this.lastActiveSessionId && this.sessionMap.has(this.lastActiveSessionId)) {
        targetSessionId = this.lastActiveSessionId;
        console.log(`[LiveChat Fallback] Resolved sessionId [${targetSessionId}] from last active visitor session.`);
      } else if (this.sessionMap.size === 1) {
        targetSessionId = Array.from(this.sessionMap.keys())[0];
        console.log(`[LiveChat Fallback] Resolved sessionId [${targetSessionId}] from sole active web session.`);
      }
    }

    if (!targetSessionId) {
      console.warn('[LiveChat] Could not resolve sessionId from Telegram message.');
      return { success: false };
    }

    // 3. Once target sessionId is resolved, isolate clean response text (stripping away manual routing headers)
    let cleanText = rawText;
    cleanText = cleanText.replace(/^\[User_\w+\]\s*/, '').trim();

    // 4. Emit plain text socket string or clean JSON frame directly down specific socket pipe tied to active sessionId
    const targetSockets = this.sessionMap.get(targetSessionId);
    let sentCount = 0;

    if (targetSockets && targetSockets.size > 0) {
      const payload = JSON.stringify({
        type: 'chat_message',
        sessionId: targetSessionId,
        text: cleanText,
        sender: 'support',
        timestamp: Date.now(),
      });

      for (const ws of targetSockets) {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
          ws.send(payload);
          sentCount++;
        }
      }
    }

    if (sentCount > 0) {
      console.log(`[LiveChat SUCCESS] Relayed admin Telegram reply to ${sentCount} open WebSocket connection(s) for [${targetSessionId}]: "${cleanText}"`);
      return { success: true, sessionId: targetSessionId, text: cleanText };
    } else {
      console.warn(`[LiveChat Offline] Target client [${targetSessionId}] currently has no active open WebSocket connections.`);
      return { success: false, sessionId: targetSessionId, text: cleanText };
    }
  }
}

export const liveChatService = new LiveChatService();
