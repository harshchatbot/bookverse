"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  HandCoins,
  Heart,
  ListChecks,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { Link, useAppPathname } from "@/lib/navigation";

const bookverseLogo = { url: "/assets/logo/bookverse-logo.webp" };

export type HeaderMode = "marketing" | "app" | "admin";

export function Header({ mode = "marketing" }: { mode?: HeaderMode }) {
  const { user, signOut, isAdmin, loading } = useAuth();
  const access = useMarketplaceAccess();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useAppPathname();

  const profileNeedsEmail = !!user && !user.emailVerified;
  const profileNeedsPhone = !!user && !access.phoneVerified;
  const profileIncomplete =
    !!user &&
    (!user.emailVerified || !access.phoneVerified || !access.profileCompleted || access.loading);

  const navLinks = getNavLinks({ mode, user: !!user, isAdmin, profileIncomplete });

  const signOutAndClose = async () => {
    setOpen(false);
    setMenuOpen(false);
    await signOut();
  };

  return (
    <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={user ? (isAdmin ? "/admin" : profileIncomplete ? "/profile" : "/dashboard") : "/"}
          className="flex items-center gap-2 font-display text-lg font-bold"
          aria-label="BookVerse home"
        >
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 via-accent-surface to-primary/40 shadow-sm">
            <img
              src={bookverseLogo.url}
              alt=""
              width={40}
              height={40}
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-contain p-0.15"
            />
          </span>
          <span className="hidden sm:inline">BookVerse</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = path === link.to || (link.to !== "/" && path.startsWith(link.to));
            return (
              <Link
                key={link.to}
                href={link.to}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {!user ? (
            <Link
              href="/login"
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              Login / Sign up
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              {mode === "admin" && isAdmin && <NotificationsBell mode="admin" />}
              {mode === "app" && !isAdmin && !profileIncomplete && <NotificationsBell />}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((value) => !value)}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1.5 transition-shadow hover:shadow-card disabled:opacity-60"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
                    </span>
                  )}
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover shadow-elegant">
                      <div className="border-b border-border px-4 py-3">
                        <p className="truncate text-sm font-semibold">{user.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {isAdmin ? (
                        <>
                          <HeaderMenuLink
                            to="/admin"
                            label="Admin Dashboard"
                            icon={<ShieldCheck className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/browse"
                            label="Browse"
                            icon={<Bell className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/profile"
                            label="Profile"
                            icon={<UserRound className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                        </>
                      ) : profileIncomplete ? (
                        <>
                          <HeaderMenuLink
                            to="/profile"
                            label="Complete Profile"
                            icon={<UserRound className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          {profileNeedsEmail && (
                            <HeaderMenuLink
                              to="/profile"
                              label="Verify Email"
                              icon={<ShieldCheck className="h-4 w-4" />}
                              onSelect={() => setMenuOpen(false)}
                            />
                          )}
                          {profileNeedsPhone && (
                            <HeaderMenuLink
                              to="/profile"
                              label="Verify Mobile"
                              icon={<Bell className="h-4 w-4" />}
                              onSelect={() => setMenuOpen(false)}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <HeaderMenuLink
                            to="/dashboard"
                            label="Dashboard"
                            icon={<ListChecks className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/browse"
                            label="Browse"
                            icon={<Bell className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/sell"
                            label="Sell Book"
                            icon={<ListChecks className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/my-listings"
                            label="My Listings"
                            icon={<ListChecks className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/wishlist"
                            label="Wishlist"
                            icon={<Heart className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/offers"
                            label="Offers"
                            icon={<HandCoins className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/notifications"
                            label="Notifications"
                            icon={<Bell className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                          <HeaderMenuLink
                            to="/profile"
                            label="Profile"
                            icon={<UserRound className="h-4 w-4" />}
                            onSelect={() => setMenuOpen(false)}
                          />
                        </>
                      )}
                      <button
                        onClick={signOutAndClose}
                        className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-secondary"
                      >
                        <LogOut className="h-4 w-4" /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen((value) => !value)}
          className="grid h-10 w-10 place-items-center rounded-full border border-border md:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                href={link.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {link.label}
              </Link>
            ))}
            {!user ? (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"
              >
                Login / Sign up
              </Link>
            ) : (
              <button
                onClick={signOutAndClose}
                className="rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function HeaderMenuLink({
  to,
  label,
  icon,
  onSelect,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <Link
      href={to}
      onClick={onSelect}
      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
    >
      {icon} {label}
    </Link>
  );
}

function getNavLinks({
  mode,
  user,
  isAdmin,
  profileIncomplete,
}: {
  mode: HeaderMode;
  user: boolean;
  isAdmin: boolean;
  profileIncomplete: boolean;
}) {
  if (!user) {
    return [
      { to: "/", label: "Home" },
      { to: "/browse", label: "Browse" },
      { to: "/about", label: "How it works" },
    ];
  }

  if (mode === "admin" || isAdmin) {
    return [
      { to: "/admin", label: "Admin Dashboard" },
      { to: "/browse", label: "Browse" },
      { to: "/profile", label: "Profile" },
    ];
  }

  if (profileIncomplete) {
    return [{ to: "/profile", label: "Complete Profile" }];
  }

  return [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/browse", label: "Browse" },
    { to: "/sell", label: "Sell Book" },
    { to: "/my-listings", label: "My Listings" },
    { to: "/wishlist", label: "Wishlist" },
    { to: "/offers", label: "Offers" },
    { to: "/notifications", label: "Notifications" },
    { to: "/profile", label: "Profile" },
  ];
}
