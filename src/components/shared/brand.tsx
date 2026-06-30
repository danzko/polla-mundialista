'use client';

import * as React from 'react';

// Hand-built inline-SVG brand marks. All original art (no copied/trademarked
// assets), no network fetch, a few hundred bytes each, and crisp at any size.
// Gradient ids are scoped per-instance with useId so multiple marks on one page
// never collide.

// Realistic shaded soccer ball — the app's logo mark. Reads cleanly down to
// ~18px (header) yet keeps the classic truncated-icosahedron pattern and a
// soft 3D sphere shade. Transparent background so it sits on any surface.
export function BallMark({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-s`} cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#eef1f5" />
          <stop offset="1" stopColor="#c4ccd6" />
        </radialGradient>
      </defs>
      <g transform="translate(16 16)">
        <circle r="9.3" fill={`url(#${id}-s)`} />
        <path d="M0.00 -4.00 L3.80 -1.24 L2.35 3.24 L-2.35 3.24 L-3.80 -1.24 Z" fill="#0b1220" />
        <path d="M0.00 -4.70 L-1.90 -6.08 L-1.18 -8.32 L1.18 -8.32 L1.90 -6.08 Z" fill="#0b1220" />
        <path d="M4.47 -1.45 L5.20 -3.69 L7.55 -3.69 L8.27 -1.45 L6.37 -0.07 Z" fill="#0b1220" />
        <path d="M2.76 3.80 L5.11 3.80 L5.84 6.04 L3.94 7.42 L2.04 6.04 Z" fill="#0b1220" />
        <path d="M-2.76 3.80 L-2.04 6.04 L-3.94 7.42 L-5.84 6.04 L-5.11 3.80 Z" fill="#0b1220" />
        <path d="M-4.47 -1.45 L-6.37 -0.07 L-8.27 -1.45 L-7.55 -3.69 L-5.20 -3.69 Z" fill="#0b1220" />
        <g stroke="#0b1220" strokeWidth="1.05" strokeLinecap="round">
          <line x1="0.00" y1="-4.00" x2="0.00" y2="-4.70" />
          <line x1="3.80" y1="-1.24" x2="4.47" y2="-1.45" />
          <line x1="2.35" y1="3.24" x2="2.76" y2="3.80" />
          <line x1="-2.35" y1="3.24" x2="-2.76" y2="3.80" />
          <line x1="-3.80" y1="-1.24" x2="-4.47" y2="-1.45" />
        </g>
        {/* rim + top highlight for the sphere read */}
        <circle r="9.3" fill="none" stroke="#0b1220" strokeOpacity="0.12" strokeWidth="0.6" />
        <ellipse cx="-3" cy="-3.6" rx="3.2" ry="2" fill="#ffffff" opacity="0.5" />
      </g>
    </svg>
  );
}

// Gold World Cup–style trophy: a meridian globe on a twisting goblet stem and a
// two-tier base. Evocative of the tournament without copying FIFA's trademarked
// statue. Pairs with champion / tournament-pick surfaces.
export function TrophyMark({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 48 64" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="4" x2="0" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.45" stopColor="#f6c84a" />
          <stop offset="1" stopColor="#c98a16" />
        </linearGradient>
      </defs>
      {/* stem */}
      <path
        d="M18 27 C 17 33, 21 39, 22 42 C 22 45, 17 47, 14 50 L 34 50 C 31 47, 26 45, 26 42 C 27 39, 31 33, 30 27 Z"
        fill={`url(#${id}-g)`}
      />
      {/* base, two tiers */}
      <rect x="12" y="49" width="24" height="5.5" rx="2.5" fill={`url(#${id}-g)`} />
      <rect x="15.5" y="54.5" width="17" height="5" rx="2" fill={`url(#${id}-g)`} />
      {/* globe */}
      <circle cx="24" cy="17" r="12" fill={`url(#${id}-g)`} />
      <g fill="none" stroke="#9a6a0e" strokeOpacity="0.5" strokeWidth="1">
        <ellipse cx="24" cy="17" rx="5" ry="12" />
        <ellipse cx="24" cy="17" rx="12" ry="5" />
        <line x1="12" y1="17" x2="36" y2="17" />
      </g>
      <ellipse cx="20" cy="12.5" rx="3.4" ry="2.2" fill="#ffffff" opacity="0.4" />
    </svg>
  );
}

// Wireframe globe in brand green — meridians, parallels, and a few suggested
// landmasses. Anchors the "world" of World Cup on the landing hero.
export function GlobeMark({ className }: { className?: string }) {
  const id = React.useId();
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-f`} cx="38%" cy="32%" r="72%">
          <stop offset="0" stopColor="#1ee070" />
          <stop offset="0.6" stopColor="#12a455" />
          <stop offset="1" stopColor="#0a6e3a" />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <circle cx="24" cy="24" r="21" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${id}-f)`} />
      {/* suggested landmasses */}
      <g clipPath={`url(#${id}-c)`} fill="#0a5e33" fillOpacity="0.55">
        <path d="M22 11 C 27 12, 28 18, 25 22 C 28 27, 23 32, 21 34 C 19 29, 21 25, 19 22 C 18 17, 18 13, 22 11 Z" />
        <path d="M13 15 C 16 15, 16 20, 14 23 C 16 27, 13 31, 11 32 C 10 27, 10 21, 10 18 C 10 16, 11 15, 13 15 Z" />
        <path d="M32 18 C 35 18, 36 23, 33 26 C 31 27, 30 24, 30 22 C 30 20, 30 18, 32 18 Z" />
      </g>
      {/* meridians + parallels */}
      <g clipPath={`url(#${id}-c)`} fill="none" stroke="#e6fff1" strokeOpacity="0.4" strokeWidth="1">
        <ellipse cx="24" cy="24" rx="7" ry="21" />
        <ellipse cx="24" cy="24" rx="14" ry="21" />
        <ellipse cx="24" cy="24" rx="21" ry="7" />
        <ellipse cx="24" cy="24" rx="21" ry="14" />
        <line x1="24" y1="3" x2="24" y2="45" />
        <line x1="3" y1="24" x2="45" y2="24" />
      </g>
      <circle cx="24" cy="24" r="21" fill="none" stroke="#0a6e3a" strokeOpacity="0.55" strokeWidth="1.5" />
      <ellipse cx="17" cy="16" rx="6" ry="3.6" fill="#ffffff" opacity="0.14" transform="rotate(-30 17 16)" />
    </svg>
  );
}
