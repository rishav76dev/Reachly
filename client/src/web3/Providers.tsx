import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StellarWalletProvider } from "./stellarWallet";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StellarWalletProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </StellarWalletProvider>
  );
}
