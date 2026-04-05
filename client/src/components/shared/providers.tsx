/**
 * @file providers.tsx
 * @description Wraps the entire app with all required providers.
 *
 * WHAT ARE PROVIDERS?
 * Providers make data available to ALL components without prop drilling.
 *
 * ReduxProvider     → makes store available everywhere
 * QueryProvider     → makes API caching available everywhere
 * ThemeProvider     → makes dark/light mode available everywhere
 */

'use client';

import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { store } from '@/store';
import { fetchCurrentUser } from '@/store/slices/auth.slice';
import { fetchUserOrganizations } from '@/store/slices/organization.slice';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // Data stays fresh for 1 minute
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
  //    // Restore active org from localStorage immediately (no network needed)
  // store.dispatch(restoreActiveOrg());
    // Hit GET /auth/me — browser sends httpOnly cookie automatically
    // If cookie is valid → user restored. If not → stays logged out.
      // Then verify session via httpOnly cookie
  store.dispatch(fetchCurrentUser()).then((result) => {
    // If session valid, fetch user's organizations
    if (fetchCurrentUser.fulfilled.match(result)) {
      store.dispatch(fetchUserOrganizations());
    }
  });
  }, []);

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}