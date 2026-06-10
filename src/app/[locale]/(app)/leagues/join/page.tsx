'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { joinLeague } from '@/lib/api';
import { inviteCodeSchema } from '@/lib/validation';
import { UserPlus, ArrowLeft, KeyRound } from 'lucide-react';

const formSchema = z.object({
  inviteCode: inviteCodeSchema,
});

type FormData = z.infer<typeof formSchema>;

export default function JoinLeaguePage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inviteCode: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    const result = await joinLeague({
      inviteCode: data.inviteCode,
    });

    if (result.ok) {
      // Redirect to the league detail page
      router.push(`${basePath}/leagues/${result.data.leagueId}`);
    } else {
      setApiError(result.error);
    }
  };

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto py-6">
      
      {/* Back button */}
      <Link href={`${basePath}/dashboard`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors self-start select-none">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back')}
      </Link>

      <Card className="w-full glass-card shadow-2xl rounded-2xl border-border/80">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader className="space-y-2 text-center pb-4">
            <CardTitle className="text-2xl font-extrabold tracking-tight">
              {t('league.joinTitle')}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground font-light leading-relaxed">
              {t('league.joinDesc')}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {apiError && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive text-center">
                ⚠️ {apiError}
              </div>
            )}
            
            {/* Invite Code */}
            <div className="space-y-2">
              <label htmlFor="inviteCode" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t('league.inviteCodeLabel')}
              </label>
              <div className="relative flex items-center">
                <KeyRound className="absolute left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder={t('league.inviteCodePlaceholder')}
                  className="pl-10 rounded-xl font-mono text-center uppercase tracking-widest text-base font-extrabold"
                  maxLength={6}
                  disabled={isSubmitting}
                  {...register('inviteCode')}
                />
              </div>
              {errors.inviteCode && (
                <p className="text-xs text-destructive font-medium mt-1 text-center">
                  {errors.inviteCode.message}
                </p>
              )}
            </div>

          </CardContent>
          
          <CardFooter className="pt-2">
            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl font-bold py-5">
              {isSubmitting ? t('common.saving') : t('league.joinSubmit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
