import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Provider as JotaiProvider } from 'jotai';
import { queryClientAtom } from 'jotai-tanstack-query';
import { useHydrateAtoms } from 'jotai/utils';
import { DevTools } from 'jotai-devtools';
import { ReactNode } from 'react';
import { createPersistedQueryClient } from '@/utils/query-persistence';

// Create a client with persistence
const { queryClient } = createPersistedQueryClient({
  storageKey: 'volumeviz-query-cache',
  maxAge: 1000 * 60 * 60 * 24, // 24 hours
  staleTime: 1000 * 60 * 5, // 5 minutes
  gcTime: 1000 * 60 * 60 * 24, // 24 hours
});

interface AppProviderProps {
  children: ReactNode;
  initialState?: Map<any, any>;
}

export function AppProvider({ children, initialState }: AppProviderProps) {
  const hydrateValues: [any, any][] = [
    [queryClientAtom, queryClient],
    ...(initialState ? Array.from(initialState.entries()) : []),
  ];

  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <HydrateAtoms initialValues={hydrateValues}>
          {children}
          {import.meta.env.DEV && (
            <>
              <ReactQueryDevtools initialIsOpen={false} />
              <DevTools />
            </>
          )}
        </HydrateAtoms>
      </QueryClientProvider>
    </JotaiProvider>
  );
}

function HydrateAtoms({ initialValues, children }: any) {
  useHydrateAtoms(initialValues);
  return children;
}
