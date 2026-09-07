import { describe, it, expect } from 'vitest';
import { pairMembers, duelOutcome } from '../src/lib/duels';

describe('duels pairing', () => {
  const members = ['a', 'b', 'c', 'd', 'e'];

  it('is deterministic and symmetric', () => {
    const p1 = pairMembers('L1', 3, members);
    const p2 = pairMembers('L1', 3, [...members].reverse());
    for (const m of members) {
      expect(p1.get(m)).toEqual(p2.get(m));
      const opp = p1.get(m);
      if (opp) expect(p1.get(opp)).toBe(m);
    }
  });

  it('leaves exactly one bye for an odd league and none for even', () => {
    expect([...pairMembers('L1', 1, members).values()].filter((v) => v === null)).toHaveLength(1);
    expect([...pairMembers('L1', 1, members.slice(0, 4)).values()].filter((v) => v === null)).toHaveLength(0);
  });

  it('changes pairings between matchdays', () => {
    const a = [...pairMembers('L1', 1, members).entries()].join();
    const b = [...pairMembers('L1', 2, members).entries()].join();
    expect(a).not.toEqual(b);
  });

  it('scores outcomes only once the matchday is complete', () => {
    expect(duelOutcome(10, 4, false)).toBe('pending');
    expect(duelOutcome(10, 4, true)).toBe('win');
    expect(duelOutcome(4, 10, true)).toBe('loss');
    expect(duelOutcome(6, 6, true)).toBe('draw');
  });
});
