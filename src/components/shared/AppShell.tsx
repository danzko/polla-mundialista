'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Trophy, Calendar, Home, LogOut, Coffee, Menu, X } from 'lucide-react';
import { LanguageToggle } from './LanguageToggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/types';

interface AppShellProps {
  children: React.ReactNode;
  user: SessionUser | null;
  onLogout?: () => void;
}

export function AppShell({ children, user, onLogout }: AppShellProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const currentLocale = pathname.split('/')[1] || 'es';
  const basePath = `/${currentLocale}`;

  // Tip Jar URLs
  const bmcUrl = process.env.NEXT_PUBLIC_BMC_URL || 'https://www.buymeacoffee.com/danzko';
  const cafecitoUrl = process.env.NEXT_PUBLIC_CAFECITO_URL || 'https://cafecito.app/danzko';
  const tipJarUrl = currentLocale === 'es' ? cafecitoUrl : bmcUrl;

  const navItems = [
    {
      label: t('nav.dashboard'),
      href: `${basePath}/dashboard`,
      icon: Home,
    },
    {
      label: t('nav.matches'),
      href: `${basePath}/matches`,
      icon: Calendar,
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
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      {/* HEADER */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href={`${basePath}/dashboard`} className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">
                ⚽️ {t('common.title')}
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
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <LanguageToggle />

            {user && (
              <div className="hidden md:flex items-center gap-4 border-l border-border pl-4">
                <span className="text-sm font-medium text-muted-foreground">
                  {user.displayName}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  title={t('common.logout')}
                >
                  <LogOut className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
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
                <span className="font-extrabold tracking-tight text-primary">
                  ⚽️ {t('common.title')}
                </span>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 py-3 px-4 rounded-xl text-base font-semibold transition-all duration-200",
                        active
                          ? "bg-accent text-accent-foreground glow-green"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <div className="flex items-center justify-between px-4">
                <span className="text-sm font-medium text-muted-foreground">
                  {user.displayName}
                </span>
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {children}
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-border bg-card/30 py-6 text-center text-sm text-muted-foreground mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 {t('common.title')}</p>
          <a
            href={tipJarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-bold transition-all duration-300 shadow-sm hover:scale-105"
          >
            <Coffee className="h-4 w-4" />
            {t('common.tipJar')}
          </a>
        </div>
      </footer>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {user && (
        <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-card/90 backdrop-blur-md md:hidden px-6 py-2 shadow-lg flex justify-around">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 text-xs font-semibold py-1 transition-all duration-200",
                  active ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
