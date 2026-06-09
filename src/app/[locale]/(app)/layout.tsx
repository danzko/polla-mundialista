import * as React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionUser } from '@/lib/api';
import { AppShell } from '@/components/shared/AppShell';

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;
  const user = await getSessionUser();

  // Redirect to login if user session is missing
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Redirect to onboarding if profile is not completed
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || '';
  if (!user.onboarded && !pathname.endsWith('/onboarding')) {
    redirect(`/${locale}/onboarding`);
  }

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
