'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [{ href: '/', label: 'Server saya', staffOnly: false }];

// Halaman global: datanya berlaku di semua server, jadi hanya untuk staf.
const STAFF_LINKS = [
  { href: '/overview', label: 'Ringkasan global', staffOnly: true },
  { href: '/logs', label: 'Logs global', staffOnly: true },
  { href: '/blacklist', label: 'Blacklist', staffOnly: true },
  { href: '/whitelist', label: 'Whitelist global', staffOnly: true },
];

export function Nav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const links = isStaff ? [...LINKS, ...STAFF_LINKS] : LINKS;

  return (
    <nav className="flex flex-wrap gap-1">
      {links.map((link) => {
        const active =
          link.href === '/'
            ? pathname === '/' || pathname.startsWith('/servers/')
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? 'bg-ink-700 text-white' : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
