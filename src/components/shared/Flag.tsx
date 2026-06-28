'use client';

import * as React from 'react';

// Real flag images instead of emoji. Emoji flags don't render on Windows
// (and the England/Scotland tag-flags barely render anywhere), so users on
// those devices saw "missing flags". Images render identically everywhere.
//
// We derive the ISO 3166-1 alpha-2 code straight from the flag emoji's two
// regional-indicator codepoints (🇿🇦 → "ZA") — no manual per-team map needed.
// Subdivision flags (England/Scotland/Wales) aren't regional-indicator pairs,
// so they're special-cased by FIFA code. Falls back to the emoji on any miss.

const SUBDIVISION: Record<string, string> = {
  ENG: 'gb-eng',
  SCO: 'gb-sct',
  WAL: 'gb-wls',
};

export function isoFromEmoji(emoji: string): string | null {
  const ri = Array.from(emoji)
    .map((c) => c.codePointAt(0) ?? 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  if (ri.length === 2) {
    return ri.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65)).join('').toLowerCase();
  }
  return null;
}

export function Flag({
  code,
  emoji,
  className,
}: {
  code: string;
  emoji: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const iso = SUBDIVISION[code] ?? isoFromEmoji(emoji);

  if (!iso || failed) {
    // Emoji fallback (renders on Mac/iOS/Android; better than nothing on Windows).
    return <span className={className}>{emoji}</span>;
  }

  return (
    // Plain <img> (no next/image domain config needed); CDN-served, cached, tiny.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/h20/${iso}.png`}
      srcSet={`https://flagcdn.com/h40/${iso}.png 2x`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className ?? 'inline-block h-3.5 w-auto rounded-[2px] align-[-2px] shadow-sm'}
    />
  );
}
