'use client';

/**
 * @file (admin)/layout.tsx
 * @description Admin panel layout — completely separate from main dashboard.
 *
 * GUARD:
 * Checks isSuperAdmin flag from Redux auth state.
 * Non-superadmin users are redirected to /dashboard immediately.
 * This is a CLIENT-SIDE guard — the server-side guard is the authenticate
 * middleware + isSuperAdmin check on each admin API endpoint.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/hooks/redux.hooks';
import {
  BarChart3,
  Building2,
  Users,
  Activity,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminLinks = [
  { href: '/admin/stats', label: 'Platform Stats', icon: BarChart3 },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/health', label: 'System Health', icon: Activity },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAppSelector(
    (state) => state.auth,
  );

  // Redirect non-superadmins away from admin panel
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user?.isSuperAdmin)) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading || !user?.isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Admin Sidebar — dark theme */}
      <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 bg-red-500 rounded flex items-center justify-center">
              <Settings size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white">Admin Panel</span>
          </div>
          <p className="text-xs text-slate-500">TeamFlow SuperAdmin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-1">
          {adminLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                )}
              >
                <link.icon size={14} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="px-3 py-3 border-t border-slate-800">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-y-auto text-white">
        {children}
      </main>
    </div>
  );
}