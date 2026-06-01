import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RotateCcw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refunds & Returns — BookVerse" },
      { name: "description", content: "Refund and return policy for BookVerse, India's peer-to-peer educational books marketplace operated by The Technology Fiction." },
    ],
  }),
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[var(--gradient-hero)]" />
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <RotateCcw className="h-3 w-3 text-teal" /> Legal
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Refunds & Returns
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              How returns and refunds work on BookVerse
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6 lg:px-8">
          {/* Disclaimer */}
          <div className="mb-10 rounded-2xl border border-gold/40 bg-gold/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
              <p className="text-sm leading-relaxed text-foreground/90">
                These pages are draft legal templates for MVP use and should be reviewed by a qualified legal professional before large-scale public launch.
              </p>
            </div>
          </div>

          <div className="space-y-10">
            <Section title="No Platform-Managed Payments">
              <p>
                BookVerse does not currently process payments, hold funds, or facilitate checkout on the platform. All transactions are conducted directly between the buyer and the seller — typically via UPI, bank transfer, cash on delivery, or any other mutually agreed payment method.
              </p>
              <p>
                Because of this, BookVerse cannot issue refunds, process chargebacks, or reverse payments. Any refund or return must be arranged directly between the buyer and seller.
              </p>
            </Section>

            <Section title="Buyer Responsibilities Before Purchase">
              <p>Before completing any purchase, buyers should:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Verify the exact book title, author, and edition from the listing.</li>
                <li>Review all uploaded photos carefully to assess physical condition.</li>
                <li>Confirm the price, shipping cost (if any), and delivery method with the seller.</li>
                <li>Ask the seller any questions about markings, wear, missing pages, or included accessories.</li>
                <li>Agree on a payment method and delivery timeline that both parties are comfortable with.</li>
              </ul>
            </Section>

            <Section title="Seller Responsibilities">
              <p>Sellers are expected to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Disclose the true condition of the book, including any damage, markings, or missing components.</li>
                <li>Provide clear, original photos that accurately represent the actual item.</li>
                <li>State their preferred payment methods and shipping or pickup terms upfront.</li>
                <li>Package books securely if shipping, and provide tracking information when possible.</li>
                <li>Honor any return or refund commitments they personally make to the buyer.</li>
              </ul>
            </Section>

            <Section title="Dispute Resolution">
              <p>
                If a transaction goes wrong — for example, the book received does not match the description, or a seller fails to deliver — BookVerse may assist by reviewing the report, contacting the involved parties, or removing problematic listings. However, BookVerse is not liable for monetary losses arising from direct transactions between users.
              </p>
              <p>
                We strongly encourage buyers and sellers to communicate clearly, document agreements in writing (e.g., WhatsApp chat), and use trusted payment methods.
              </p>
            </Section>

            <Section title="When to Report a Problem">
              <p>Please report a listing or user if you experience:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>A listing with false or misleading information.</li>
                <li>A seller who repeatedly fails to deliver or respond.</li>
                <li>A buyer who engages in harassment or fraudulent behavior.</li>
                <li>Scam attempts or requests for unusual payment methods.</li>
              </ul>
              <p>
                Reports help us keep BookVerse safe, but they do not automatically result in financial compensation.
              </p>
            </Section>

            <Section title="Future Platform-Managed Transactions">
              <p>
                If BookVerse introduces platform-managed payments, escrow, or shipping integrations in the future, a separate refund and return policy will apply to those transactions. This page will be updated at that time, and users will be notified in advance.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                For questions about refunds, returns, or a specific transaction issue, please reach out through the platform or contact The Technology Fiction directly.
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
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
