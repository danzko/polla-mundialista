import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supports TWO verification flows:
 *
 *  1. token_hash + type  → verifyOtp  (STATELESS — works no matter which
 *     browser or device opens the link). This is what fixes "magic link
 *     doesn't work on mobile": the email opening in a different browser than
 *     the one that requested it no longer matters.
 *  2. code → exchangeCodeForSession (PKCE — only works in the SAME browser
 *     that requested the link). Kept for backward compatibility with links
 *     already in flight.
 *
 * For (1) to be used, the Supabase "Magic Link" email template must point here
 * with token_hash, e.g.:
 *   {{ .SiteURL }}/api/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/es/dashboard
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only allow same-origin relative paths to avoid open redirects.
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/es/dashboard";

  const redirectTo = (path: string) => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    if (!isLocalEnv && forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${path}`);
    }
    return NextResponse.redirect(`${origin}${path}`);
  };

  const supabase = await createClient();

  // 1) Stateless token-hash flow — cross-browser / cross-device safe.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(next);
  }

  // 2) PKCE code flow — same-browser only (backward compatibility).
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(next);
  }

  return redirectTo("/es/login?error=auth");
}
