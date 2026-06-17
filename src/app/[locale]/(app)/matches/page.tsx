import * as React from 'react';
import { getMatches, getTeams, getMatchPicks, getSessionUser, getLiveScores } from '@/lib/api';
import { MatchesFilterView } from './MatchesFilterView';

interface MatchesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MatchesPage({ params }: MatchesPageProps) {
  const { locale } = await params;
  
  // Fetch initial fixtures, teams, contestant picks, live scores, and the viewer
  const [matches, teams, picksByMatch, live, sessionUser] = await Promise.all([
    getMatches(),
    getTeams(),
    getMatchPicks(),
    getLiveScores(),
    getSessionUser(),
  ]);

  return (
    <div className="py-2">
      <MatchesFilterView
        initialMatches={matches}
        locale={locale as any}
        picksByMatch={picksByMatch}
        myUserId={sessionUser?.id}
        initialLive={live}
      />
    </div>
  );
}
