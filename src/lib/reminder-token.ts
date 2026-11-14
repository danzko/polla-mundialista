import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed unsubscribe links: the URL carries the user id and an HMAC of it, so
 * the endpoint can flip email_reminders without a login and nobody can
 * unsubscribe someone else by guessing ids. Keyed with CRON_SECRET (server only).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function signUnsub(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsub(userId: string, sig: string, secret: string): boolean {
  if (!secret || !UUID.test(userId)) return false;
  const a = Buffer.from(signUnsub(userId, secret));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
