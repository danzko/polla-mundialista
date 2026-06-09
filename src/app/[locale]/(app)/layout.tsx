import * as React from 'react';
import { redirect } from 'next/navigation';
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

  return (
    <AppShell user={user}>
      {children}
    </AppShell>
  );
}
