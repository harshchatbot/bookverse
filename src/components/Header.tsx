import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AuthGate } from "@/components/AuthGate";
import { NotificationsBell } from "@/components/NotificationsBell";
import { useState } from "react";
import {
  Bell,
  HandCoins,
  Heart,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
const bookverseLogo = { url: "/assets/logo/bookverse-logo.webp" };

export function Header() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const navLinks = [
    { to: "/browse", label: "Browse" },
    { to: "/sell", label: "Sell" },
    { to: "/about", label: "About" },
  ];

  const SignInButton = (
    <Link
      to="/login"
      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
    >
      Sign in
    </Link>
  );

  const MobileSignInButton = (
    <Link
      to="/login"
      onClick={() => setOpen(false)}
      className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold"
    >
      Sign in
    </Link>
  );

  return (
    <header className="glass-panel sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
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
          {navLinks.map((l) => {
            const active = path === l.to || (l.to !== "/" && path.startsWith(l.to));
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/sell"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" /> List a book
          </Link>
          <AuthGate fallback={SignInButton}>
            {({ user, isAdmin }) => (
              <div className="flex items-center gap-2">
                <NotificationsBell />
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1.5 transition-shadow hover:shadow-card"
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
                        <Link
                          to="/profile"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                        >
                          <UserRound className="h-4 w-4" /> Profile
                        </Link>
                        <Link
                          to="/wishlist"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                        >
                          <Heart className="h-4 w-4" /> Wishlist
                        </Link>
                        <Link
                          to="/my-listings"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                        >
                          <ListChecks className="h-4 w-4" /> My listings
                        </Link>
                        <Link
                          to="/offers"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                        >
                          <HandCoins className="h-4 w-4" /> Offers
                        </Link>
                        <Link
                          to="/notifications"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                        >
                          <Bell className="h-4 w-4" /> Notifications
                        </Link>
                        {isAdmin && (
                          <Link
                            to="/admin"
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-secondary"
                          >
                            <ShieldCheck className="h-4 w-4" /> Admin dashboard
                          </Link>
                        )}
                        <button
                          onClick={async () => {
                            setMenuOpen(false);
                            await signOut();
                          }}
                          className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-secondary"
                        >
                          <LogOut className="h-4 w-4" /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </AuthGate>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid h-10 w-10 place-items-center rounded-full border border-border"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/sell"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-xl bg-foreground px-3 py-2.5 text-center text-sm font-semibold text-background"
            >
              List a book
            </Link>
            <AuthGate fallback={MobileSignInButton}>
              {({ isAdmin }) => (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    Profile
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    Wishlist
                  </Link>
                  <Link
                    to="/my-listings"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    My listings
                  </Link>
                  <Link
                    to="/offers"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    Offers
                  </Link>
                  <Link
                    to="/notifications"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    Notifications
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                    }}
                    className="rounded-xl px-3 py-2.5 text-left text-sm text-destructive hover:bg-secondary"
                  >
                    Sign out
                  </button>
                </>
              )}
            </AuthGate>
          </div>
        </div>
      )}
    </header>
  );
}
