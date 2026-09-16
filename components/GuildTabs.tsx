'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { path: '', label: 'Ringkasan' },
  { path: '/logs', label: 'Logs' },
  { path: '/whitelist', label: 'Whitelist' },
  { path: '/settings', label: 'Settings' },
];

export function GuildTabs({ guildId }: { guildId: string }) {
  const pathname = usePathname();
  const base = `/servers/${guildId}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-ink-700 pb-3">
      {TABS.map((tab) => {
        const href = `${base}${tab.path}`;
        const active = tab.path === '' ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.path}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active ? 'bg-ink-700 text-white' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
