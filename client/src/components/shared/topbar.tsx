'use client';

/**
 * @file topbar.tsx
 * @description Top navigation bar with breadcrumbs and notifications.
 */

import { usePathname, useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/hooks/redux.hooks';

// Build breadcrumbs from current URL path
function useBreadcrumbs() {
  const pathname = usePathname();

  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg, index, arr) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: '/' + arr.slice(0, index + 1).join('/'),
      isLast: index === arr.length - 1,
    }));

  return segments;
}

export function Topbar() {
  const router = useRouter();
  const breadcrumbs = useBreadcrumbs();
  const { activeOrg } = useAppSelector((state) => state.organization);

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm ml-10 lg:ml-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <span className="text-slate-300 dark:text-slate-600">/</span>
            )}
            {crumb.isLast ? (
              <span className="font-medium text-slate-900 dark:text-white">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => router.push(crumb.href)}
                className="text-gray-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {crumb.label}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notifications Bell */}
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          onClick={() => router.push('/notifications')}
        >
          <Bell size={16} className="text-slate-500" />
          {/* Unread badge — wired up on Day 26 */}
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full" />
        </Button>
      </div>
    </header>
  );
}