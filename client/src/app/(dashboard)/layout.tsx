'use client';

/**
 * @file (dashboard)/layout.tsx
 * @description Layout for all protected dashboard pages.
 * Includes sidebar + topbar shell.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/hooks/redux.hooks';
import { Sidebar } from '@/components/shared/sidebar';
import { Topbar } from '@/components/shared/topbar';
import { ErrorBoundary } from '@/components/shared/error-boundary';
import { SkeletonSidebar } from '@/components/shared/skeleton';
import { VerificationBanner } from '@/components/shared/verification-banner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // 1. Still checking? Show 
  // Show skeleton while checking auth on page load
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
        <aside className="hidden lg:block w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
          <SkeletonSidebar />
        </aside>
        <div className="flex-1 flex flex-col">
          <div className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" />
          <main className="flex-1 p-6">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  // 2. Not logged in? Show 
  if (!isAuthenticated) return null;

  // 3. Logged in? Show real 
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <Topbar />

        <VerificationBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}