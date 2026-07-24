"use client";

import { QueryProvider } from "@/lib/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
