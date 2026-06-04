import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <div className="max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Phase 1 migration shell
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold tracking-tight">
            BookVerse Next.js shell is running
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            This is the App Router foundation for the Next.js migration. The existing TanStack
            application stays in place while we move pages and APIs in later phases.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Login placeholder
            </Link>
            <Link
              href="/browse"
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground"
            >
              Browse placeholder
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
