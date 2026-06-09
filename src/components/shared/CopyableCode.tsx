'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyableCodeProps {
  code: string;
  className?: string;
}

export function CopyableCode({ code, className }: CopyableCodeProps) {
  const t = useTranslations();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-2 bg-slate-900/60 border border-border/80 rounded-xl px-3.5 py-1.5 font-mono", className)}>
      <span className="text-base font-extrabold tracking-wider text-primary select-all">
        {code}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "p-1 rounded-lg transition-all active:scale-90 flex items-center justify-center cursor-pointer",
          copied
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            : "hover:bg-secondary text-muted-foreground hover:text-foreground border border-transparent"
        )}
        title={t('common.copy')}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 stroke-[3px]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
