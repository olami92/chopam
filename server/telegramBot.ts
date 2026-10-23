import 'dotenv/config';
import dotenv from 'dotenv';
import { liveChatService } from './liveChat';

export interface TelegramWithdrawalData {
  id: string;
  userId: string;
  username: string;
  amountNgn: number;
  amountUsdt: number;
  currency: string;
  method: string;
  destinationAddress: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  requestedAt: string;
  adminNotes?: string;
}

export interface TelegramFiatDepositData {
  id: string;
  userId: string;
  username: string;
  amountNgn: number;
  referenceNo: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: 'pending' | 'confirmed' | 'rejected';
  requestedAt: string;
}

class TelegramBotListenerService {
  private botToken: string = process.env.TELEGRAM_BOT_TOKEN || '';
  private adminChatId: string = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
  private isListening: boolean = false;
  private lastUpdateId: number = 0;
  private onDisburseHandler: ((withdrawalId: string) => Promise<TelegramWithdrawalData | null | undefined> | TelegramWithdrawalData | null | undefined) | null = null;
  private onConfirmDepositHandler: ((depositId: string) => Promise<TelegramFiatDepositData | null | undefined> | TelegramFiatDepositData | null | undefined) | null = null;
  private onRejectDepositHandler: ((depositId: string) => Promise<TelegramFiatDepositData | null | undefined> | TelegramFiatDepositData | null | undefined) | null = null;

  constructor() {
    this.reloadConfig();
  }

