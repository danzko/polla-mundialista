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
import { CopyableCode } from '@/components/shared/CopyableCode';
import { createLeague } from '@/lib/api';
import { leagueNameSchema } from '@/lib/validation';
import { Trophy, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  name: leagueNameSchema,
  language: z.enum(['es', 'en']),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateLeaguePage() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const [createdInfo, setCreatedInfo] = React.useState<{ leagueId: string; inviteCode: string } | null>(null);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      language: currentLocale as any,
    },
  });

  const onSubmit = async (data: FormData) => {
    setApiError(null);
    const result = await createLeague({
      name: data.name,
      language: data.language,
    });

    if (result.ok) {
      setCreatedInfo(result.data);
    } else {
      setApiError(result.error);
    }
  };

  return (
    <div className="flex flex-col space-y-4 max-w-md mx-auto py-6">
      
      {/* Back button (only if not created yet) */}
      {!createdInfo && (
        <Link href={`${basePath}/dashboard`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors self-start select-none">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
      )}

      <Card className="w-full glass-card shadow-2xl rounded-2xl border-border/80">
        {!createdInfo ? (
          // CREATE LEAGUE FORM
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardHeader className="space-y-2 text-center pb-4">
              <CardTitle className="text-2xl font-extrabold tracking-tight">
                {t('league.createTitle')}
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground font-light leading-relaxed">
                {t('league.createDesc')}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {apiError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive text-center">
                  ⚠️ {apiError}
                </div>
              )}
              
              {/* League Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('league.leagueNameLabel')}
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t('league.leagueNamePlaceholder')}
                  className="rounded-xl font-semibold"
                  disabled={isSubmitting}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive font-medium mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label htmlFor="language" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t('league.leagueLangLabel')}
                </label>
                <select
                  id="language"
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 focus-visible:border-primary/50 font-semibold cursor-pointer"
                  disabled={isSubmitting}
                  {...register('language')}
                >
                  <option value="es">🇨🇴 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
              </div>
            </CardContent>
            
            <CardFooter className="pt-2">
              <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl font-bold py-5">
                {isSubmitting ? t('common.saving') : t('league.createSubmit')}
              </Button>
            </CardFooter>
          </form>
        ) : (
          // SUCCESS STATE SHOWING CODE
          <div className="p-8 text-center space-y-6 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-primary flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold tracking-tight">
                {currentLocale === 'es' ? '¡Liga Creada con Éxito!' : 'League Created Successfully!'}
              </h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs">
                {currentLocale === 'es'
                  ? 'Comparte este código de invitación con tus amigos para que puedan unirse.'
                  : 'Share this invite code with your friends so they can join your pool.'}
              </p>
            </div>

            {/* Copyable code */}
            <div className="py-2 flex flex-col items-center gap-1.5 w-full">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block select-none">
                {t('league.inviteCode')}
              </span>
              <CopyableCode code={createdInfo.inviteCode} />
            </div>

            {/* Link to league detail */}
            <Button asChild className="w-full rounded-xl font-bold py-5 flex items-center justify-center gap-2">
              <Link href={`${basePath}/leagues/${createdInfo.leagueId}`}>
                {currentLocale === 'es' ? 'Ir a la liga' : 'Go to league'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
