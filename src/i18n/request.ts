import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  
  // Explicitly narrow the locale type to 'es' | 'en'
  const activeLocale = locale === 'en' ? 'en' : 'es';

  return {
    locale: activeLocale,
    messages: (await import(`../messages/${activeLocale}.json`)).default
  };
});
