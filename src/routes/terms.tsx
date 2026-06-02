import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { FileText, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — BookVerse" },
      {
        name: "description",
        content:
          "Terms of Service for BookVerse, India's peer-to-peer educational books marketplace operated by The Technology Fiction.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[var(--gradient-hero)]" />
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <FileText className="h-3 w-3 text-teal" /> Legal
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              For BookVerse, operated by The Technology Fiction
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
          {/* Disclaimer */}
          <div className="mb-10 rounded-2xl border border-gold/40 bg-gold/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <p className="text-sm leading-relaxed text-foreground/90">
                These pages are draft legal templates for MVP use and should be reviewed by a
                qualified legal professional before large-scale public launch.
              </p>
            </div>
          </div>

          <div className="space-y-10">
            <Section title="About BookVerse">
              <p>
                BookVerse is an educational books marketplace that connects individual buyers and
                sellers across India. It is designed to help students, graduates, and working
                professionals buy and sell used educational books — from engineering and medical
                textbooks to competitive exam preparation material.
              </p>
              <p>
                BookVerse is a peer-to-peer platform. We do not directly sell books, hold inventory,
                or act as a party to any transaction between users.
              </p>
            </Section>

            <Section title="Role of The Technology Fiction">
              <p>
                BookVerse is operated under The Technology Fiction, a platform focused on technical
                careers, learning, Salesforce, systems thinking, and practical education. The
                Technology Fiction provides the technology, infrastructure, and moderation support
                for BookVerse, but does not guarantee any specific outcome from transactions
                conducted on the platform.
              </p>
            </Section>

            <Section title="User Eligibility">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>You must be at least 16 years old to use BookVerse.</li>
                <li>
                  You must provide accurate information during sign-up and keep your profile
                  updated.
                </li>
                <li>You may be required to sign in using a Google account.</li>
                <li>Accounts created with false information may be suspended without notice.</li>
              </ul>
            </Section>

            <Section title="Buyer Responsibilities">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Buyers are responsible for verifying the book title, edition, condition, price,
                  and delivery method before making any payment.
                </li>
                <li>
                  Contact sellers via the provided WhatsApp number to confirm availability and
                  negotiate terms.
                </li>
                <li>
                  Do not share sensitive payment information on the platform chat or public
                  listings.
                </li>
                <li>Report misleading listings or suspicious behavior using the report feature.</li>
              </ul>
            </Section>

            <Section title="Seller Responsibilities">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  Sellers must own the books they list or have proper authorization to sell them.
                </li>
                <li>
                  Listings should include clear photos, accurate descriptions, honest condition
                  ratings, and a fair price.
                </li>
                <li>Sellers must respond to buyer inquiries in a reasonable timeframe.</li>
                <li>
                  Once a book is sold, the seller is expected to remove or mark the listing
                  accordingly.
                </li>
              </ul>
            </Section>

            <Section title="Listing Accuracy">
              <p>
                All listings are reviewed by our team before they appear publicly. However, sellers
                are solely responsible for the accuracy of their listings. Misleading titles,
                incorrect editions, stock photos passed off as actual books, or incorrect pricing
                may result in listing rejection or account suspension.
              </p>
            </Section>

            <Section title="Prohibited Listings and Content">
              <p>You may not list or promote:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Pirated, counterfeit, or unauthorized copies of books.</li>
                <li>Non-educational items (electronics, clothing, general goods).</li>
                <li>Content that is illegal, offensive, discriminatory, or harmful.</li>
                <li>
                  Services, coaching classes, or digital products unrelated to physical books.
                </li>
                <li>
                  Listings with external links meant to drive traffic away from BookVerse for
                  unrelated commercial purposes.
                </li>
              </ul>
            </Section>

            <Section title="Payments">
              <p>
                BookVerse does not currently process payments. All payments are handled directly
                between the buyer and the seller — typically via UPI, bank transfer, cash on
                delivery, or any mutually agreed method. BookVerse is not responsible for payment
                disputes, failed transactions, or fraud arising from direct payments.
              </p>
            </Section>

            <Section title="Shipping and Local Pickup">
              <p>
                Delivery arrangements (shipping, courier, local meet-up, or pickup) are the sole
                responsibility of the buyer and seller. BookVerse does not provide logistics,
                packaging, or delivery services. We recommend using trusted courier services for
                inter-city shipping and meeting in safe public places for local exchanges.
              </p>
            </Section>

            <Section title="No Guarantee of Book Condition">
              <p>
                BookVerse verifies listings at a high level, but we do not inspect every physical
                book. The condition described in the listing is the seller's representation. Buyers
                should request additional photos or clarification before completing a purchase.
                BookVerse does not guarantee the accuracy of condition descriptions.
              </p>
            </Section>

            <Section title="Right to Remove Listings and Users">
              <p>
                BookVerse reserves the right to remove any listing, suspend any user account, or
                restrict platform access at any time — with or without notice — if we believe the
                user has violated these terms, posted prohibited content, or engaged in behavior
                harmful to the community.
              </p>
            </Section>

            <Section title="Limitation of Liability">
              <p>
                To the maximum extent permitted by applicable law, The Technology Fiction and
                BookVerse shall not be liable for any direct, indirect, incidental, or consequential
                damages arising from your use of the platform, including but not limited to failed
                transactions, book quality disputes, delivery delays, or personal safety incidents
                during meet-ups.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                For questions about these terms, please reach out through the platform or contact
                The Technology Fiction directly.
              </p>
            </Section>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
