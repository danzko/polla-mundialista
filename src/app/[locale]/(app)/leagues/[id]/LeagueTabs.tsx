'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, ShieldAlert, Award, Star, User } from 'lucide-react';
import type { LeagueDetail, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LeagueTabsProps {
  league: LeagueDetail;
  locale: Locale;
  currentUserId: string;
}

export function LeagueTabs({ league, locale, currentUserId }: LeagueTabsProps) {
  const t = useTranslations();

  // Helper to format rank trophies
  const renderRankNumber = (rank: number) => {
    if (rank === 1) return <span className="text-amber-400 font-extrabold select-none">🥇 1</span>;
    if (rank === 2) return <span className="text-slate-300 font-bold select-none">🥈 2</span>;
    if (rank === 3) return <span className="text-amber-600 font-semibold select-none">🥉 3</span>;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  return (
    <Tabs defaultValue="leaderboard" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-md bg-secondary/60 p-1 rounded-xl">
        <TabsTrigger value="leaderboard" className="rounded-lg font-bold py-2">
          🏆 {t('league.tabLeaderboard')}
        </TabsTrigger>
        <TabsTrigger value="members" className="rounded-lg font-bold py-2">
          👥 {t('league.tabMembers')}
        </TabsTrigger>
      </TabsList>

      {/* LEADERBOARD TAB */}
      <TabsContent value="leaderboard" className="mt-6">
        <Card className="glass-card overflow-hidden rounded-2xl border-border/60">
          <CardContent className="p-0 overflow-x-auto">
            {league.leaderboard.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-light">
                {t('league.noLeaderboard')}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-slate-950/40 text-xs font-bold uppercase tracking-wider text-muted-foreground select-none">
                    <th className="py-4 px-4 text-center w-[60px]">{t('league.columnRank')}</th>
                    <th className="py-4 px-4">{t('league.columnUser')}</th>
                    <th className="py-4 px-4 text-center font-extrabold text-primary">{t('league.columnPoints')}</th>
                    <th className="py-4 px-4 text-center hidden sm:table-cell">{t('league.columnMatchPoints')}</th>
                    <th className="py-4 px-4 text-center hidden sm:table-cell">{t('league.columnBonusPoints')}</th>
                    <th className="py-4 px-4 text-center">{t('league.columnExact')}</th>
                    <th className="py-4 px-4 text-center">{t('league.columnCorrect')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {league.leaderboard
                    .sort((a, b) => a.rank - b.rank)
                    .map((row) => {
                      const isMe = row.userId === currentUserId || row.isMe;
                      return (
                        <tr
                          key={row.userId}
                          className={cn(
                            "transition-colors hover:bg-secondary/20",
                            isMe && "bg-emerald-500/10 border-l-4 border-l-primary font-bold text-foreground"
                          )}
                        >
                          {/* Rank */}
                          <td className="py-4 px-4 text-center font-bold">
                            {renderRankNumber(row.rank)}
                          </td>
                          
                          {/* Name */}
                          <td className="py-4 px-4 flex items-center gap-2">
                            <span className="truncate max-w-[150px] sm:max-w-[250px]">
                              {row.displayName}
                            </span>
                            {isMe && (
                              <span className="text-[9px] font-extrabold uppercase bg-primary/20 text-primary border border-primary/20 px-1.5 py-0.5 rounded tracking-wide select-none">
                                {locale === 'es' ? 'Tú' : 'Me'}
                              </span>
                            )}
                          </td>

                          {/* Total Points */}
                          <td className="py-4 px-4 text-center font-extrabold text-primary text-base">
                            {row.totalPoints}
                          </td>

                          {/* Match Points */}
                          <td className="py-4 px-4 text-center hidden sm:table-cell text-muted-foreground font-semibold">
                            {row.matchPoints}
                          </td>

                          {/* Bonus Points */}
                          <td className="py-4 px-4 text-center hidden sm:table-cell text-muted-foreground font-semibold">
                            {row.bonusPoints}
                          </td>

                          {/* Exact count */}
                          <td className="py-4 px-4 text-center font-medium">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md text-xs">
                              {row.exactCount}
                            </span>
                          </td>

                          {/* Correct count */}
                          <td className="py-4 px-4 text-center font-medium">
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md text-xs">
                              {row.resultCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* MEMBERS TAB */}
      <TabsContent value="members" className="mt-6">
        <Card className="glass-card overflow-hidden rounded-2xl border-border/60">
          <CardContent className="p-4 space-y-3">
            {league.members.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground font-light">
                {t('league.noMembers')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {league.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-3 bg-slate-900/40 rounded-xl border border-border/40"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center border border-border/40 select-none">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">
                        {member.displayName}
                      </span>
                    </div>

                    {member.isAdmin && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md tracking-wider select-none">
                        👑 {t('common.admin')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
