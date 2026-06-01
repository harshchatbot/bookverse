import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { getApprovedListings } from "@/lib/listings";
import { CATEGORIES } from "@/lib/constants";
const aaravPhoto = { url: "/assets/testimonials/aarav.webp" };
const sanyaPhoto = { url: "/assets/testimonials/sanya.webp" };
const vikramPhoto = { url: "/assets/testimonials/vikram.webp" };
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Search,
  ShieldCheck,
  MessageCircle,
  IndianRupee,
  Upload,
  Users,
  MapPin,
  Truck,
  CreditCard,
  Plus,
  Wrench,
  HeartPulse,
  Atom,
  Stethoscope,
  Cpu,
  Landmark,
  Building2,
  Banknote,
  Briefcase,
  Calculator,
  Award,
  Code2,
  BookOpen,
  Sparkles,
  BadgeCheck,
  Star,
  Quote,
  Lock,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const CATEGORY_ICONS: Record<string, { icon: LucideIcon; tint: string }> = {
  engineering: { icon: Wrench, tint: "text-primary" },
  medical: { icon: HeartPulse, tint: "text-destructive" },
  jee: { icon: Atom, tint: "text-teal" },
  neet: { icon: Stethoscope, tint: "text-destructive" },
  gate: { icon: Cpu, tint: "text-primary" },
  upsc: { icon: Landmark, tint: "text-gold" },
  ssc: { icon: Building2, tint: "text-muted-foreground" },
  banking: { icon: Banknote, tint: "text-success" },
  mba: { icon: Briefcase, tint: "text-primary" },
  "ca-cs-cma": { icon: Calculator, tint: "text-gold" },
  "it-certifications": { icon: Award, tint: "text-teal" },
  programming: { icon: Code2, tint: "text-primary" },
  other: { icon: BookOpen, tint: "text-muted-foreground" },
};

