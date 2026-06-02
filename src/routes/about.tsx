import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookOpen, ShieldCheck, MessageCircle, IndianRupee, Heart, Sparkles } from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — BookVerse" },
      {
        name: "description",
        content:
          "BookVerse is India's marketplace for educational books — connecting buyers and sellers directly.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[var(--gradient-hero)]" />
          <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="h-3 w-3 text-teal" /> About BookVerse
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Books outlive exams.
              <br />
              <span className="bg-gradient-to-r from-primary to-teal bg-clip-text text-transparent">
                Give them a second life.
              </span>
            </h1>
            <p className="mt-5 text-muted-foreground sm:text-lg">
              BookVerse is a focused marketplace for educational books in India. We connect
              students, graduates and working professionals directly — no carts, no middlemen, no
              commission.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <Card icon={<BookOpen className="h-5 w-5" />} title="Built for learners">
              Engineering, Medical, JEE, NEET, GATE, UPSC, MBA, CA — every serious exam in one
              place.
            </Card>
            <Card icon={<ShieldCheck className="h-5 w-5" />} title="Verified listings">
              Every listing is reviewed by our team before it goes public. No spam, no scams.
            </Card>
            <Card icon={<MessageCircle className="h-5 w-5" />} title="Direct contact">
              Buyers reach sellers on WhatsApp. Negotiate, meet, and exchange — your way.
            </Card>
            <Card icon={<IndianRupee className="h-5 w-5" />} title="Zero commission">
              We don't take a cut. The full selling price goes to the seller.
            </Card>
            <Card icon={<Heart className="h-5 w-5" />} title="Sustainable">
              Reuse over recycle. One book passed on is one less printed.
            </Card>
            <Card icon={<Sparkles className="h-5 w-5" />} title="Made in India">
              For Indian students, in Indian cities, with WhatsApp-first communication.
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-teal/10 to-gold/10 p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Ready to list your first book?
            </h2>
            <p className="mt-2 text-muted-foreground">It takes less than a minute.</p>
            <Link
              to="/sell"
              className="mt-6 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background shadow-elegant"
            >
              Sell a book
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
        {icon}
      </div>
      <div className="mt-4 font-semibold">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
