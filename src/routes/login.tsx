import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/Spinner";
import { Illustration } from "@/components/Illustration";
import bookverseLogo from "@/assets/bookverse-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — BookVerse" }],
  }),
  component: Login,
});

function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/browse" });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        {loading ? (
          <Spinner size={72} label="Just a moment…" />
        ) : (
          <>
            <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 via-accent-surface to-primary/40 shadow-sm">
              <img src={bookverseLogo.url} alt="" className="h-full w-full scale-125 object-contain" />
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold">Welcome to BookVerse</h1>
            <p className="mt-2 text-muted-foreground">Sign in to browse, list books, and pick up where you left off.</p>
            <button
              onClick={() => signInWithGoogle().catch((e) => toast.error(e?.message ?? "Sign-in failed"))}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-secondary"
            >
              <GoogleIcon /> Continue with Google
            </button>
            <Link to="/" className="mt-4 text-sm text-muted-foreground hover:text-foreground">
              Back to home
            </Link>
            <div className="mt-10 opacity-90">
              <Illustration variant="books" size={240} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}


function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