function Home() {
  const { data } = useQuery({
    queryKey: ["listings", "featured"],
    queryFn: () => getApprovedListings({ limit: 8 }),
  });
  const featured = data?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[image:var(--gradient-hero)] pt-16 pb-20 text-hero-foreground lg:pt-28 lg:pb-28">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute -top-32 -left-24 h-[480px] w-[480px] rounded-full bg-primary/30 blur-[120px]" />
            <div className="absolute -bottom-32 -right-24 h-[480px] w-[480px] rounded-full bg-primary-glow/20 blur-[120px]" />
          </div>

          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-hero-foreground/15 bg-hero-foreground/10 px-4 py-1.5 text-xs font-medium text-hero-foreground/80 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              India's educational books marketplace
            </span>

            <h1 className="mt-8 font-display text-5xl leading-[1.05] tracking-tight text-hero-foreground sm:text-6xl lg:text-7xl">
              Don't let your books
              <br />
              <span className="bg-gradient-to-r from-hero-foreground via-primary-glow to-hero-foreground bg-clip-text text-transparent">
                become scrap.
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-hero-foreground/80 sm:text-lg">
              Buy and sell educational books across India. Engineering, Medical,
              Competitive Exams, Certification and Professional Books — at a fraction
              of the price.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/browse"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-primary-hover sm:w-auto sm:text-base"
              >
                <Search className="h-4 w-4 opacity-90 transition-opacity group-hover:opacity-100" />
                Browse Books
              </Link>
              <Link
                to="/sell"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-hero-foreground/25 bg-hero-foreground/5 px-7 py-4 text-sm font-bold text-hero-foreground backdrop-blur transition-colors hover:bg-hero-foreground/10 sm:w-auto sm:text-base"
              >
                Sell My Book
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Trust strip */}
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-6 border-t border-border pt-10 sm:grid-cols-3">
              <TrustItem icon={ShieldCheck} tint="primary" label="Admin-verified listings" />
              <TrustItem icon={MessageCircle} tint="teal" label="Direct WhatsApp contact" />
              <TrustItem icon={IndianRupee} tint="gold" label="No commission, ever" />
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                Browse by category
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Find books for the exam or stream you care about.
              </p>
            </div>
            <Link
              to="/browse"
              className="group hidden items-center gap-1 text-sm font-bold text-primary hover:underline sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((c) => {
              const meta = CATEGORY_ICONS[c.value] ?? { icon: BookOpen, tint: "text-muted-foreground" };
              const Icon = meta.icon;
              return (
                <Link
                  key={c.value}
                  to="/browse"
                  search={{ category: c.value } as never}
                  className="group rounded-3xl border border-transparent bg-secondary/60 p-6 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:bg-card hover:shadow-elegant"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-border bg-background shadow-sm transition-transform group-hover:scale-110">
                    <Icon className={`h-6 w-6 ${meta.tint}`} />
                  </div>
                  <h3 className="mt-6 font-display text-lg leading-tight text-foreground">{c.label}</h3>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">Explore books</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Recently listed */}
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
                Recently listed
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Fresh arrivals from sellers across the country.
              </p>
            </div>
            {featured.length > 0 && (
              <Link
                to="/browse"
                className="group hidden items-center gap-1 text-sm font-bold text-primary hover:underline sm:inline-flex"
              >
                View all
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>

          {featured.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-[40px] border-2 border-dashed border-border bg-secondary/40 px-6 py-20 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-3xl border border-border bg-background shadow-elegant">
                <Plus className="h-10 w-10 text-muted-foreground/60" />
              </div>
              <h3 className="mt-6 font-display text-2xl text-foreground">No listings yet</h3>
              <p className="mt-3 max-w-sm text-sm text-muted-foreground">
                Be the first person in your area to list a book and earn while helping
                others learn.
              </p>
              <Link
                to="/sell"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-foreground px-8 py-4 text-sm font-bold text-background shadow-elegant transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" />
                Sell your book now
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((l) => (
                <BookCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </section>

        {/* How BookVerse works — dark band */}
        <section className="my-20 bg-foreground py-24 text-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="font-display text-4xl tracking-tight sm:text-5xl">
                How BookVerse works
              </h2>
              <p className="mt-4 text-sm text-background/60">
                A simple process designed for learners.
              </p>
            </div>

            <div className="grid gap-12 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="group relative">
                  <span className="pointer-events-none absolute -top-12 -left-4 select-none font-display text-9xl text-background/[0.06] transition-colors group-hover:text-primary/15">
                    {s.n}
                  </span>
                  <div className="relative z-10">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-background/15 bg-background/10 text-primary-glow">
                      <s.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 font-display text-2xl tracking-tight text-background">
                      {s.t}
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-background/60">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Choose Your Way to Buy */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Choose Your Way to Buy
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              BookVerse gives you the flexibility to deal directly or enjoy the
              convenience of doorstep delivery — both built for trust.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Local Deal */}
            <div className="group rounded-[40px] border-2 border-transparent bg-primary/[0.06] p-10 transition-colors hover:border-primary/20">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-elegant">
                  <MapPin className="h-8 w-8" />
                </div>
                <span className="rounded-full bg-primary/15 px-4 py-1.5 text-xs font-bold tracking-wide text-primary">
                  HAND-TO-HAND
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                🤝 Local Deal
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Connect directly with sellers in your campus or neighborhood. Inspect
                the book personally and pay only when satisfied.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <FeatureTag color="primary" label="Local Pickup" />
                <FeatureTag color="primary" label="Direct WhatsApp Contact" />
              </div>
            </div>

            {/* Doorstep Delivery */}
            <div className="group rounded-[40px] border-2 border-transparent bg-secondary p-10 transition-colors hover:border-border">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-foreground text-background shadow-elegant">
                  <Truck className="h-8 w-8" />
                </div>
                <span className="rounded-full bg-foreground/10 px-4 py-1.5 text-xs font-bold tracking-wide text-foreground">
                  ONLINE SECURE
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">
                📦 Doorstep Delivery
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Order from any city in India. We handle the shipping and secure payment
                until the book is safely in your hands.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <FeatureTag color="foreground" label="Nationwide Shipping" icon={Truck} />
                <FeatureTag color="foreground" label="Secure Checkout" icon={CreditCard} />
              </div>
            </div>
          </div>
        </section>

        {/* Why Trust BookVerse */}
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Why Trust BookVerse
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Every listing and transaction is designed with student safety in mind.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_SIGNALS.map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.title}
                  className="group rounded-3xl border border-border bg-card p-8 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-elegant"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 font-display text-lg tracking-tight text-foreground">
                    {t.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {t.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Testimonials */}
        <section className="relative overflow-hidden bg-secondary/40 py-24">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[100px]" />
            <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-teal/5 blur-[100px]" />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-14 text-center">
              <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
                What Students Say
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Real stories from learners who bought and sold books on BookVerse.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
                  className="flex flex-col rounded-3xl border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elegant"
                >
                  <Quote className="h-8 w-8 text-primary/20" />
                  <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground">
                    {t.quote}
                  </p>
                  <div className="mt-8 flex items-center gap-3">
                    <img
                      src={t.photo}
                      alt={`${t.name} headshot`}
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-primary/20"
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < t.rating ? "fill-gold text-gold" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-4xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Everything you need to know about buying, selling, and staying safe on BookVerse.
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item) => (
              <AccordionItem key={item.value} value={item.value} className="border-b border-border">
                <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <Footer />
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    icon: Upload,
    t: "List your books",
    d: "Snap a few photos, set your price, and reach thousands of students in minutes.",
  },
  {
    n: "02",
    icon: Users,
    t: "Connect with buyers",
    d: "Buyers contact you directly via WhatsApp or place a secure order through BookVerse.",
  },
  {
    n: "03",
    icon: ShieldCheck,
    t: "Choose how you sell",
    d: "Meet locally for a quick exchange, or use secure payments and tracked doorstep delivery.",
  },
] as const;

const TRUST_SIGNALS = [
  {
    icon: BadgeCheck,
    title: "Verified Listings",
    description:
      "Every listing is reviewed by our team before it goes live. Fake or misleading posts are removed immediately.",
  },
  {
    icon: ShieldCheck,
    title: "Verified Sellers",
    description:
      "Sellers with a valid mobile number get a verified badge, so you know exactly who you are dealing with.",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    description:
      "Online orders are powered by Razorpay with industry-standard encryption. Your money is safe until delivery.",
  },
  {
    icon: Eye,
    title: "Transparent Pricing",
    description:
      "No hidden fees, no platform commission. What you see is what you pay — whether it is a local deal or doorstep delivery.",
  },
  {
    icon: Truck,
    title: "Tracked Shipping",
    description:
      "Doorstep deliveries include live tracking via Shiprocket. Know exactly where your book is at every step.",
  },
  {
    icon: MessageCircle,
    title: "Direct Communication",
    description:
      "Chat with sellers on WhatsApp before you buy. Ask questions, negotiate, and build confidence before you commit.",
  },
] as const;

const TESTIMONIALS = [
  {
    initials: "AR",
    photo: aaravPhoto.url,
    name: "Aarav R.",
    role: "JEE Aspirant, Kota",
    quote:
      "I got a full set of Cengage Physics and Chemistry books for less than half the MRP. The seller was verified and we met on campus. Super smooth.",
    rating: 5,
  },
  {
    initials: "SP",
    photo: sanyaPhoto.url,
    name: "Sanya P.",
    role: "NEET Student, Delhi",
    quote:
      "Sold my MBBS first-year books in two days. The buyer paid online and BookVerse arranged pickup. Easiest money I have ever made from old books.",
    rating: 5,
  },
  {
    initials: "VK",
    photo: vikramPhoto.url,
    name: "Vikram K.",
    role: "GATE Prep, Hyderabad",
    quote:
      "I was skeptical about buying used books online, but the tracked delivery and secure checkout made it feel as safe as Amazon. Highly recommend.",
    rating: 5,
  },
] as const;

const FAQ_ITEMS = [
  {
    value: "auth",
    question: "How do I sign up or log in to BookVerse?",
    answer:
      "BookVerse uses OTP-based phone authentication. Tap 'Log In' on the top right, enter your Indian mobile number, and you will receive a one-time password via SMS. No passwords to remember — just your phone.",
  },
  {
    value: "approval",
    question: "Why is my listing not showing up immediately?",
    answer:
      "Every book listing goes through a quick admin review to make sure photos are clear, details are accurate, and prices are fair. This usually takes a few hours. Once approved, your book appears on the Browse page and you will be notified.",
  },
  {
    value: "delivery-local",
    question: "What is Local Pickup and how does it work?",
    answer:
      "Local Pickup means the seller and buyer meet at an agreed location — often a campus, library, or public place — to exchange the book and payment in person. It is fast, free of shipping costs, and lets you inspect the book before paying.",
  },
  {
    value: "delivery-shipping",
    question: "Can I get a book delivered to my city?",
    answer:
      "Yes. Listings marked 'Shipping Available Across India' can be ordered with nationwide doorstep delivery. BookVerse handles shipping via trusted partners, and you can track your order from dispatch to delivery.",
  },
  {
    value: "whatsapp",
    question: "How do I contact a seller on WhatsApp?",
    answer:
      "On any book detail page, click the green 'Contact Seller on WhatsApp' button. It opens a pre-filled message with the book title, price, and location so the seller knows exactly what you are interested in. You can then chat, negotiate, and fix a meeting time.",
  },
  {
    value: "payments",
    question: "Are online payments safe on BookVerse?",
    answer:
      "Absolutely. Online orders use Razorpay, a PCI-DSS compliant payment gateway. Your payment is held securely until the book is delivered. If something goes wrong, our dispute resolution process protects both buyers and sellers.",
  },
  {
    value: "commission",
    question: "Does BookVerse charge any commission or fees?",
    answer:
      "No. BookVerse does not charge any commission on local deals. For doorstep delivery orders, a small logistics fee may apply to cover shipping and payment gateway costs, but there is no platform commission.",
  },
] as const;

function TrustItem({
  icon: Icon,
  tint,
  label,
}: {
  icon: LucideIcon;
  tint: "primary" | "teal" | "gold";
  label: string;
}) {
  const map = {
    primary: "bg-primary/10 text-primary",
    teal: "bg-teal/10 text-teal",
    gold: "bg-gold/15 text-gold",
  } as const;
  return (
    <div className="flex items-center justify-center gap-3 text-sm font-medium text-muted-foreground">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${map[tint]}`}>
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </div>
  );
}

function FeatureTag({
  color,
  label,
  icon: Icon,
}: {
  color: "primary" | "foreground";
  label: string;
  icon?: LucideIcon;
}) {
  const dot = color === "primary" ? "bg-primary" : "bg-foreground";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
      {Icon ? (
        <Icon className="h-3.5 w-3.5" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      )}
      {label}
    </span>
  );
}
