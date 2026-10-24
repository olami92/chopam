import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { GameMode } from '../types';
import { telegram } from '../services/telegram';
import { useGame } from '../context/GameContext';

interface WinnerShareCardProps {
  playerName: string;
  opponentUsername: string;
  gameMode: GameMode;
  stake: number;
}

const GAME_NAMES: Record<GameMode, string> = {
  whot: 'Whot',
  ludo_classic: 'Classic Ludo',
  ludo_blitz: 'Ludo Blitz',
  draughts: 'Draughts',
  bead16: 'Bead 16',
};

export const WinnerShareCard: React.FC<WinnerShareCardProps> = ({ playerName, opponentUsername, gameMode, stake }) => {
  const { createTable } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sharing, setSharing] = useState(false);
  const opponent = opponentUsername.replace(/^@/, '');
  const displayName = GAME_NAMES[gameMode];
  const [challengeUrl, setChallengeUrl] = useState('');
  const shareCaption = `🏆 I just defeated @${opponent} in ${displayName} (1 - 0)! Think you can beat me?`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#081326');
    background.addColorStop(0.55, '#172554');
    background.addColorStop(1, '#3b1c36');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(245, 158, 11, 0.11)';
    ctx.beginPath(); ctx.arc(1030, 40, 270, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.14)';
    ctx.beginPath(); ctx.arc(80, 600, 250, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, width - 68, height - 68);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 24px Outfit, sans-serif';
    ctx.letterSpacing = '5px';
    ctx.fillText('TETE ARENA  /  MATCH WON', 78, 96);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 50px Outfit, sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('🏆  VICTORY', 78, 190);

    ctx.fillStyle = 'rgba(226,232,240,0.75)';
    ctx.font = '600 24px Outfit, sans-serif';
    ctx.fillText(`I just defeated @${opponent} in ${displayName}`, 82, 250, 1030);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 98px Outfit, sans-serif';
    ctx.fillText('1', 82, 390);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '700 72px Outfit, sans-serif';
    ctx.fillText('—', 180, 388);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '900 98px Outfit, sans-serif';
    ctx.fillText('0', 300, 390);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.fillText('MATCH RESULT', 84, 435);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 31px Outfit, sans-serif';
    ctx.fillText('Think you can beat me?', 82, 510);
    ctx.fillStyle = '#fbbf24';
    ctx.font = '800 22px Outfit, sans-serif';
    ctx.fillText('⚔  CHALLENGE ME NOW', 82, 560);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(226,232,240,0.72)';
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.fillText(`@${playerName.replace(/^@/, '')}`, width - 78, 560);
    ctx.textAlign = 'left';
  }, [opponent, displayName, playerName]);

  const getCardFile = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const dataUrl = canvas.toDataURL('image/png');
    const binary = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const fileName = `tete-arena-${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-win.png`;
    return new File([bytes], fileName, { type: 'image/png' });
  };

  const ensureChallengeRoom = () => {
    if (challengeUrl) return challengeUrl;
    const roomCode = createTable(gameMode, stake);
    const link = telegram.getMatchDeepLink(roomCode);
    setChallengeUrl(link);
    return link;
  };

  const downloadCard = () => {
    const file = getCardFile();
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = file.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const shareCard = async () => {
    setSharing(true);
    const roomLink = ensureChallengeRoom();
    try {
      const file = getCardFile();
      if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Tete Arena Match Victory', text: `${shareCaption}\n\n⚔️ Challenge Me Now: ${roomLink}` });
        return;
      }
      telegram.shareWinnerCard(shareCaption, roomLink);
      downloadCard();
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        telegram.shareWinnerCard(shareCaption, roomLink);
        downloadCard();
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-amber-300/20 bg-slate-950/70 p-3 space-y-2.5">
      <canvas ref={canvasRef} width={1200} height={630} aria-label={`Victory card: ${shareCaption}`} className="w-full aspect-[1200/630] rounded-xl border border-white/10 object-contain" />
      <div className="flex gap-2">
        <button type="button" onClick={shareCard} disabled={sharing} className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60">
          <Share2 className="w-4 h-4" />{sharing ? 'Preparing…' : 'Share victory card'}
        </button>
        <button type="button" onClick={downloadCard} title="Download winner card" className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10">
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
