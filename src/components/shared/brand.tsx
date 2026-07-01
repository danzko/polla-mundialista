'use client';

import * as React from 'react';

// Hand-built inline-SVG brand marks. All original art (no copied/trademarked
// assets), no network fetch, a few hundred bytes each, and crisp at any size.
// Gradient ids are scoped per-instance with useId so multiple marks on one page
// never collide.

// Realistic shaded soccer ball — the app's logo mark. The pentagon layout is a
// real orthographic projection of a truncated-icosahedron (classic Telstar
// topology), with a radial sphere shade + specular highlight so it reads as an
// actual 3D ball, not a flat badge. Original geometry (no trademarked design).
// Transparent background so it sits on any surface.
export function BallMark({ className }: { className?: string }) {
  const id = React.useId();
  const PENTS = [
    'M88.79 58.67 L89.26 72.72 L93.07 62.51 L94.95 42.14 L92.31 39.77 Z',
    'M34.56 21.64 L48.65 9.96 L40.72 5.11 L21.72 13.80 L17.92 24.01 Z',
    'M55.99 69.87 L44.54 83.93 L56.75 92.61 L75.74 83.93 L75.27 69.87 Z',
    'M39.58 58.67 L31.18 39.77 L14.54 42.14 L12.65 62.51 L28.13 72.72 Z',
    'M57.80 50.34 L77.08 50.34 L80.60 31.43 L63.50 19.75 L49.40 31.43 Z',
  ];
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-body`} cx="36%" cy="30%" r="78%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef1f5" />
          <stop offset="1" stopColor="#cbd3dd" />
        </radialGradient>
        <radialGradient id={`${id}-shade`} cx="40%" cy="34%" r="72%">
          <stop offset="0" stopColor="#000000" stopOpacity="0" />
          <stop offset="0.72" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0.34" />
        </radialGradient>
        <clipPath id={`${id}-clip`}><circle cx="50" cy="50" r="46" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-body)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {PENTS.map((d, i) => <path key={i} d={d} fill="#17191e" />)}
        {PENTS.map((d, i) => <path key={`s${i}`} d={d} fill="none" stroke="#41444b" strokeWidth="0.5" />)}
      </g>
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-shade)`} />
      <ellipse cx="33" cy="31" rx="15" ry="10" fill="#ffffff" opacity="0.5" transform="rotate(-28 33 31)" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  );
}

// Official-looking World Cup trophy (gold cup + green base), an owner-provided
// icons8 mark rendered from /public/world-cup-trophy.png. Square art, so pass a
// square size class (e.g. `h-6 w-6`). Used on the branded/hero trophy surfaces
// (champion / tournament picks, leaderboard title, bracket header).
export function TrophyMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/world-cup-trophy.png"
      alt=""
      role="img"
      aria-hidden="true"
      className={className}
      draggable={false}
    />
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
