import * as React from 'react';
import { getBracket, getLeagueBrackets, getTeams } from '@/lib/api';
import { BracketBoard } from './BracketBoard';

export const dynamic = 'force-dynamic';

interface BracketPageProps {
  params: Promise<{ locale: string }>;
}

export default async function BracketPage({ params }: BracketPageProps) {
  const { locale } = await params;
  const [bracket, comparison, teams] = await Promise.all([
    getBracket(),
    getLeagueBrackets(),
    getTeams(),
  ]);

  return (
    <div className="py-2">
      <BracketBoard
        initialBracket={bracket}
        comparison={comparison}
        teams={teams}
        locale={locale as any}
      />
    </div>
  );
}
