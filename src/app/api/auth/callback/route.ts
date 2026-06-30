import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback.
 *
 * Problem this guards against: email clients (Apple Mail Privacy Protection,
 * corporate link scanners, Gmail image proxy) PRE-FETCH links with a plain GET
 * and don't run JavaScript. A one-time magic-link token verified on GET would
 * be consumed by that prefetch, so the user's real tap then fails as "invalid
 * or expired". So for the stateless token_hash flow we DON'T verify on GET —
 * we return a tiny page that submits a POST (via JS, or the user tapping the
 * button). Prefetchers never POST, so the token survives until the real open.
 *
 * Flows supported:
 *  - token_hash + type  → interstitial (GET) then verifyOtp (POST). Stateless,
 *    works on any browser/device. Type is tried with fallbacks so a magiclink/
 *    email/signup mismatch can't break it.
 *  - code → exchangeCodeForSession (legacy PKCE, same-browser). Kept for links
 *    already in flight.
 */

const VALID_TYPES = ["email", "magiclink", "signup", "recovery", "invite", "email_change"];

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/es/dashboard";
}

function redirectTo(request: Request, origin: string, path: string, status = 307) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const base = !isLocalEnv && forwardedHost ? `https://${forwardedHost}` : origin;
  return NextResponse.redirect(`${base}${path}`, status);
}

function interstitial(tokenHash: string, type: string, next: string): Response {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Polla Mundialista</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0a0f0d;color:#e8f0ec;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .c{text-align:center;padding:28px}
  .b{margin-top:18px;padding:13px 30px;border:0;border-radius:12px;background:#22c55e;
     color:#04130b;font-weight:800;font-size:16px;cursor:pointer}
  .t{font-size:19px;font-weight:800}.s{opacity:.65;margin-top:8px;font-size:14px}
</style></head>
<body>
  <form id="f" method="POST" action="/api/auth/callback" class="c">
    <input type="hidden" name="token_hash" value="${tokenHash}">
    <input type="hidden" name="type" value="${type}">
    <input type="hidden" name="next" value="${next}">
    <svg width="48" height="48" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:12px">
      <defs>
        <radialGradient id="bb" cx="36%" cy="30%" r="78%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef1f5"/><stop offset="1" stop-color="#cbd3dd"/></radialGradient>
        <radialGradient id="bs" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#0b1220" stop-opacity=".34"/></radialGradient>
        <clipPath id="bc"><circle cx="50" cy="50" r="46"/></clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#bb)"/>
      <g clip-path="url(#bc)">
        <path d="M88.79 58.67 L89.26 72.72 L93.07 62.51 L94.95 42.14 L92.31 39.77 Z" fill="#17191e"/>
        <path d="M34.56 21.64 L48.65 9.96 L40.72 5.11 L21.72 13.80 L17.92 24.01 Z" fill="#17191e"/>
        <path d="M55.99 69.87 L44.54 83.93 L56.75 92.61 L75.74 83.93 L75.27 69.87 Z" fill="#17191e"/>
        <path d="M39.58 58.67 L31.18 39.77 L14.54 42.14 L12.65 62.51 L28.13 72.72 Z" fill="#17191e"/>
        <path d="M57.80 50.34 L77.08 50.34 L80.60 31.43 L63.50 19.75 L49.40 31.43 Z" fill="#17191e"/>
      </g>
      <circle cx="50" cy="50" r="46" fill="url(#bs)"/>
      <ellipse cx="33" cy="31" rx="15" ry="10" fill="#fff" opacity=".5" transform="rotate(-28 33 31)"/>
      <circle cx="50" cy="50" r="46" fill="none" stroke="#0b1220" stroke-opacity=".18" stroke-width="1"/>
    </svg>
    <div class="t">Polla 2026</div>
    <div class="s">Confirmando tu acceso… · Signing you in…</div>
    <button class="b" type="submit">Entrar / Sign in</button>
  </form>
  <script>setTimeout(function(){try{document.getElementById('f').submit();}catch(e){}},60);</script>
</body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  // Stateless token_hash → defer to POST (prefetch-safe). Don't verify on GET.
  if (rawHash) {
    const tokenHash = rawHash.replace(/[^A-Za-z0-9._=\-]/g, "");
    const type = rawType && VALID_TYPES.includes(rawType) ? rawType : "email";
    return interstitial(tokenHash, type, next);
  }

  // Legacy PKCE code (same-browser). Safe to verify on GET.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, origin, next);
  }

  return redirectTo(request, origin, "/es/login?error=auth");
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") || "").replace(/[^A-Za-z0-9._=\-]/g, "");
  const formType = String(form.get("type") || "email");
  const next = safeNext(String(form.get("next") || ""));

  if (!tokenHash) return redirectTo(request, origin, "/es/login?error=auth", 303);

  const supabase = await createClient();
  // Try the stated type first, then fall back — a magic link / signup / email
  // token-type mismatch should never block sign-in. A wrong type returns an
  // error without consuming the token, so the next attempt can still succeed.
  const candidates = Array.from(new Set([formType, "magiclink", "email", "signup"])) as EmailOtpType[];
  for (const type of candidates) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(request, origin, next, 303);
  }

  return redirectTo(request, origin, "/es/login?error=auth", 303);
}
