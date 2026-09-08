'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trophy, Calendar, Home, LogOut, Menu, X, GitBranch, HelpCircle, Medal, Award } from 'lucide-react';
import { LanguageToggle } from './LanguageToggle';
import { ModeToggle } from './ModeToggle';
import { NameChangeMenu } from './NameChangeMenu';
import { BallMark } from './brand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SessionUser, Locale } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
  user: SessionUser | null;
  onLogout?: () => void;
  /** Season skin: 'ucl' = Champions League (default), 'wc' = World Cup archive. */
  theme?: 'ucl' | 'wc';
}

export function AppShell({ children, user, onLogout, theme = 'ucl' }: AppShellProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  const navItems = [
    {
      label: t('nav.dashboard'),
      href: `${basePath}/dashboard`,
      icon: Home,
    },
    {
      label: t('nav.leaderboard'),
      href: `${basePath}/leaderboard`,
      icon: Medal,
    },
    {
      label: t('nav.matches'),
      href: `${basePath}/matches`,
      icon: Calendar,
    },
    {
      label: t('nav.bracket'),
      href: `${basePath}/bracket`,
      icon: GitBranch,
    },
    {
      label: t('nav.bonuses'),
      href: `${basePath}/bonuses`,
      icon: Trophy,
    },
  ];

  // Helper to check if item is active
  const isActive = (href: string) => {
    // Exact match or matches subpath
    return pathname === href || pathname.startsWith(href + '/');
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Direct mock logout redirect
      router.push(`${basePath}`);
    }
  };

  return (
    <div data-theme={theme} className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2">
              <BallMark className="h-6 w-6 shrink-0 drop-shadow-[0_0_6px_rgba(25,194,90,0.35)]" />
              <span className="text-xl font-extrabold tracking-tight text-foreground">
                {t('common.title')}
              </span>
            </Link>

            {/* Desktop Nav Items */}
            <nav className="hidden md:flex items-center gap-6">
              {user && navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 text-sm font-semibold transition-colors py-2 px-1 border-b-2",
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              {user && (
                <Link
                  href={`${basePath}/rules`}
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold transition-colors py-2 px-1 border-b-2",
                    isActive(`${basePath}/rules`)
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HelpCircle className="h-4 w-4" />
                  {t('nav.rules')}
                </Link>
              )}
              {user && (
                <Link
                  href={`${basePath}/hall`}
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold transition-colors py-2 px-1 border-b-2",
                    isActive(`${basePath}/hall`)
                      ? "border-amber-400 text-amber-300"
                      : "border-transparent text-muted-foreground hover:text-amber-200"
                  )}
                >
                  <Award className="h-4 w-4" />
                  {currentLocale === 'es' ? 'Salón' : 'Hall'}
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ModeToggle />
            <LanguageToggle />

            {user && (
              <div className="hidden md:flex items-center gap-2 border-l border-border pl-4">
                <span className="text-sm font-medium text-muted-foreground">
                  {user.displayName}
                </span>
                <NameChangeMenu
                  locale={currentLocale as Locale}
                  displayName={user.displayName}
                  used={user.nameChangeUsed}
                  variant="icon"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title={t('common.logout')}
                  className="ml-2"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            )}

            {/* Mobile: quick Rules link + menu toggle */}
            {user && (
              <Link
                href={`${basePath}/rules`}
                title={t('nav.rules')}
                className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary md:hidden"
              >
                <HelpCircle className="h-6 w-6" />
              </Link>
            )}
            {user && (
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop & Panel */}
      {user && mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="fixed inset-y-0 right-0 z-40 w-full max-w-xs bg-card p-6 shadow-xl border-l border-border flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-extrabold tracking-tight text-primary">
                  <BallMark className="h-5 w-5 shrink-0" />
                  {t('common.title')}
                </span>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              {/* Primary navigation lives in the bottom tab bar on mobile, so
                  this menu is just the account drawer (Rules + profile + logout). */}
              <div className="flex flex-col gap-2">
                <Link
                  href={`${basePath}/rules`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 py-3 px-4 rounded-xl text-base font-semibold transition-all duration-200",
                    isActive(`${basePath}/rules`)
                      ? "bg-accent text-accent-foreground glow-green"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <HelpCircle className="h-5 w-5" />
                  {t('nav.rules')}
                </Link>
                <Link
                  href={`${basePath}/hall`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 py-3 px-4 rounded-xl text-base font-semibold transition-all duration-200",
                    isActive(`${basePath}/hall`)
                      ? "bg-amber-500/15 text-amber-200"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Award className="h-5 w-5" />
                  {currentLocale === 'es' ? 'Salón de la Fama · torneos anteriores' : 'Hall of Fame · previous tournaments'}
                </Link>
              </div>
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <div className="flex items-center justify-between px-4">
                <span className="text-sm font-medium text-muted-foreground">
                  {user.displayName}
                </span>
              </div>
              <div className="px-4">
                <NameChangeMenu
                  locale={currentLocale as Locale}
                  displayName={user.displayName}
                  used={user.nameChangeUsed}
                  variant="row"
                  onDone={() => setMobileMenuOpen(false)}
                />
              </div>
              <Button
                variant="destructive"
                className="w-full flex items-center justify-center gap-2 rounded-xl"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-14">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-border bg-card/30 py-6 text-center text-sm text-muted-foreground mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>© 2026 {t('common.title')}</p>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {user && (
        <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-card/95 backdrop-blur-md md:hidden px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] shadow-lg flex justify-around">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  "flex min-h-[48px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("flex h-7 w-11 items-center justify-center rounded-full", active && "bg-primary/15")}>
                  <item.icon className="h-5 w-5" />
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
