import { TelegramUser } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          query_id?: string;
          user?: TelegramUser;
          receiver?: TelegramUser;
          chat?: unknown;
          start_param?: string;
          auth_date?: string;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
      };
    };
  }
}

export class TelegramService {
  private static instance: TelegramService;
  private isTelegramEnv = false;

  private constructor() {
    this.init();
  }

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  private init() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      this.isTelegramEnv = Boolean(tg.initData || tg.initDataUnsafe?.user);
      try {
        tg.ready();
        tg.expand();
        tg.enableClosingConfirmation();
        tg.setHeaderColor?.('#0f172a');
        tg.setBackgroundColor?.('#020617');
      } catch (err) {
        console.warn('Failed to configure Telegram WebApp methods', err);
      }
    }
  }

  public getWebApp() {
    return window.Telegram?.WebApp;
  }

  public isTelegram(): boolean {
    const tg = window.Telegram?.WebApp;
    if (tg && (Boolean(tg.initData) || Boolean(tg.initDataUnsafe?.user) || (tg.platform && tg.platform !== 'unknown'))) {
      return true;
    }
    return this.isTelegramEnv;
  }

  public getInitData(): string {
    return window.Telegram?.WebApp?.initData || '';
  }

  public getUser(): TelegramUser | null {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      return tg.initDataUnsafe.user;
    }
    return null;
  }

  public getStartParam(): string | null {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.start_param) {
      return tg.initDataUnsafe.start_param;
    }
    // Fallback: check standard URL query params
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('startapp') || urlParams.get('start') || urlParams.get('room') || null;
  }

  public getMatchDeepLink(roomId: string): string {
    const botUsername = (import.meta as any).env?.VITE_TELEGRAM_BOT_USERNAME || 'SkillStakeBot';
    return `https://t.me/${botUsername.replace(/^@/, "")}?start=match_${encodeURIComponent(roomId)}`;
  }

  public getReferralDeepLink(referralCode: string): string {
    const botUsername = (import.meta as any).env?.VITE_TELEGRAM_BOT_USERNAME || 'SkillStakeBot';
    return `https://t.me/${botUsername.replace(/^@/, "")}?start=ref_${encodeURIComponent(referralCode)}`;
  }

  public shareWinnerCard(text: string, challengeUrl: string): void {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(challengeUrl)}&text=${encodeURIComponent(`${text}\n\n⚔️ Challenge Me Now`)}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank', 'noopener,noreferrer');
  }

  public triggerHaptic(
    type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'
  ) {
    const tg = window.Telegram?.WebApp;
    if (tg?.HapticFeedback) {
      try {
        if (type === 'selection') {
          tg.HapticFeedback.selectionChanged();
        } else if (type === 'success' || type === 'warning' || type === 'error') {
          tg.HapticFeedback.notificationOccurred(type);
        } else {
          tg.HapticFeedback.impactOccurred(type);
        }
      } catch {
        // Ignore haptic errors on unsupported web views
      }
    } else if (navigator.vibrate) {
      // Browser vibration API fallback
      if (type === 'heavy' || type === 'error') {
        navigator.vibrate([30, 40, 30]);
      } else if (type === 'success') {
        navigator.vibrate([20, 60, 20]);
      } else {
        navigator.vibrate(15);
      }
    }
  }

  public shareInvite(roomId: string, gameModeName: string, stake: number) {
    const botUsername = 'SkillStakeBot';
    const deepLink = this.getMatchDeepLink(roomId);
    const text = encodeURIComponent(
      `Join my private staking table on SkillStake!\n🎮 Game: ${gameModeName}\n💰 Stake: ₦${stake.toLocaleString()}\nRoom Code: ${roomId}`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${text}`;

    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
    } else {
      // Fallback in regular browser: open telegram share link or copy to clipboard
      window.open(shareUrl, '_blank');
    }
  }
}

export const telegram = TelegramService.getInstance();
