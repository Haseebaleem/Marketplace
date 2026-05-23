"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/auth.store";
import { TopProgressBar } from "@/components/top-progress-bar";

export const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={client}>
      {/* useSearchParams() inside TopProgressBar requires a Suspense
          boundary during prerender. */}
      <Suspense fallback={null}>
        <TopProgressBar />
      </Suspense>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
};
