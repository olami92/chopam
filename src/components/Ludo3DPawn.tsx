import React from 'react';

interface Ludo3DPawnProps {
  color: 'red' | 'yellow' | 'green' | 'blue';
  isPlayable?: boolean;
  isSelected?: boolean;
  sizeClassName?: string;
  onClick?: () => void;
}

export const Ludo3DPawn: React.FC<Ludo3DPawnProps> = ({
  color,
  isPlayable = false,
  isSelected = false,
  sizeClassName = 'w-5 h-6 sm:w-6 sm:h-7',
  onClick,
}) => {
  const colorGradients = {
    red: {
      top: '#f87171',
      body: '#ef4444',
      dark: '#991b1b',
      ring: '#fca5a5',
    },
    yellow: {
      top: '#fef08a',
      body: '#f59e0b',
      dark: '#b45309',
      ring: '#fef08a',
    },
    green: {
      top: '#86efac',
      body: '#10b981',
      dark: '#065f46',
      ring: '#a7f3d0',
    },
    blue: {
      top: '#93c5fd',
      body: '#3b82f6',
      dark: '#1e3a8a',
      ring: '#bfdbfe',
    },
  };

  const g = colorGradients[color];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick || !isPlayable}
      className={`relative flex items-center justify-center ${sizeClassName} transition-all duration-200 ${
        isPlayable
          ? 'cursor-pointer hover:scale-125 animate-bounce z-30 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]'
          : 'cursor-default'
      } ${isSelected ? 'scale-125 ring-2 ring-white rounded-full' : ''}`}
    >
      <svg viewBox="0 0 40 48" className="w-full h-full overflow-visible drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
        <defs>
          <radialGradient id={`pawn-head-${color}`} cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor={g.top} />
            <stop offset="60%" stopColor={g.body} />
            <stop offset="100%" stopColor={g.dark} />
          </radialGradient>
          <linearGradient id={`pawn-body-${color}`} x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor={g.top} />
            <stop offset="45%" stopColor={g.body} />
            <stop offset="100%" stopColor={g.dark} />
          </linearGradient>
        </defs>
        {/* Base Drop Shadow */}
        <ellipse cx="20" cy="44" rx="14" ry="4" fill="rgba(0,0,0,0.4)" />
        {/* Flared Base Rim */}
        <ellipse cx="20" cy="41" rx="14" ry="4" fill={g.dark} />
        <ellipse cx="20" cy="40" rx="13" ry="3.5" fill={`url(#pawn-body-${color})`} />
        {/* Conical Body */}
        <path d="M 8 40 Q 14 25 15 20 L 25 20 Q 26 25 32 40 Z" fill={`url(#pawn-body-${color})`} />
        {/* Neck Ring Collar */}
        <ellipse cx="20" cy="20" rx="7.5" ry="2.5" fill={g.ring} />
        {/* Round Head Bulb */}
        <circle cx="20" cy="13" r="9" fill={`url(#pawn-head-${color})`} />
        {/* Glossy Specular Highlight Spot */}
        <ellipse cx="17" cy="10" rx="3" ry="1.8" fill="rgba(255,255,255,0.75)" transform="rotate(-25 17 10)" />
      </svg>
    </button>
  );
};
