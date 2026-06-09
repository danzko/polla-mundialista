import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // A list of all locales that are supported
  locales: ['es', 'en'],

  // Used when no locale matches
  defaultLocale: 'es',
  
  // By default, next-intl prefixes all paths
  localePrefix: 'always'
});

export const config = {
  // Match all pathnames except for
  // - API routes (/api/*)
  // - Static files (/static/*, /_next/*, etc.)
  // - Metadata files (/favicon.ico, /robots.txt, etc.)
  // - Images or public folder files (with extensions)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
