'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const settingsLinks = [
  { href: '/settings/organization', label: 'Organization' },
  { href: '/settings/members', label: 'Members' },
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/roles', label: 'Roles & Permissions' },
  { href: '/settings/billing', label: 'Billing' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8 max-w-5xl">
      {/* Settings sidebar */}
      <nav className="w-48 shrink-0 space-y-1">
        <p className="text-xs font-semibold text-slate-400 dark:text-gray-600 uppercase tracking-wider mb-3 px-3">
          Settings
        </p>
        {settingsLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              pathname === link.href
                ? 'bg-[#f4f4f4] dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                : 'text-gray-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-100',
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Settings content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}