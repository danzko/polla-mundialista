import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";

const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: ["es", "en"],

  // Used when no locale matches
  defaultLocale: "es",
  
  // By default, next-intl prefixes all paths
  localePrefix: "always"
});

export default async function middleware(request: NextRequest) {
  // 1. Run next-intl middleware
  const response = intlMiddleware(request);

  // 2. Sync / Refresh Supabase session
  const supabaseResponse = response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh user session if token is expired
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  // Match all pathnames except for
  // - API routes (/api/*)
  // - Static files (/static/*, _next/*, etc.)
  // - Metadata files (/favicon.ico, /robots.txt, etc.)
  // - Images or public folder files (with extensions)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
