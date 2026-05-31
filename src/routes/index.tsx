import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { getApprovedListings } from "@/lib/listings";
import { CATEGORIES } from "@/lib/constants";
import { ArrowRight, Search, ShieldCheck, MessageCircle, IndianRupee, BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BookVerse — Buy & Sell Educational Books Across India" },
      { name: "description", content: "Don't let your books become scrap. Buy and sell engineering, medical, JEE, NEET, GATE, UPSC and competitive exam books across India." },
      { property: "og:title", content: "BookVerse — Educational Books Marketplace" },
      { property: "og:description", content: "Buy and sell educational books across India." },
    ],
  }),
  component: Home,
});

function Home() {
  const { data } = useQuery({
    queryKey: ["listings", "featured"],
    queryFn: () => getApprovedListings({ limit: 8 }),
  });
  const featured = data?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[var(--gradient-hero)]" />
          <div
            aria-hidden
            className="absolute -top-32 right-[-10%] -z-10 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-primary/15 to-teal/10 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 left-[-10%] -z-10 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-gold/15 to-primary/10 blur-3xl"
          />
          <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-teal" /> India's educational books marketplace
              </span>
              <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Don't let your books<br />
                <span className="bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">
                  become scrap.
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Buy and sell educational books across India. Engineering, Medical,
                Competitive Exams, Certification and Professional Books — at a fraction
                of the price.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/browse"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-semibold text-background shadow-elegant transition-transform hover:scale-[1.02] sm:text-base"
                >
                  <Search className="h-4 w-4" /> Browse Books
                </Link>
                <Link
                  to="/sell"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-7 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary sm:text-base"
                >
                  Sell My Book <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-teal" /> Admin-verified listings</span>
                <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-teal" /> Direct WhatsApp contact</span>
                <span className="inline-flex items-center gap-1.5"><IndianRupee className="h-3.5 w-3.5 text-teal" /> No commission, ever</span>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Browse by category</h2>
              <p className="mt-2 text-sm text-muted-foreground">Find books for the exam or stream you care about.</p>
            </div>
            <Link to="/browse" className="hidden text-sm font-medium text-primary hover:underline sm:inline-flex">
              View all →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {CATEGORIES.map((c) => (
              <Link
                key={c.value}
                to="/browse"
                search={{ category: c.value } as never}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="mt-4 font-semibold">{c.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">Explore →</div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold sm:text-3xl">Recently listed</h2>
              <p className="mt-2 text-sm text-muted-foreground">Fresh listings from sellers across India.</p>
            </div>
            <Link to="/browse" className="text-sm font-medium text-primary hover:underline">
              View all →
            </Link>
          </div>
          {featured.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-secondary/40 p-12 text-center">
              <p className="text-sm text-muted-foreground">No listings yet. Be the first to list a book!</p>
              <Link to="/sell" className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background">
                Sell your book
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((l) => (
                <BookCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/5 via-teal/5 to-gold/5 p-8 sm:p-12">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">How BookVerse works</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[
                { n: "01", t: "List your book", d: "Add photos, condition, price and city. Submit in under a minute." },
                { n: "02", t: "We verify it", d: "Our team approves listings to keep the marketplace trustworthy." },
                { n: "03", t: "Sell via WhatsApp", d: "Buyers contact you directly. No middleman, no commission." },
              ].map((s) => (
                <div key={s.n} className="rounded-2xl border border-border bg-background p-6">
                  <div className="font-display text-3xl font-bold text-primary">{s.n}</div>
                  <div className="mt-3 font-semibold">{s.t}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
