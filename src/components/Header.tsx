"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  Compass,
  ClipboardList,
  Heart,
  LogOut,
  Menu,
  PlusSquare,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { Link, useAppPathname } from "@/lib/navigation";

const bookverseLogo = { url: "/assets/logo/bookverse-logo.webp" };

export type HeaderMode = "marketing" | "app" | "admin";

type NavLink = { to: string; label: string };
type DrawerLink = { to: string; label: string; icon: ReactNode };

export function Header({ mode = "marketing" }: { mode?: HeaderMode }) {
  const { user, signOut, isAdmin, loading } = useAuth();
  const access = useMarketplaceAccess();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useAppPathname();

  const profileNeedsEmail = !!user && !user.emailVerified;
  const profileNeedsPhone = !!user && !access.phoneVerified;
  const profileIncomplete =
    !!user &&
    (!user.emailVerified || !access.phoneVerified || !access.profileCompleted || access.loading);

  const navLinks = getNavLinks({ mode, user: !!user, isAdmin, profileIncomplete });
  const drawerLinks = getDrawerLinks({ user: !!user, isAdmin, profileIncomplete });

  const signOutAndClose = async () => {
    setMobileOpen(false);
    setMenuOpen(false);
    await signOut();
  };

  return (
    <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href={user ? (isAdmin ? "/admin" : profileIncomplete ? "/profile" : "/browse") : "/"}
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
                  aria-label="Account menu"
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
                    <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover shadow-elegant">
                      <div className="border-b border-border px-4 py-3">
                        <p className="truncate text-sm font-semibold">{user.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {profileIncomplete ? (
                        <>
                          <HeaderMenuLink
                            to="/profile"
                            label="Profile"
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
                              icon={<ShieldCheck className="h-4 w-4" />}
                              onSelect={() => setMenuOpen(false)}
                            />
                          )}
                        </>
                      ) : (
                        drawerLinks.map((link) => (
                          <HeaderMenuLink
                            key={link.to}
                            to={link.to}
                            label={link.label}
                            icon={link.icon}
                            onSelect={() => setMenuOpen(false)}
                          />
                        ))
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

        <div className="flex items-center gap-2 md:hidden">
          {user && !isAdmin && !profileIncomplete && <NotificationsBell />}
          <button
            onClick={() => setMobileOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border"
            aria-label="Open menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {!user ? (
              <>
                <HeaderMenuLink
                  to="/browse"
                  label="Browse Books"
                  icon={<Compass className="h-4 w-4" />}
                  onSelect={() => setMobileOpen(false)}
                />
                <HeaderMenuLink
                  to="/sell"
                  label="Sell a Book"
                  icon={<PlusSquare className="h-4 w-4" />}
                  onSelect={() => setMobileOpen(false)}
                />
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"
                >
                  Login / Sign up
                </Link>
              </>
            ) : profileIncomplete ? (
              <>
                <HeaderMenuLink
                  to="/profile"
                  label="Profile"
                  icon={<UserRound className="h-4 w-4" />}
                  onSelect={() => setMobileOpen(false)}
                />
                {profileNeedsEmail && (
                  <HeaderMenuLink
                    to="/profile"
                    label="Verify Email"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    onSelect={() => setMobileOpen(false)}
                  />
                )}
                {profileNeedsPhone && (
                  <HeaderMenuLink
                    to="/profile"
                    label="Verify Mobile"
                    icon={<ShieldCheck className="h-4 w-4" />}
                    onSelect={() => setMobileOpen(false)}
                  />
                )}
              </>
            ) : (
              <>
                {drawerLinks.map((link) => (
                  <HeaderMenuLink
                    key={link.to}
                    to={link.to}
                    label={link.label}
                    icon={link.icon}
                    onSelect={() => setMobileOpen(false)}
                  />
                ))}
                <button
                  onClick={signOutAndClose}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </>
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
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
    >
      {icon}
      {label}
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
}): NavLink[] {
  if (!user) {
    return [
      { to: "/", label: "Home" },
      { to: "/browse", label: "Browse Books" },
      { to: "/about", label: "How it works" },
    ];
  }

  if (mode === "admin" || isAdmin) {
    return [
      { to: "/admin", label: "Admin Panel" },
      { to: "/browse", label: "Browse Books" },
      { to: "/profile", label: "Profile" },
    ];
  }

  if (profileIncomplete) {
    return [{ to: "/profile", label: "Profile" }];
  }

  return [
    { to: "/browse", label: "Browse Books" },
    { to: "/sell", label: "Sell a Book" },
    { to: "/my-listings", label: "My Listings" },
    { to: "/orders", label: "My Orders" },
    { to: "/profile", label: "Profile" },
  ];
}

function getDrawerLinks({
  user,
  isAdmin,
  profileIncomplete,
}: {
  user: boolean;
  isAdmin: boolean;
  profileIncomplete: boolean;
}): DrawerLink[] {
  if (!user || profileIncomplete) return [];

  const links: DrawerLink[] = [
    { to: "/browse", label: "Browse Books", icon: <Compass className="h-4 w-4" /> },
    { to: "/sell", label: "Sell a Book", icon: <PlusSquare className="h-4 w-4" /> },
    { to: "/my-listings", label: "My Listings", icon: <ClipboardList className="h-4 w-4" /> },
    { to: "/seller/orders", label: "My Sales", icon: <ShoppingBag className="h-4 w-4" /> },
    { to: "/orders", label: "My Orders", icon: <BookOpen className="h-4 w-4" /> },
    { to: "/wishlist", label: "Wishlist", icon: <Heart className="h-4 w-4" /> },
    { to: "/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
    { to: "/profile", label: "Profile", icon: <UserRound className="h-4 w-4" /> },
  ];

  if (isAdmin) {
    links.splice(links.length - 1, 0, {
      to: "/admin",
      label: "Admin Panel",
      icon: <ShieldCheck className="h-4 w-4" />,
    });
  }

  return links;
}
