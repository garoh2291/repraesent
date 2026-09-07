import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Must stay true. `invalidateQueries` defaults to refetchType "active":
      // it marks a query stale but only refetches it if something is observing
      // it. A list invalidated from a detail route (publish a form, then walk
      // back to /forms) has no observer at that moment, so with false the list
      // remounted onto its own stale cache entry and painted the pre-publish
      // status until a hard reload. With staleTime below this only refetches
      // when the entry is actually stale — fresh data still comes from cache.
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000,       // cache data as “fresh” for 5 minutes
    },
  },
});
export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
