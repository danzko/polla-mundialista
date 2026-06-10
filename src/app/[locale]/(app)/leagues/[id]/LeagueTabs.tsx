'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, RefreshCw, Trash2, UserMinus, Settings } from 'lucide-react';
import { renameLeague, regenerateLeagueCode, deleteLeague, kickMember } from '@/lib/api';
import type { LeagueDetail, Locale } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LeagueTabsProps {
  league: LeagueDetail;
  locale: Locale;
  currentUserId: string;
}

export function LeagueTabs({ league, locale, currentUserId }: LeagueTabsProps) {
  const t = useTranslations();
  const router = useRouter();

  // Admin action state
  const [renameValue, setRenameValue] = React.useState(league.name);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmKickId, setConfirmKickId] = React.useState<string | null>(null);

  const flash = (type: 'ok' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleRename = async () => {
    setBusy('rename');
    const res = await renameLeague({ leagueId: league.id, name: renameValue });
    setBusy(null);
    if (res.ok) {
      flash('ok', t('league.settingsSaved'));
      router.refresh();
    } else {
      flash('error', res.error);
    }
  };

  const handleRegenerate = async () => {
    setBusy('regen');
    const res = await regenerateLeagueCode({ leagueId: league.id });
    setBusy(null);
    if (res.ok) {
      flash('ok', `${t('league.regenDone')}: ${res.data.inviteCode}`);
      router.refresh();
    } else {
      flash('error', res.error);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    const res = await deleteLeague({ leagueId: league.id });
    setBusy(null);
    if (res.ok) {
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } else {
      setConfirmDelete(false);
      flash('error', res.error);
    }
  };

  const handleKick = async (userId: string) => {
    setBusy(`kick-${userId}`);
    const res = await kickMember({ leagueId: league.id, userId });
    setBusy(null);
    setConfirmKickId(null);
    if (res.ok) {
      flash('ok', t('league.kickDone'));
      router.refresh();
    } else {
      flash('error', res.error);
    }
  };

  // Helper to format rank trophies
  const renderRankNumber = (rank: number) => {
    if (rank === 1) return <span className="text-amber-400 font-extrabold select-none">🥇 1</span>;
    if (rank === 2) return <span className="text-slate-300 font-bold select-none">🥈 2</span>;
    if (rank === 3) return <span className="text-amber-600 font-semibold select-none">🥉 3</span>;
    return <span className="text-muted-foreground font-mono">{rank}</span>;
  };

  return (
    <Tabs defaultValue="leaderboard" className="w-full">
      <TabsList className={cn(
        "grid w-full bg-secondary/60 p-1 rounded-xl",
        league.isAdmin ? "grid-cols-3 max-w-xl" : "grid-cols-2 max-w-md"
      )}>
        <TabsTrigger value="leaderboard" className="rounded-lg font-bold py-2">
          🏆 {t('league.tabLeaderboard')}
        </TabsTrigger>
        <TabsTrigger value="members" className="rounded-lg font-bold py-2">
          👥 {t('league.tabMembers')}
        </TabsTrigger>
        {league.isAdmin && (
          <TabsTrigger value="settings" className="rounded-lg font-bold py-2">
            ⚙️ {t('league.tabSettings')}
          </TabsTrigger>
        )}
      </TabsList>

      {/* Feedback banner (admin actions) */}
      {feedback && (
        <div className={cn(
          "mt-4 rounded-xl border p-3 text-xs font-semibold text-center",
          feedback.type === 'ok'
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-destructive/10 border-destructive/30 text-destructive"
        )}>
          {feedback.msg}
        </div>
      )}

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

                    <div className="flex items-center gap-2">
                      {member.isAdmin && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2 py-0.5 rounded-md tracking-wider select-none">
                          👑 {t('common.admin')}
                        </span>
                      )}

                      {league.isAdmin && !member.isAdmin && (
                        confirmKickId === member.userId ? (
                          <span className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleKick(member.userId)}
                              disabled={busy === `kick-${member.userId}`}
                              className="h-7 rounded-lg px-2 text-[10px] font-extrabold bg-destructive/80 hover:bg-destructive text-white cursor-pointer"
                            >
                              {busy === `kick-${member.userId}` ? '…' : t('league.kickConfirmBtn')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setConfirmKickId(null)}
                              className="h-7 rounded-lg px-2 text-[10px] font-bold text-muted-foreground cursor-pointer"
                            >
                              {t('common.cancel')}
                            </Button>
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmKickId(member.userId)}
                            className="h-7 rounded-lg px-2 text-[10px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1" />
                            {t('league.kickBtn')}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* SETTINGS TAB (league admin only) */}
      {league.isAdmin && (
        <TabsContent value="settings" className="mt-6">
          <Card className="glass-card overflow-hidden rounded-2xl border-border/60">
            <CardContent className="p-6 space-y-8">

              {/* Rename */}
              <div className="space-y-2">
                <label htmlFor="league-rename" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none">
                  <Settings className="h-4 w-4" />
                  {t('league.renameLabel')}
                </label>
                <div className="flex gap-2">
                  <Input
                    id="league-rename"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={40}
                    className="rounded-xl font-semibold bg-card/65"
                  />
                  <Button
                    onClick={handleRename}
                    disabled={busy === 'rename' || renameValue.trim().length < 2 || renameValue === league.name}
                    className="rounded-xl font-bold px-5 cursor-pointer"
                  >
                    {busy === 'rename' ? t('common.saving') : t('common.save')}
                  </Button>
                </div>
              </div>

              {/* Regenerate invite code */}
              <div className="space-y-2 pt-4 border-t border-border/40">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 select-none">
                  <RefreshCw className="h-4 w-4" />
                  {t('league.regenLabel')}
                </label>
                <p className="text-xs text-muted-foreground font-light">
                  {t('league.regenDesc')}
                </p>
                <Button
                  variant="ghost"
                  onClick={handleRegenerate}
                  disabled={busy === 'regen'}
                  className="rounded-xl font-bold border border-border/60 hover:bg-secondary/40 cursor-pointer"
                >
                  {busy === 'regen' ? t('common.saving') : t('league.regenBtn')}
                </Button>
              </div>

              {/* Delete league */}
              <div className="space-y-2 pt-4 border-t border-destructive/20">
                <label className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-1.5 select-none">
                  <Trash2 className="h-4 w-4" />
                  {t('league.deleteLabel')}
                </label>
                <p className="text-xs text-muted-foreground font-light">
                  {t('league.deleteDesc')}
                </p>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={handleDelete}
                      disabled={busy === 'delete'}
                      className="rounded-xl font-extrabold bg-destructive hover:bg-destructive/90 text-white cursor-pointer"
                    >
                      {busy === 'delete' ? '…' : t('league.deleteConfirmBtn')}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-xl font-bold text-muted-foreground cursor-pointer"
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmDelete(true)}
                    className="rounded-xl font-bold border border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer"
                  >
                    {t('league.deleteBtn')}
                  </Button>
                )}
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      )}
    </Tabs>
  );
}
