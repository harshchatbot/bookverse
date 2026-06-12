"use client";

import { BookOpen, LayoutDashboard, Package, PlusSquare, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useAppPathname } from "@/lib/navigation";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";

export function BottomNav() {
  const { user } = useAuth();
  const { loading } = useMarketplaceAccess();
  const path = useAppPathname();

  // Only show for logged-in, non-loading users
  if (!user || loading) return null;

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navItems = [
    { href: "/browse", icon: Search, label: "Browse" },
    { href: "/orders", icon: Package, label: "Orders" },
    { href: "/sell", icon: PlusSquare, label: "Sell" },
    { href: "/seller/orders", icon: BookOpen, label: "Sales" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "stroke-[2.5px]" : "stroke-2"}`}
                aria-hidden="true"
              />
              <span className={`text-[10px] font-medium ${active ? "font-semibold" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
