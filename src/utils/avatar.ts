/**
 * Dynamic Non-Human Cyber Bot Avatar Generator for SkillStake
 * Generates futuristic cyber bot / robot / geometric vector avatars based on username seeds.
 */

// Preset palette combinations for dynamic SVG avatars
const PALETTES = [
  { bg1: '#3b82f6', bg2: '#1d4ed8', accent: '#f59e0b', eye: '#38bdf8' },
  { bg1: '#8b5cf6', bg2: '#6d28d9', accent: '#10b981', eye: '#a78bfa' },
  { bg1: '#ec4899', bg2: '#be185d', accent: '#3b82f6', eye: '#f472b6' },
  { bg1: '#10b981', bg2: '#047857', accent: '#f59e0b', eye: '#34d399' },
  { bg1: '#f59e0b', bg2: '#b45309', accent: '#6366f1', eye: '#fbbf24' },
  { bg1: '#06b6d4', bg2: '#0e7490', accent: '#ec4899', eye: '#22d3ee' },
];

/**
 * Returns a high-res DiceBear Cyber Bot SVG avatar URL based on username seed
 */
export function getDynamicAvatarUrl(seed: string = 'player'): string {
  const clean = String(seed || 'player').trim().toLowerCase().replace(/^@/, '') || 'staker';
  // DiceBear 7.x bottts (Cybernetic Robot non-human avatars)
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(clean)}&backgroundColor=0f172a,1e1b4b,090d16,020617&radius=16`;
}

/**
 * Enforces dynamic cyber bot avatar URL across all users and components.
 * If input is missing, empty, invalid, or contains legacy unsplash/placeholder URLs,
 * it automatically converts it into a seed-based dynamic avatar.
 */
export function ensureDynamicAvatarUrl(avatarUrl?: string | null, seed: string = 'player'): string {
  if (
    !avatarUrl ||
    typeof avatarUrl !== 'string' ||
    avatarUrl.trim() === '' ||
    avatarUrl.includes('unsplash.com') ||
    avatarUrl.includes('placeholder')
  ) {
    return getDynamicAvatarUrl(seed);
  }
  return avatarUrl;
}

/**
 * Returns an instant inline SVG Data URL for non-human avatars (Zero network dependency fallback)
 */
export function getInlineAvatarSvg(seed: string = 'player'): string {
  const clean = String(seed || 'player').trim().toLowerCase().replace(/^@/, '') || 'staker';
  
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }

  const palette = PALETTES[Math.abs(hash) % PALETTES.length];
  const botType = Math.abs(hash >> 2) % 3;

  // Render Futuristic Cyber Bot Emblem
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette.bg1}" />
        <stop offset="100%" stop-color="${palette.bg2}" />
      </linearGradient>
      <linearGradient id="visor" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${palette.accent}" />
        <stop offset="100%" stop-color="${palette.eye}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="28" fill="url(#bg)" />
    <circle cx="60" cy="60" r="50" fill="#090d16" fill-opacity="0.3" />
    
    <!-- Bot Antenna & Head -->
    <rect x="56" y="22" width="8" height="14" rx="4" fill="${palette.accent}" />
    <circle cx="60" cy="18" r="6" fill="${palette.eye}" />
    <rect x="30" y="36" width="60" height="52" rx="16" fill="#0f172a" stroke="${palette.accent}" stroke-width="3" />
    
    <!-- Visor / Eyes -->
    ${botType === 0 ? `
      <rect x="40" y="48" width="40" height="16" rx="8" fill="url(#visor)" />
      <circle cx="48" cy="56" r="3" fill="#ffffff" />
      <circle cx="72" cy="56" r="3" fill="#ffffff" />
    ` : botType === 1 ? `
      <circle cx="46" cy="54" r="9" fill="url(#visor)" />
      <circle cx="74" cy="54" r="9" fill="url(#visor)" />
      <circle cx="46" cy="54" r="3" fill="#ffffff" />
      <circle cx="74" cy="54" r="3" fill="#ffffff" />
    ` : `
      <polygon points="60,44 78,58 42,58" fill="url(#visor)" />
      <circle cx="60" cy="54" r="4" fill="#ffffff" />
    `}

    <!-- Mouth / Grille -->
    <rect x="46" y="72" width="28" height="6" rx="3" fill="${palette.accent}" fill-opacity="0.8" />
    <line x1="53" y1="72" x2="53" y2="78" stroke="#0f172a" stroke-width="1.5" />
    <line x1="60" y1="72" x2="60" y2="78" stroke="#0f172a" stroke-width="1.5" />
    <line x1="67" y1="72" x2="67" y2="78" stroke="#0f172a" stroke-width="1.5" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
