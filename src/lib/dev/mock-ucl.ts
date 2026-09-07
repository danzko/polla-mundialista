// Development-only fixtures for the /design-preview harness. Real club names
// and ESPN crest URLs so the screens look exactly like production would.
import type { MatchView, SeasonHub, LeagueSummary, Team, NextFixture } from '@/lib/types';

const crest = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
const club = (code: string, name: string, id: number): Team => ({
  id: `t-${code}`, code, nameEn: name, nameEs: name, flagEmoji: '', logoUrl: crest(id),
  group: null, groupPosition: null, eliminated: false,
});

export const CLUBS = {
  RMA: club('RMA', 'Real Madrid', 86), INT: club('INT', 'Internazionale', 110),
  MNC: club('MNC', 'Manchester City', 382), FCP: club('FCP', 'FC Porto', 437),
  DOR: club('DOR', 'Borussia Dortmund', 124), VIL: club('VIL', 'Villarreal', 102),
  BRU: club('BRU', 'Club Brugge', 570), AVL: club('AVL', 'Aston Villa', 362),
  BAR: club('BAR', 'Barcelona', 83), PSG: club('PSG', 'Paris Saint-Germain', 160),
  LIV: club('LIV', 'Liverpool', 364), MUN: club('MUN', 'Bayern Munich', 132),
  ARS: club('ARS', 'Arsenal', 359), NAP: club('NAP', 'Napoli', 114),
};

const at = (d: string) => new Date(d).toISOString();
const soon = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

const mk = (n: number, h: Team, a: Team, kick: string, pick: [number, number] | null, result?: [number, number]): MatchView => ({
  id: `m${n}`, matchNumber: n, stage: 'league', groupLabel: null, matchday: 1, leg: null, tieNumber: null,
  kickoffAt: kick, homeTeam: h, awayTeam: a, isVoided: false,
  locked: !!result, myPrediction: pick ? { homeScore: pick[0], awayScore: pick[1] } : null,
  result: result ? { homeScore: result[0], awayScore: result[1] } : null,
  pointsEarned: result && pick ? (pick[0] === result[0] && pick[1] === result[1] ? 6 : Math.sign(pick[0] - pick[1]) === Math.sign(result[0] - result[1]) ? 2 : 0) : null,
});

export const MOCK_MATCHES: MatchView[] = [
  mk(1, CLUBS.BRU, CLUBS.AVL, soon(20), [1, 2]),
  mk(2, CLUBS.FCP, CLUBS.MNC, soon(22), [0, 2]),
  mk(3, CLUBS.RMA, CLUBS.INT, soon(22.5), null),
  mk(4, CLUBS.DOR, CLUBS.VIL, soon(22.5), [3, 1]),
  mk(5, CLUBS.BAR, CLUBS.PSG, soon(46), null),
  mk(6, CLUBS.LIV, CLUBS.MUN, soon(46), [2, 2]),
  mk(7, CLUBS.ARS, CLUBS.NAP, soon(70), null),
];

const fx = (m: MatchView): NextFixture => ({
  id: m.id, kickoffAt: m.kickoffAt,
  home: { code: m.homeTeam!.code, nameEs: m.homeTeam!.nameEs, nameEn: m.homeTeam!.nameEn, flagEmoji: '', logoUrl: m.homeTeam!.logoUrl },
  away: { code: m.awayTeam!.code, nameEs: m.awayTeam!.nameEs, nameEn: m.awayTeam!.nameEn, flagEmoji: '', logoUrl: m.awayTeam!.logoUrl },
  myPick: m.myPrediction ? { h: m.myPrediction.homeScore, a: m.myPrediction.awayScore } : null,
  locked: m.locked,
});

export const MOCK_HUB: SeasonHub = {
  tournament: {
    id: 'ucl', slug: 'ucl-2026-27', kind: 'ucl', nameEn: 'Champions League 2026-27', nameEs: 'Champions League 2026-27',
    status: 'active', startsAt: at('2026-09-08T16:45:00Z'), endsAt: at('2027-06-05T00:00:00Z'), picksLockAt: at('2026-10-13T16:45:00Z'), bracketDeadline: null,
  },
  nextMatchday: {
    matchday: 1, label: 'Jornada 1', firstKickoff: soon(20), lastKickoff: soon(70), total: 18, saved: 10, open: 18, liveCount: 0,
    fixtures: MOCK_MATCHES.map(fx),
  },
  honors: [{
    tournament: { id: 'wc', slug: 'wc-2026', kind: 'world_cup', nameEn: 'World Cup 2026', nameEs: 'Mundial 2026', status: 'archived', startsAt: null, endsAt: null, picksLockAt: null, bracketDeadline: null },
    leagueName: 'CSC Champions League', participants: 31,
    podium: [
      { userId: 'a', displayName: 'PollArmando', points: 479, isMe: false },
      { userId: 'b', displayName: 'Danny', points: 446, isMe: true },
      { userId: 'c', displayName: 'JuanMan', points: 433, isMe: false },
    ],
    myRank: 2, myPoints: 446, championName: 'España', championCode: 'ESP', championFlagEmoji: '🇪🇸', championLogoUrl: null,
  }],
};

export const MOCK_LEAGUES: LeagueSummary[] = [{
  id: 'l1', name: 'CSC Champions League', inviteCode: 'Z25MYR', language: 'es', memberCount: 13, myRank: 4, myPoints: 38, isAdmin: true,
  top: [
    { userId: 'a', displayName: 'PollArmando', points: 52, rank: 1, isMe: false },
    { userId: 'c', displayName: 'JuanMan', points: 47, rank: 2, isMe: false },
    { userId: 'd', displayName: 'Tania', points: 44, rank: 3, isMe: false },
    { userId: 'b', displayName: 'Danny', points: 38, rank: 4, isMe: true },
  ],
}];
