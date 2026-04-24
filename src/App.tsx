// src/App.tsx
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "@/contexts/AuthProvider";
import { TenantProvider } from "@/contexts/TenantProvider";

import AppRoutes from "@/AppRoutes"; // we'll create this as a small inner module below

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered "fresh" for 60 seconds. During this window,
      // navigating between pages won't trigger new Firestore reads.
      staleTime: 60 * 1000,
      // Cached data stays in memory for 10 minutes even after unmounting,
      // so returning to a page is instant.
      gcTime: 10 * 60 * 1000,
      // Don't refetch when the user switches browser tabs — this prevents
      // a flood of reads whenever the educator alt-tabs.
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      <AuthProvider>
        <TenantProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

