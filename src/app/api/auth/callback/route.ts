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
    <div class="t">⚽️ Polla Mundialista</div>
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