  public reloadConfig() {
    this.botToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/['"]/g, '');
    this.adminChatId = (process.env.TELEGRAM_ADMIN_CHAT_ID || '').trim().replace(/['"]/g, '');
  }

  public setDisburseHandler(handler: (withdrawalId: string) => Promise<TelegramWithdrawalData | null | undefined> | TelegramWithdrawalData | null | undefined) {
    this.onDisburseHandler = handler;
  }

  public setConfirmDepositHandler(handler: (depositId: string) => Promise<TelegramFiatDepositData | null | undefined> | TelegramFiatDepositData | null | undefined) {
    this.onConfirmDepositHandler = handler;
  }

  public setRejectDepositHandler(handler: (depositId: string) => Promise<TelegramFiatDepositData | null | undefined> | TelegramFiatDepositData | null | undefined) {
    this.onRejectDepositHandler = handler;
  }

  /**
   * Send a formatted Telegram alert when a new NGN Fiat deposit request is submitted by user
   */
  public async sendFiatDepositAlert(deposit: TelegramFiatDepositData): Promise<boolean> {
    this.reloadConfig();
    if (!this.botToken || !this.adminChatId) {
      console.log('[Telegram Bot] Deposit alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured in .env');
      return false;
    }

    const messageText = this.buildDepositAlertMessageHtml(deposit);
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.adminChatId,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Confirm & Credit User',
                  callback_data: `confirm_deposit:${deposit.id}`,
                },
                {
                  text: '❌ Reject',
                  callback_data: `reject_deposit:${deposit.id}`,
                },
              ],
            ],
          },
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('[Telegram Bot] sendFiatDepositAlert error:', data);
        return false;
      }

      console.log(`[Telegram Bot] Sent Fiat NGN Deposit alert (${deposit.referenceNo}) to admin (Chat ID: ${this.adminChatId})`);
      return true;
    } catch (err) {
      console.error('[Telegram Bot] Failed to send deposit alert:', err);
      return false;
    }
  }

  /**
   * Send a formatted Telegram alert when a new withdrawal is requested
   */
  public async sendWithdrawalAlert(withdrawal: TelegramWithdrawalData): Promise<boolean> {
    this.reloadConfig();
    if (!this.botToken || !this.adminChatId) {
      console.log('[Telegram Bot] Alert skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured in .env');
      return false;
    }

    const messageText = this.buildAlertMessageHtml(withdrawal);
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.adminChatId,
          text: messageText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Mark as Disbursed',
                  callback_data: `disburse:${withdrawal.id}`,
                },
              ],
            ],
          },
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        console.error('[Telegram Bot] sendMessage error:', data);
        if (data.description === 'Bad Request: chat not found' || data.error_code === 400) {
          console.warn('[Telegram Bot] 💡 TIP: Make sure you have opened Telegram, searched for your bot, and clicked "/start". Also verify TELEGRAM_ADMIN_CHAT_ID in .env matches your numeric Telegram Chat ID.');
        }
        return false;
      }

      console.log(`[Telegram Bot] Sent withdrawal alert to admin (Chat ID: ${this.adminChatId})`);
      return true;
    } catch (err) {
      console.error('[Telegram Bot] Failed to send alert:', err);
      return false;
    }
  }

  /**
   * Start long-polling for inline button clicks (callback queries)
   */
  public async handleStartCommand(message: any): Promise<boolean> {
    this.reloadConfig();
    const text = String(message?.text || '').trim();
    const match = text.match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);
    if (!match) return false;
    const payload = String(match[1] || '');
    const roomCode = /^match_[A-Za-z0-9_-]{1,40}$/i.test(payload) ? payload.slice(6) : '';
    const chatId = message?.chat?.id;
    if (!this.botToken || !chatId) return true;

    const miniAppUrl = (process.env.TELEGRAM_MINI_APP_URL || '').trim();
    let openUrl = '';
    let useWebAppButton = false;
    if (roomCode && miniAppUrl) {
      try {
        const url = new URL(miniAppUrl);
        url.searchParams.set('startapp', 'match_' + roomCode);
        openUrl = url.toString();
        useWebAppButton = true;
      } catch {
        console.warn('[Telegram Bot] TELEGRAM_MINI_APP_URL must be a valid URL.');
      }
    }
    if (!openUrl && roomCode) {
      const username = (process.env.TELEGRAM_BOT_USERNAME || 'SkillStakeBot').replace(/^@/, '');
      openUrl = 'https://t.me/' + username + '?startapp=match_' + encodeURIComponent(roomCode);
    }

    const messageText = roomCode
      ? '🎮 Your SkillStake match is ready. Tap below to open it.'
      : 'Welcome to SkillStake! Open a match invite to join a game.';
    const body: any = { chat_id: chatId, text: messageText };
    if (openUrl) {
      body.reply_markup = {
        inline_keyboard: [[useWebAppButton ? { text: '⚔️ Open Match', web_app: { url: openUrl } } : { text: '⚔️ Open Match', url: openUrl }]],
      };
    }

    try {
      const response = await fetch('https://api.telegram.org/bot' + this.botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!result.ok) console.warn('[Telegram Bot] Could not answer /start:', result.description);
    } catch (error) {
      console.error('[Telegram Bot] Failed to answer /start:', error);
    }
    return true;
  }

  public async sendMatchTurnNotification(chatId: string | number, gameMode: string, roomCode: string): Promise<boolean> {
    this.reloadConfig();
    if (!this.botToken || !chatId) return false;

    const names: Record<string, string> = {
      whot: 'Whot',
      ludo_classic: 'Classic Ludo',
      ludo_blitz: 'Ludo Blitz',
      draughts: 'Draughts',
      bead16: 'Bead 16',
    };
    const title = names[String(gameMode || '').toLowerCase()] || 'your match';
    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || 'SkillStakeBot').replace(/^@/, '');
    const openUrl = 'https://t.me/' + botUsername + '?start=match_' + encodeURIComponent(roomCode);
    try {
      const response = await fetch('https://api.telegram.org/bot' + this.botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚡ It\'s your turn in ' + title + '!',
          reply_markup: {
            inline_keyboard: [[{ text: 'Open Match', url: openUrl }]],
          },
        }),
      });
      const result = await response.json();
      if (!result.ok) {
        console.warn('[Telegram Bot] Turn notification was not delivered:', result.description);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Telegram Bot] Failed to send turn notification:', error);
      return false;
    }
  }
  public async startListening() {
    this.reloadConfig();
    if (!this.botToken) {
      console.log('[Telegram Bot] Polling disabled: TELEGRAM_BOT_TOKEN missing in .env');
      return;
    }

    if (this.isListening) return;
    this.isListening = true;

    // Clear active webhooks if any to ensure clean long-polling without 409 Conflict
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`);
    } catch {
      // ignore
    }

    console.log('[Telegram Bot] Started long-polling listener for admin actions...');

    this.pollUpdates();
  }

  private async pollUpdates() {
    while (this.isListening) {
      this.reloadConfig();
      if (!this.botToken) {
        await this.sleep(10000);
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=20`;
        const res = await fetch(url);
        
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              if (update.callback_query) {
                await this.handleCallbackQuery(update.callback_query);
              }
              if (update.message) {
                const handledStart = await this.handleStartCommand(update.message);
                if (!handledStart) await liveChatService.handleInboundTelegramMessage(update.message);
              }
            }
          }
        }
      } catch (err) {
        // Quietly catch network timeout glitches before next poll iteration
      }

      await this.sleep(2000);
    }
  }

  private async handleCallbackQuery(callbackQuery: any) {
    const callbackId = callbackQuery.id;
    const data: string = callbackQuery.data || '';
    const message = callbackQuery.message;

    if (data.startsWith('disburse:')) {
      const withdrawalId = data.replace('disburse:', '');
      console.log(`[Telegram Bot] Received disburse action for withdrawal ID: ${withdrawalId}`);

      let updatedRecord: TelegramWithdrawalData | null | undefined = null;
      if (this.onDisburseHandler) {
        updatedRecord = await this.onDisburseHandler(withdrawalId);
      }

      // Answer Telegram UI callback popup alert
      await this.answerCallbackQuery(callbackId, `Withdrawal #${withdrawalId} marked as DISBURSED!`);

      // Edit original message to display DISBURSED status and remove button
      if (message && message.chat && message.message_id && updatedRecord) {
        await this.editMessageToDisbursed(message.chat.id, message.message_id, updatedRecord);
      }
    } else if (data.startsWith('confirm_deposit:')) {
      const depositId = data.replace('confirm_deposit:', '');
      console.log(`[Telegram Bot] Received confirm_deposit action for deposit ID: ${depositId}`);

      let updatedRecord: TelegramFiatDepositData | null | undefined = null;
      if (this.onConfirmDepositHandler) {
        updatedRecord = await this.onConfirmDepositHandler(depositId);
      }

      await this.answerCallbackQuery(
        callbackId,
        updatedRecord
          ? `Deposit #${updatedRecord.referenceNo} CONFIRMED! ₦${updatedRecord.amountNgn.toLocaleString()} credited to @${updatedRecord.username}.`
          : `Deposit #${depositId} confirmed!`
      );

      if (message && message.chat && message.message_id && updatedRecord) {
        await this.editMessageToDepositConfirmed(message.chat.id, message.message_id, updatedRecord);
      }
    } else if (data.startsWith('reject_deposit:')) {
      const depositId = data.replace('reject_deposit:', '');
      console.log(`[Telegram Bot] Received reject_deposit action for deposit ID: ${depositId}`);

      let updatedRecord: TelegramFiatDepositData | null | undefined = null;
      if (this.onRejectDepositHandler) {
        updatedRecord = await this.onRejectDepositHandler(depositId);
      }

      await this.answerCallbackQuery(callbackId, `Deposit #${depositId} REJECTED.`);

      if (message && message.chat && message.message_id && updatedRecord) {
        await this.editMessageToDepositRejected(message.chat.id, message.message_id, updatedRecord);
      }
    } else if (data.startsWith('reply_prompt:')) {
      const targetSession = data.replace('reply_prompt:', '');
      await this.answerCallbackQuery(
        callbackId,
        `💡 To reply to [${targetSession}]: Swipe right on this message or tap 'Fast Reply' to pre-fill!`
      );
    }
  }

  private async answerCallbackQuery(callbackQueryId: string, text: string) {
    try {
      const url = `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text,
          show_alert: true,
        }),
      });
    } catch {
      // ignore network errors
    }
  }

  private async editMessageToDisbursed(chatId: string | number, messageId: number, withdrawal: TelegramWithdrawalData) {
    try {
      const updatedText = this.buildDisbursedMessageHtml(withdrawal);
      const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ DISBURSED',
                  callback_data: `already_disbursed`,
                },
              ],
            ],
          },
        }),
      });
    } catch (err) {
      console.error('[Telegram Bot] Failed to update Telegram message:', err);
    }
  }

  private async editMessageToDepositConfirmed(chatId: string | number, messageId: number, deposit: TelegramFiatDepositData) {
    try {
      const updatedText =
        `<b>✅ FIAT DEPOSIT CONFIRMED & CREDITED</b>\n\n` +
        `<b>User:</b> @${this.escapeHtml(deposit.username)}\n` +
        `<b>Amount Credited:</b> ₦${deposit.amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
        `<b>Transaction Ref:</b> <code>${this.escapeHtml(deposit.referenceNo)}</code>\n` +
        `<b>Bank Paid To:</b> ${this.escapeHtml(deposit.bankName)} (${this.escapeHtml(deposit.accountNumber)})\n` +
        `<b>Request ID:</b> <code>${deposit.id}</code>\n` +
        `<b>Status:</b> ✅ <b>CONFIRMED & AUTO-CREDITED TO DASHBOARD</b>\n` +
        `<b>Processed At:</b> ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`;

      const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ CONFIRMED & CREDITED',
                  callback_data: `already_confirmed`,
                },
              ],
            ],
          },
        }),
      });
    } catch (err) {
      console.error('[Telegram Bot] Failed to edit deposit message:', err);
    }
  }

  private async editMessageToDepositRejected(chatId: string | number, messageId: number, deposit: TelegramFiatDepositData) {
    try {
      const updatedText =
        `<b>❌ FIAT DEPOSIT REJECTED</b>\n\n` +
        `<b>User:</b> @${this.escapeHtml(deposit.username)}\n` +
        `<b>Amount:</b> ₦${deposit.amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
        `<b>Transaction Ref:</b> <code>${this.escapeHtml(deposit.referenceNo)}</code>\n` +
        `<b>Request ID:</b> <code>${deposit.id}</code>\n` +
        `<b>Status:</b> ❌ <b>REJECTED BY ADMIN</b>\n` +
        `<b>Processed At:</b> ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`;

      const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;

      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '❌ REJECTED',
                  callback_data: `already_rejected`,
                },
              ],
            ],
          },
        }),
      });
    } catch (err) {
      console.error('[Telegram Bot] Failed to edit deposit message:', err);
    }
  }

  private buildDepositAlertMessageHtml(d: TelegramFiatDepositData): string {
    return (
      `<b>🇳🇬 NEW FIAT (NAIRA) DEPOSIT PAYMENT</b>\n\n` +
      `<b>User:</b> @${this.escapeHtml(d.username)}\n` +
      `<b>Amount Paid:</b> ₦${d.amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
      `<b>Transaction Reference:</b> <code>${this.escapeHtml(d.referenceNo)}</code>\n` +
      `<b>Bank Details:</b> ${this.escapeHtml(d.bankName)} | <code>${this.escapeHtml(d.accountNumber)}</code> | ${this.escapeHtml(d.accountName)}\n` +
      `<b>Request ID:</b> <code>${d.id}</code>\n` +
      `<b>Requested At:</b> ${this.escapeHtml(d.requestedAt)}\n` +
      `<b>Status:</b> ⏳ <i>PENDING PAYMENT CONFIRMATION</i>\n\n` +
      `<i>Please verify payment in your bank app narration for reference <code>${this.escapeHtml(d.referenceNo)}</code> before clicking Confirm below.</i>`
    );
  }

  private buildAlertMessageHtml(w: TelegramWithdrawalData): string {
    const bankDetailsSection = w.bankName
      ? `<b>Bank Name:</b> ${this.escapeHtml(w.bankName)}\n` +
        `<b>Account Number:</b> <code>${this.escapeHtml(w.accountNumber || '')}</code>\n` +
        `<b>Account Name:</b> ${this.escapeHtml(w.accountName || '')}\n`
      : `<b>Destination:</b> <code>${this.escapeHtml(w.destinationAddress)}</code>\n`;

    return (
      `<b>💸 NEW NGN BANK WITHDRAWAL REQUEST</b>\n\n` +
      `<b>User:</b> @${this.escapeHtml(w.username)}\n` +
      `<b>Amount:</b> ₦${w.amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
      bankDetailsSection +
      `<b>Request ID:</b> <code>${w.id}</code>\n` +
      `<b>Requested At:</b> ${this.escapeHtml(w.requestedAt)}\n` +
      `<b>Status:</b> ⏳ <i>PENDING DISBURSEMENT</i>`
    );
  }

  private buildDisbursedMessageHtml(w: TelegramWithdrawalData): string {
    const bankDetailsSection = w.bankName
      ? `<b>Bank Name:</b> ${this.escapeHtml(w.bankName)}\n` +
        `<b>Account Number:</b> <code>${this.escapeHtml(w.accountNumber || '')}</code>\n` +
        `<b>Account Name:</b> ${this.escapeHtml(w.accountName || '')}\n`
      : `<b>Destination:</b> <code>${this.escapeHtml(w.destinationAddress)}</code>\n`;

    return (
      `<b>✅ WITHDRAWAL DISBURSED TO BANK</b>\n\n` +
      `<b>User:</b> @${this.escapeHtml(w.username)}\n` +
      `<b>Amount:</b> ₦${w.amountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n` +
      bankDetailsSection +
      `<b>Request ID:</b> <code>${w.id}</code>\n` +
      `<b>Status:</b> ✅ <b>DISBURSED</b>\n` +
      `<b>Processed At:</b> ${new Date().toISOString().replace('T', ' ').substring(0, 16)}`
    );
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const telegramBotListener = new TelegramBotListenerService();

