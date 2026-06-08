"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BookCard } from "@/components/BookCard";
import { StaggerTestimonials } from "@/components/StaggerTestimonials";
import { getApprovedListings } from "@/lib/listings";
import { CATEGORIES } from "@/lib/constants";
import { Link, buildUrl } from "@/lib/navigation";
import {
  ArrowRight,
  Search,
  ShieldCheck,
  MessageCircle,
  IndianRupee,
  Upload,
  Users,
  MapPin,
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
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const STEPS = [
  {
    n: "01",
    icon: Upload,
    t: "List your books",
    d: "Snap a few photos, set your price, and reach thousands of students across India in minutes.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    t: "Choose how to sell",
    d: "Offer local pickup for nearby buyers or enable Home Delivery via our courier network for buyers across India.",
  },
  {
    n: "03",
    icon: IndianRupee,
    t: "Get paid safely",
    d: "Buyers pay securely through BookVerse. You receive the book price directly after delivery is confirmed.",
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
      "Sellers verify their mobile number and email before listing. You always know who you are buying from.",
  },
  {
    icon: MapPin,
    title: "Home Delivery",
    description:
      "Sellers can enable courier pickup for nationwide delivery. We handle booking, tracking, and updates end-to-end.",
  },
  {
    icon: IndianRupee,
    title: "Safe Payments",
    description:
      "Home Delivery orders are paid securely through Razorpay. Funds are held until delivery is confirmed, then released to the seller.",
  },
  {
    icon: Eye,
    title: "Real Book Photos",
    description:
      "Listings require real photos so buyers can inspect condition before messaging a seller.",
  },
  {
    icon: MessageCircle,
    title: "Free to List",
    description:
      "No commission, no listing fees. BookVerse connects buyers and sellers — local deals or nationwide shipping, your choice.",
  },
] as const;

const FAQ_ITEMS = [
  {
    value: "auth",
    question: "How do I sign up or log in to BookVerse?",
    answer:
      "You can sign up with email and password or continue with Google. Before selling, messaging, saving, or making offers, BookVerse asks you to verify your email, complete your profile, and verify your mobile number.",
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
    question: "Can I find books outside major cities?",
    answer:
      "Yes. BookVerse supports state and city discovery, and sellers can manually enter smaller towns if their city is not listed.",
  },
  {
    value: "whatsapp",
    question: "How do I contact a seller on WhatsApp?",
    answer:
      "On any book detail page, click the green 'Contact Seller on WhatsApp' button. It opens a pre-filled message with the book title, price, and location so the seller knows exactly what you are interested in. You can then chat, negotiate, and fix a meeting time.",
  },
  {
    value: "direct-deals",
    question: "Does BookVerse handle payment?",
    answer:
      "It depends on how you buy. For Home Delivery orders, buyers pay securely through Razorpay and the seller gets paid after delivery is confirmed. For Local Pickup, BookVerse connects you with the seller — you then agree price and payment directly over WhatsApp.",
  },
  {
    value: "commission",
    question: "Does BookVerse charge any commission or fees?",
    answer:
      "Listing is free and BookVerse charges no seller commission. Home Delivery orders include a small platform support fee to cover payment processing and courier coordination.",
  },
] as const;

export function HomePageClient() {
  const { data } = useQuery({
    queryKey: ["listings", "featured"],
    queryFn: () => getApprovedListings({ limit: 8 }),
  });
  const featured = data?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-[image:var(--gradient-hero)] pb-16 pt-12 text-hero-foreground sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-28">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute -left-24 -top-32 h-[480px] w-[480px] rounded-full bg-primary/30 blur-[120px]" />
            <div className="absolute -bottom-32 -right-24 h-[480px] w-[480px] rounded-full bg-primary-glow/20 blur-[120px]" />
          </div>

          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-start gap-8 sm:gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
              <motion.div
                className="flex flex-col items-center text-center lg:items-start lg:text-left"
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
                }}
              >
                <motion.span
                  className="inline-flex items-center gap-2 rounded-full border border-hero-foreground/15 bg-hero-foreground/10 px-4 py-1.5 text-xs font-medium text-hero-foreground/80 backdrop-blur"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  India's educational books marketplace
                </motion.span>

                <motion.h1
                  className="mt-8 font-display text-5xl leading-[1.05] tracking-tight text-hero-foreground sm:text-6xl lg:text-7xl"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  Your Digital Raddiwala
                  <br />
                  <span className="bg-gradient-to-r from-hero-foreground via-primary-glow to-hero-foreground bg-clip-text text-transparent">
                    for Used Books.
                  </span>
                </motion.h1>

                <motion.p
                  className="mt-3 text-sm text-hero-foreground/60 sm:text-base"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  Don't let your books collect dust — or go to the raddiwala by weight.
                </motion.p>

                <motion.p
                  className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-hero-foreground/80 sm:text-lg"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  Save up to 70% on JEE, NEET, GATE, UPSC, Engineering, Medical and more. Buy from
                  verified sellers with WhatsApp contact or secure Home Delivery.
                </motion.p>

                <motion.div
                  className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:justify-start"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  <Link
                    href="/browse"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-4 text-sm font-bold text-primary-foreground shadow-elegant transition-all hover:-translate-y-0.5 hover:bg-primary-hover sm:w-auto sm:text-base"
                  >
                    <Search className="h-4 w-4 opacity-90 transition-opacity group-hover:opacity-100" />
                    Browse Books
                  </Link>
                  <Link
                    href="/sell"
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-hero-foreground/25 bg-hero-foreground/5 px-7 py-4 text-sm font-bold text-hero-foreground backdrop-blur transition-colors hover:bg-hero-foreground/10 sm:w-auto sm:text-base"
                  >
                    Sell My Book
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </motion.div>

                <motion.div
                  className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-6 lg:justify-start"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-base text-primary">
                      📚
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">500+ Books</p>
                      <p className="text-xs text-muted-foreground">Listed & verified</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-base text-primary">
                      🎓
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">200+ Students</p>
                      <p className="text-xs text-muted-foreground">Helped so far</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-base text-primary">
                      💸
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">3–5× More</p>
                      <p className="text-xs text-muted-foreground">Than raddiwala rates</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="mt-8 grid w-full grid-cols-1 gap-4 border-t border-border/40 pt-6 sm:mt-12 sm:grid-cols-3 sm:pt-8"
                  variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
                  }}
                >
                  <TrustItem icon={ShieldCheck} tint="primary" label="Verified sellers" />
                  <TrustItem icon={MessageCircle} tint="teal" label="WhatsApp or Home Delivery" />
                  <TrustItem icon={IndianRupee} tint="gold" label="Safe payments, no commission" />
                </motion.div>
              </motion.div>

              <motion.div
                className="relative h-[320px] w-full sm:h-[420px]"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
              >
                <motion.div
                  className="absolute left-1/2 top-0 h-52 w-52 -translate-x-1/2 rounded-2xl border border-border bg-card p-2 shadow-elegant sm:h-64 sm:w-54"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
                >
                  <img
                    src="/assets/hero/hero_image_1.webp"
                    alt="JEE student with books"
                    className="h-full w-full rounded-xl object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </motion.div>
                <motion.div
                  className="absolute right-0 top-1/3 h-40 w-40 rounded-2xl border border-border bg-card p-2 shadow-elegant sm:h-52 sm:w-52"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.35 }}
                >
                  <img
                    src="/assets/hero/hero_image_22.webp"
                    alt="NEET student selling books"
                    className="h-full w-full rounded-xl object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </motion.div>
                <motion.div
                  className="absolute bottom-0 left-0 h-36 w-36 rounded-2xl border border-border bg-card p-2 shadow-elegant sm:h-78 sm:w-58"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
                >
                  <img
                    src="/assets/hero/hero_image_3.webp"
                    alt="GATE aspirant with used books"
                    className="h-full w-full rounded-xl object-cover object-top"
                    loading="lazy"
                    decoding="async"
                  />
                </motion.div>
                <motion.div
                  className="absolute -top-4 left-1/4 h-14 w-14 rounded-full bg-primary/20"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0 }}
                />
                <motion.div
                  className="absolute bottom-4 right-1/4 h-10 w-10 rounded-xl bg-primary/10"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                />
                <motion.div
                  className="absolute bottom-1/4 left-6 h-6 w-6 rounded-full bg-primary/15"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
              </motion.div>
            </div>
          </div>
        </section>

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
              href="/browse"
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
                  href={buildUrl("/browse", { category: c.value })}
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
                href="/browse"
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
                Be the first person in your area to list a book and earn while helping others learn.
              </p>
              <Link
                href="/sell"
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

        <section className="my-20 bg-foreground py-24 text-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16 text-center">
              <h2 className="font-display text-4xl tracking-tight sm:text-5xl">How BookVerse works</h2>
              <p className="mt-4 text-sm text-background/60">A simple process designed for learners.</p>
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n} className="group relative">
                  <span className="pointer-events-none absolute -left-4 -top-12 select-none font-display text-9xl text-background/[0.06] transition-colors group-hover:text-primary/15">
                    {s.n}
                  </span>
                  <div className="relative z-10">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-background/15 bg-background/10 text-primary-glow">
                      <s.icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 font-display text-2xl tracking-tight text-background">{s.t}</h3>
                    <p className="mt-4 text-sm leading-relaxed text-background/60">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mb-14 text-center">
            <h2 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">
              Choose Your Way to Buy
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
              BookVerse gives you the flexibility to deal directly or enjoy the convenience of
              doorstep delivery — both built for trust.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="group rounded-[40px] border-2 border-transparent bg-primary/[0.06] p-10 transition-colors hover:border-primary/20">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-elegant">
                  <MapPin className="h-8 w-8" />
                </div>
                <span className="rounded-full bg-primary/15 px-4 py-1.5 text-xs font-bold tracking-wide text-primary">
                  HAND-TO-HAND
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">🤝 Local Deal</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Connect directly with sellers in your campus or neighborhood. Inspect the book
                personally and pay only when satisfied.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <FeatureTag color="primary" label="Local Pickup" />
                <FeatureTag color="primary" label="Direct WhatsApp Contact" />
              </div>
            </div>
            <div className="group rounded-[40px] border-2 border-transparent bg-secondary p-10 transition-colors hover:border-border">
              <div className="mb-8 flex items-start justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-foreground text-background shadow-elegant">
                  <MapPin className="h-8 w-8" />
                </div>
                <span className="rounded-full bg-foreground/10 px-4 py-1.5 text-xs font-bold tracking-wide text-foreground">
                  LOCAL FIRST
                </span>
              </div>
              <h3 className="font-display text-2xl tracking-tight text-foreground">Find books near you</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Discover books by city and state, then chat directly with verified sellers to agree
                pickup, handover, and payment details.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <FeatureTag color="foreground" label="City/State Discovery" icon={MapPin} />
                <FeatureTag color="foreground" label="Verified Profiles" icon={ShieldCheck} />
              </div>
            </div>
          </div>
        </section>

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
                  <h3 className="mt-6 font-display text-lg tracking-tight text-foreground">{t.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative overflow-hidden bg-secondary/40 py-24">
          <div aria-hidden className="absolute inset-0 -z-10">
            <div className="absolute left-1/4 top-0 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[100px]" />
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
            <StaggerTestimonials />
          </div>
        </section>

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
      {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  );
}
