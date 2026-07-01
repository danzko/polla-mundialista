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

// Iconic World Cup–style trophy: two stylized figures spiraling up to lift a
// meridian globe, over a two-tier base. The body outline is a smooth closed
// Catmull-Rom curve; gold gradient + inner twist contours + specular highlight
// give it real depth (same treatment as BallMark). Original art evoking the
// cup — not a trademark clone. Pairs with champion / tournament surfaces.
export function TrophyMark({ className }: { className?: string }) {
  const id = React.useId();
  const BODY =
    'M 35.50 28.00 C 36.92 29.17, 36.42 32.50, 37.00 35.00 C 37.58 37.50, 38.33 40.33, 39.00 43.00 C 39.67 45.67, 40.17 48.33, 41.00 51.00 C 41.83 53.67, 43.50 56.67, 44.00 59.00 C 44.50 61.33, 44.67 63.00, 44.00 65.00 C 43.33 67.00, 40.83 69.17, 40.00 71.00 C 39.17 72.83, 41.50 75.17, 39.00 76.00 C 36.50 76.83, 27.50 76.83, 25.00 76.00 C 22.50 75.17, 24.83 72.83, 24.00 71.00 C 23.17 69.17, 20.67 67.00, 20.00 65.00 C 19.33 63.00, 19.50 61.33, 20.00 59.00 C 20.50 56.67, 22.17 53.67, 23.00 51.00 C 23.83 48.33, 24.33 45.67, 25.00 43.00 C 25.67 40.33, 26.42 37.50, 27.00 35.00 C 27.58 32.50, 27.08 29.17, 28.50 28.00 C 29.92 26.83, 34.08 26.83, 35.50 28.00 Z';
  return (
    <svg viewBox="0 0 64 100" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="14" y1="6" x2="52" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffefb0" />
          <stop offset="0.42" stopColor="#f4c64a" />
          <stop offset="0.78" stopColor="#d69a1e" />
          <stop offset="1" stopColor="#a9720c" />
        </linearGradient>
        <radialGradient id={`${id}-globe`} cx="40%" cy="32%" r="72%">
          <stop offset="0" stopColor="#ffefb0" />
          <stop offset="0.55" stopColor="#f1c246" />
          <stop offset="1" stopColor="#b9800f" />
        </radialGradient>
      </defs>
      {/* base: two gold tiers */}
      <rect x="19" y="83" width="26" height="7.5" rx="3.4" fill={`url(#${id}-g)`} />
      <rect x="23" y="76.5" width="18" height="7" rx="3" fill={`url(#${id}-g)`} />
      <ellipse cx="32" cy="84" rx="10.5" ry="1.4" fill="#7a5207" opacity="0.35" />
      {/* body (the twisting figures) */}
      <path d={BODY} fill={`url(#${id}-g)`} />
      {/* inner contours suggesting the two figures */}
      <path d="M 29 31 C 25 40, 25 54, 28 62 C 29 67, 30 71, 30 74" fill="none" stroke="#8a5c08" strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M 35 31 C 39 40, 39 54, 36 62 C 35 67, 34 71, 34 74" fill="none" stroke="#8a5c08" strokeOpacity="0.35" strokeWidth="1.3" strokeLinecap="round" />
      {/* left specular highlight */}
      <path d="M 25 36 C 22 44, 23 54, 27 60" fill="none" stroke="#fff6d8" strokeOpacity="0.3" strokeWidth="1.1" strokeLinecap="round" />
      {/* globe on top */}
      <circle cx="32" cy="16" r="11" fill={`url(#${id}-globe)`} />
      <g fill="none" stroke="#8a5c08" strokeOpacity="0.45" strokeWidth="0.9">
        <ellipse cx="32" cy="16" rx="4.6" ry="11" />
        <ellipse cx="32" cy="16" rx="11" ry="4.6" />
        <line x1="21" y1="16" x2="43" y2="16" />
      </g>
      <ellipse cx="28" cy="11.5" rx="3.4" ry="2.2" fill="#fff6d8" opacity="0.55" />
      <circle cx="32" cy="16" r="11" fill="none" stroke="#7a5207" strokeOpacity="0.3" strokeWidth="0.8" />
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
