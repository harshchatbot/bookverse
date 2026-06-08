import type { ReactNode } from "react";
import { Header, type HeaderMode } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/BottomNav";

function Shell({
  children,
  mode,
  showFooter,
}: {
  children: ReactNode;
  mode: HeaderMode;
  showFooter: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header mode={mode} />
      <main className="flex-1">{children}</main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}

export function MarketingPageShell({ children }: { children: ReactNode }) {
  return (
    <Shell mode="marketing" showFooter>
      {children}
    </Shell>
  );
}

export function AppPageShell({ children }: { children: ReactNode }) {
  return (
    <Shell mode="app" showFooter={false}>
      <div className="pb-16 md:pb-0">{children}</div>
      <BottomNav />
    </Shell>
  );
}

export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <Shell mode="admin" showFooter={false}>
      {children}
    </Shell>
  );
}
