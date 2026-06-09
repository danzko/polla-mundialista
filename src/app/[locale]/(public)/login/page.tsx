'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { z } from 'zod';
import { AppShell } from '@/components/shared/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';
import { requestMagicLink } from '@/lib/api';
import { emailSchema } from '@/lib/validation';
import { currentUser, setCurrentUser } from '@/lib/fixtures';

const formSchema = z.object({
  email: emailSchema,
});

type FormData = z.infer<typeof formSchema>;

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const [isSuccess, setIsSuccess] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');
  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    const result = await requestMagicLink({
      email: data.email,
      locale: currentLocale as any,
    });

    if (result.ok) {
      setSubmittedEmail(data.email);
      setIsSuccess(true);
    } else {
      setApiError(result.error);
    }
  };

  // Preview helper function to bypass real email check
  const simulateLogin = (onboarded: boolean) => {
    setCurrentUser({
      id: 'user-me',
      displayName: onboarded ? 'Danny' : '',
      preferredLanguage: currentLocale as any,
      isSuperadmin: true,
      onboarded: onboarded,
    });

    if (onboarded) {
      router.push(`${basePath}/dashboard`);
    } else {
      router.push(`${basePath}/onboarding`);
    }
  };

  return (
    <AppShell user={null}>
      <div className="flex items-center justify-center py-12 sm:py-16">
        <Card className="w-full max-w-md glass-card shadow-2xl rounded-2xl border-border/80">
          
          {!isSuccess ? (
            // LOGIN FORM STATE
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardHeader className="space-y-2 text-center pb-4">
                <CardTitle className="text-2xl font-extrabold tracking-tight">
                  {t('auth.title')}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground font-light leading-relaxed">
                  {t('auth.description')}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {apiError && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive text-center">
                    ⚠️ {apiError}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('auth.emailLabel')}
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder={t('auth.emailPlaceholder')}
                      className="pl-10 rounded-xl"
                      disabled={isSubmitting}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-xs text-destructive font-medium mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </CardContent>
              
              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl font-bold py-5">
                  {isSubmitting ? t('common.saving') : t('auth.sendButton')}
                </Button>

                {/* Developer Preview Shortcuts */}
                <div className="w-full border-t border-border/60 mt-4 pt-4 text-center">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block mb-2">
                    Preview Shortcuts (Mocks)
                  </span>
                  <div className="flex gap-2 justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => simulateLogin(false)}
                      className="text-xs px-2.5 rounded-lg border-primary/20 hover:bg-primary/5 hover:text-primary"
                    >
                      New User Onboarding
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => simulateLogin(true)}
                      className="text-xs px-2.5 rounded-lg border-primary/20 hover:bg-primary/5 hover:text-primary"
                    >
                      Returning Dashboard
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </form>
          ) : (
            // CHECK EMAIL STATE (SUCCESS)
            <div className="p-8 text-center space-y-6 flex flex-col items-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-primary flex items-center justify-center animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold tracking-tight">
                  {t('auth.checkEmail')}
                </h3>
                <p className="text-sm text-muted-foreground font-light leading-relaxed">
                  {t('auth.checkEmailDesc', { email: submittedEmail })}
                </p>
              </div>

              <div className="w-full border-t border-border/60 pt-6 space-y-3">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">
                  Simulate click from email:
                </span>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => simulateLogin(false)} variant="secondary" className="w-full rounded-xl text-xs py-4 flex items-center justify-center gap-2">
                    Login as New User (Needs Onboarding)
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button onClick={() => simulateLogin(true)} variant="secondary" className="w-full rounded-xl text-xs py-4 flex items-center justify-center gap-2">
                    Login as Active User (Goes to Dashboard)
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

        </Card>
      </div>
    </AppShell>
  );
}
