import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import './styles.css';
import './i18n';
import './lib/dayjs';
import { isApiError } from './lib/api';
import { SessionProvider, useSession } from './hooks/session';
import { ThemeProvider, useTheme } from './hooks/theme';
import { router } from './routes/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // 4xx hatalarını tekrar deneme
      retry: (count, err) => !(isApiError(err) && err.status < 500) && count < 2,
    },
  },
});

/** Sunucudaki tema tercihini yerel tema durumuna uygular. */
function ThemeSync() {
  const { me } = useSession();
  const { setPref } = useTheme();
  const serverTheme = me?.user.theme;
  useEffect(() => {
    if (serverTheme) setPref(serverTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverTheme]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <ThemeSync />
          <RouterProvider router={router} />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
