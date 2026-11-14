import { describe, it, expect } from 'vitest';
import { signUnsub, verifyUnsub } from '../src/lib/reminder-token';

const SECRET = 'test-secret';
const USER = '794e6a0e-8a7e-49e6-a4da-2b357a3cfc17';

describe('unsubscribe token', () => {
  it('verifies a signature it issued', () => {
    expect(verifyUnsub(USER, signUnsub(USER, SECRET), SECRET)).toBe(true);
  });

  it('rejects a tampered signature, another user, or another secret', () => {
    const sig = signUnsub(USER, SECRET);
    expect(verifyUnsub(USER, sig.replace(/.$/, sig.endsWith('0') ? '1' : '0'), SECRET)).toBe(false);
    expect(verifyUnsub('ea150059-2daa-4427-82ad-25c8104d075b', sig, SECRET)).toBe(false);
    expect(verifyUnsub(USER, sig, 'other-secret')).toBe(false);
  });

  it('rejects garbage ids, empty signatures and a missing secret', () => {
    expect(verifyUnsub('not-a-uuid', signUnsub('not-a-uuid', SECRET), SECRET)).toBe(false);
    expect(verifyUnsub(USER, '', SECRET)).toBe(false);
    expect(verifyUnsub(USER, signUnsub(USER, SECRET), '')).toBe(false);
  });
});
