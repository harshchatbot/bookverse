"use client";

import { useEffect, useState } from "react";
import { Compass, Package, PlusSquare, Search, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useAppPathname } from "@/lib/navigation";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";

export function BottomNav() {
  const { user } = useAuth();
  const { loading } = useMarketplaceAccess();
  const path = useAppPathname();
  const [searchFocus, setSearchFocus] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setSearchFocus(path === "/browse" && params.get("focus") === "search");
  }, [path]);

  // Only show for logged-in, non-loading users
  if (!user || loading) return null;

  const isActive = (href: string) => {
    if (href === "/browse?focus=search") {
      return searchFocus;
    }
    if (href === "/browse") {
      return path === "/browse" && !searchFocus;
    }
    return href === "/" ? path === "/" : path.startsWith(href);
  };

  const navItems = [
    { href: "/browse", icon: Compass, label: "Browse" },
    { href: "/browse?focus=search", icon: Search, label: "Search" },
    { href: "/sell", icon: PlusSquare, label: "Sell" },
    { href: "/orders", icon: Package, label: "Orders" },
    { href: "/profile", icon: UserRound, label: "Profile" },
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
