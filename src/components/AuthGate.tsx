import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "firebase/auth";

/**
 * Renders auth-dependent UI only after client hydration, ensuring the
 * server-rendered HTML always matches the first client paint (the
 * "loading"/unauthed branch). Prevents hydration mismatches caused by
 * Firebase auth resolving asynchronously on the client.
 *
 * Usage:
 *   <AuthGate
 *     fallback={<SignedOutUI />}
 *     loading={<Spinner />}            // optional, shown while auth resolving
 *     requireAdmin                     // optional
 *   >
 *     {({ user, isAdmin }) => <SignedInUI user={user} />}
 *   </AuthGate>
 */
export interface AuthGateRenderProps {
  user: User;
  isAdmin: boolean;
}

interface AuthGateProps {
  children: ReactNode | ((props: AuthGateRenderProps) => ReactNode);
  /** Shown when not hydrated, while loading, or when user is signed out. */
  fallback?: ReactNode;
  /** Shown specifically while auth is still resolving (post-mount). Defaults to `fallback`. */
  loading?: ReactNode;
  /** Require admin role for children to render; otherwise falls back. */
  requireAdmin?: boolean;
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function AuthGate({ children, fallback = null, loading, requireAdmin }: AuthGateProps) {
  const hydrated = useHydrated();
  const { user, isAdmin, loading: authLoading } = useAuth();

  // Pre-hydration: must match SSR (which has no user). Always render fallback.
  if (!hydrated) return <>{fallback}</>;
  if (authLoading) return <>{loading ?? fallback}</>;
  if (!user) return <>{fallback}</>;
  if (requireAdmin && !isAdmin) return <>{fallback}</>;

  return <>{typeof children === "function" ? children({ user, isAdmin }) : children}</>;
}
