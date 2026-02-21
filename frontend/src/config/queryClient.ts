import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30, // Data is fresh for 30 seconds
            gcTime: 1000 * 60 * 5, // Cache expires after 5 minutes
            refetchOnWindowFocus: true, // Refetch when window regains focus
            retry: 1, // Retry failed requests once before showing error
        },
    },
});
