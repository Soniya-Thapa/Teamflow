'use client';

/**
 * @file providers.tsx
 *
 * KEY FIX: AppInitializer awaits BOTH fetchCurrentUser AND
 * fetchUserOrganizations before showing the app.
 *
 * BEFORE (broken):
 *   fetchCurrentUser fires → children render immediately
 *   fetchUserOrganizations fires in the background
 *   Dashboard renders with activeOrg = null
 *   Org loads → user has to reload
 *
 * AFTER (fixed):
 *   fetchCurrentUser runs → awaited
 *   fetchUserOrganizations runs → awaited
 *   THEN children render
 *   Dashboard always has activeOrg ready on first render
 */

import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { store } from '@/store';
import { fetchCurrentUser } from '@/store/slices/auth.slice';
import { fetchUserOrganizations } from '@/store/slices/organization.slice';

// ─────────────────────────────────────────
// APP INITIALIZER
// ─────────────────────────────────────────

function AppInitializer({ children }: { children: React.ReactNode }) {
  /**
   * isInitialized blocks the app from rendering until we know:
   * 1. Whether the user is logged in (fetchCurrentUser)
   * 2. Which orgs they belong to (fetchUserOrganizations)
   *
   * This prevents the dashboard rendering with missing org data.
   */
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      // Step 1: Check session via httpOnly cookie
      const userResult = await store.dispatch(fetchCurrentUser());

      // Step 2: If logged in, fetch their orgs before rendering anything
      if (fetchCurrentUser.fulfilled.match(userResult)) {
        await store.dispatch(fetchUserOrganizations());
      }

      // Step 3: Safe to render — both user and org are in Redux state
      setIsInitialized(true);
    }

    init();
  }, []);

  // Show spinner until session + orgs are ready
  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-[#fefefe] dark:bg-slate-950 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#476e66] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#708a83]">Loading TeamFlow...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppInitializer>
            {children}
          </AppInitializer>
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}