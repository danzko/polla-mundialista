/**
 * Knockout slot descriptors for matches 73-104, mirrored from
 * scripts/wc2026-bracket-structure.json (FIFA fixture, validated against
 * the Glenfarne pool Excel). Used to label TBD knockout cards until the
 * superadmin assigns real teams as the tournament progresses.
 */
import type { Locale } from './types';

const SLOTS: Record<number, [string, string]> = {
  73: ['2A', '2B'],
  74: ['1E', '3:A/B/C/D/F'],
  75: ['1F', '2C'],
  76: ['1C', '2F'],
  77: ['1I', '3:C/D/F/G/H'],
  78: ['2E', '2I'],
  79: ['1A', '3:C/E/F/H/I'],
  80: ['1L', '3:E/H/I/J/K'],
  81: ['1D', '3:B/E/F/I/J'],
  82: ['1G', '3:A/E/H/I/J'],
  83: ['2K', '2L'],
  84: ['1H', '2J'],
  85: ['1B', '3:E/F/G/I/J'],
  86: ['1J', '2H'],
  87: ['1K', '3:D/E/I/J/L'],
  88: ['2D', '2G'],
  89: ['W74', 'W77'],
  90: ['W73', 'W75'],
  91: ['W76', 'W78'],
  92: ['W79', 'W80'],
  93: ['W83', 'W84'],
  94: ['W81', 'W82'],
  95: ['W86', 'W88'],
  96: ['W85', 'W87'],
  97: ['W89', 'W90'],
  98: ['W93', 'W94'],
  99: ['W91', 'W92'],
  100: ['W95', 'W96'],
  101: ['W97', 'W98'],
  102: ['W99', 'W100'],
  103: ['L101', 'L102'],
  104: ['W101', 'W102'],
};

export function knockoutSlotLabel(
  matchNumber: number,
  side: 'home' | 'away',
  locale: Locale
): string | null {
  const pair = SLOTS[matchNumber];
  if (!pair) return null;
  const desc = pair[side === 'home' ? 0 : 1];

  const winner = desc.match(/^W(\d+)$/);
  if (winner) {
    return locale === 'es' ? `Ganador P${winner[1]}` : `Winner M${winner[1]}`;
  }

  const loser = desc.match(/^L(\d+)$/);
  if (loser) {
    return locale === 'es' ? `Perdedor P${loser[1]}` : `Loser M${loser[1]}`;
  }

  const seed = desc.match(/^([12])([A-L])$/);
  if (seed) {
    const [, pos, group] = seed;
    if (locale === 'es') return `${pos}º Grupo ${group}`;
    return pos === '1' ? `Group ${group} winner` : `Group ${group} runner-up`;
  }

  const thirds = desc.match(/^3:(.+)$/);
  if (thirds) {
    return locale === 'es' ? `3º (${thirds[1]})` : `3rd (${thirds[1]})`;
  }

  return desc;
}
