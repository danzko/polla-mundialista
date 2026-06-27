import * as React from 'react';
import { getBracket, getTeams, getSessionUser } from '@/lib/api';
import { BracketBoard } from './BracketBoard';

export const dynamic = 'force-dynamic';

interface BracketPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BracketPage({ params }: BracketPageProps) {
  const { locale } = await params;
  const [bracket, teams, sessionUser] = await Promise.all([
    getBracket(),
    getTeams(),
    getSessionUser(),
  ]);

  return (
    <div className="py-2">
      <BracketBoard
        initialBracket={bracket}
        teams={teams}
        locale={locale as any}
        myUserId={sessionUser?.id}
      />
    </div>
  );
}
