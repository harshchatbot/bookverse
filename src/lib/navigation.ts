"use client";

import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";

export const appPaths = {
  home: "/",
  browse: "/browse",
  about: "/about",
  login: "/login",
  profile: "/profile",
  dashboard: "/dashboard",
  admin: "/admin",
  sell: "/sell",
  myListings: "/my-listings",
  wishlist: "/wishlist",
  offers: "/offers",
  notifications: "/notifications",
  checkout: "/checkout",
} as const;

export function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function isNextRuntimeAvailable() {
  return typeof window === "undefined" || "__NEXT_DATA__" in window;
}

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<NextLinkProps, "href"> & {
    href: string;
    children: ReactNode;
  };

export function Link({ href, children, ...props }: AppLinkProps) {
  if (isNextRuntimeAvailable()) {
    return createElement(NextLink, { href, ...props }, children);
  }

  return createElement("a", { href, ...props }, children);
}

type AppRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

export function useAppRouter(): AppRouter {
  try {
    const router = useNextRouter();
    return {
      push: (href) => router.push(href),
      replace: (href) => router.replace(href),
    };
  } catch {
    return {
      push: (href) => {
        if (typeof window !== "undefined") window.location.assign(href);
      },
      replace: (href) => {
        if (typeof window !== "undefined") window.location.replace(href);
      },
    };
  }
}

export function useAppPathname() {
  try {
    return useNextPathname() ?? "/";
  } catch {
    return typeof window !== "undefined" ? window.location.pathname : "/";
  }
}
