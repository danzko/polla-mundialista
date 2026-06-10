'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { completeOnboarding, getSessionUser } from '@/lib/api';
import { displayNameSchema } from '@/lib/validation';
import { Globe, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  displayName: displayNameSchema,
  preferredLanguage: z.enum(['es', 'en']),
});

type FormData = z.infer<typeof formSchema>;

export default function OnboardingPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const [isLoadingUser, setIsLoadingUser] = React.useState(true);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: '',
      preferredLanguage: currentLocale as any,
    },
  });

  const selectedLang = watch('preferredLanguage');

  // Load user data on mount
  React.useEffect(() => {
    async function loadUser() {
      const user = await getSessionUser();
      if (user) {
        if (user.onboarded) {
          // If already onboarded, send directly to dashboard
          router.push(`${basePath}/dashboard`);
        } else {
          setValue('displayName', user.displayName || '');
        }
      }
      setIsLoadingUser(false);
    }
    loadUser();
  }, [basePath, router, setValue]);

  // Sync route locale when language selection changes in form
  const handleLangChange = (lang: 'es' | 'en') => {
    setValue('preferredLanguage', lang);
    if (lang !== currentLocale) {
      const segments = pathname.split('/');
      segments[1] = lang;
      router.push(segments.join('/'));
    }
  };

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    const result = await completeOnboarding({
      displayName: data.displayName,
      preferredLanguage: data.preferredLanguage,
    });

    if (result.ok) {
      // Redirect to dashboard with the (possibly new) selected locale
      router.push(`/${data.preferredLanguage}/dashboard`);
    } else {
      setApiError(result.error);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md glass-card shadow-2xl rounded-2xl border-border/80">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {t('onboarding.title')}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground font-light leading-relaxed">
              {t('onboarding.description')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-5">
            {apiError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive text-center">
                ⚠️ {apiError}
              </div>
            )}
            
            {/* Display Name Input */}
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('onboarding.nameLabel')}
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="displayName"
                  type="text"
                  placeholder={t('onboarding.namePlaceholder')}
                  className="pl-10 rounded-xl font-semibold"
                  disabled={isSubmitting}
                  {...register('displayName')}
                />
              </div>
              {errors.displayName && (
                <p className="text-xs text-destructive font-medium mt-1">
                  {errors.displayName.message}
                </p>
              )}
            </div>

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('onboarding.langLabel')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleLangChange('es')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all duration-200 cursor-pointer",
                    selectedLang === 'es'
                      ? "bg-primary text-primary-foreground border-primary glow-green"
                      : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="text-base select-none">🇨🇴</span>
                  Español
                </button>
                <button
                  type="button"
                  onClick={() => handleLangChange('en')}
                  className={cn(
                    "flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-bold text-sm transition-all duration-200 cursor-pointer",
                    selectedLang === 'en'
                      ? "bg-primary text-primary-foreground border-primary glow-green"
                      : "border-border bg-card/50 text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  <span className="text-base select-none">🇺🇸</span>
                  English
                </button>
              </div>
            </div>

          </CardContent>
          
          <CardFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl font-bold py-5">
              {isSubmitting ? t('common.saving') : t('onboarding.submit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
