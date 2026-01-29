'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { HelpSection } from '@/lib/helpAccess';

type HelpSections = Record<HelpSection, boolean>;

type HelpState = {
  primary: HelpSection;
  sections: HelpSections;
  isAdmin: boolean;
};

export function FloatingHelpButton() {
  const pathname = usePathname() ?? '';
  const isAdminPage =
    pathname.startsWith('/admin') || pathname.startsWith('/help/admin');
  const [helpState, setHelpState] = useState<HelpState>({
    primary: 'viewer',
    sections: {
      viewer: true,
      creator: false,
      editor: false,
      owner: false,
      admin: false,
    },
    isAdmin: false,
  });

  useEffect(() => {
    let active = true;
    const loadHelpRole = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (!res.ok) return;
        const data = (await res.json()) as {
          user?: {
            roles?: { isSystemAdmin?: boolean };
            help?: { primary?: HelpSection; sections?: HelpSections };
          };
        };
        if (!active) return;
        setHelpState({
          primary: data.user?.help?.primary ?? 'viewer',
          sections: data.user?.help?.sections ?? {
            viewer: true,
            creator: false,
            editor: false,
            owner: false,
            admin: false,
          },
          isAdmin: Boolean(data.user?.roles?.isSystemAdmin),
        });
      } catch {
        if (!active) return;
      }
    };
    loadHelpRole();
    return () => {
      active = false;
    };
  }, []);

  const showAdminHelp = isAdminPage && helpState.isAdmin;
  const primaryNonAdmin = helpState.sections.owner
    ? 'owner'
    : helpState.sections.editor
      ? 'editor'
      : helpState.sections.creator
        ? 'creator'
        : 'viewer';
  const isHelpPage =
    pathname === '/help' ||
    pathname === '/help/' ||
    pathname.startsWith('/help/');
  if (isHelpPage) {
    return null;
  }
  const href = showAdminHelp ? '/help/admin#admin' : `/help#${primaryNonAdmin}`;
  const label = showAdminHelp ? 'Admin help' : 'Help';

  return (
    <div className="fixed bottom-5 right-5 z-[150] group">
      <span className="absolute inset-0 -z-10 hidden h-12 w-12 rounded-full bg-sky-200/70 group-hover:inline-flex group-hover:animate-ping" />
      <Link
        href={href}
        aria-label={label}
        title={label}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-lg transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-9 w-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 17v.01" />
          <path d="M9.09 9a3 3 0 1 1 4.83 2.43c-.9.68-1.42 1.32-1.42 2.57" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      </Link>
    </div>
  );
}
