import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Shield, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BookVerse" },
      { name: "description", content: "Privacy Policy for BookVerse, India's peer-to-peer educational books marketplace operated by The Technology Fiction." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[var(--gradient-hero)]" />
          <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Shield className="h-3 w-3 text-teal" /> Legal
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              How BookVerse collects, uses, and protects your information
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
            <Section title="Data We Collect">
              <p>When you use BookVerse, we may collect the following information:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong>Name and email address</strong> — via Google sign-in or profile updates.</li>
                <li><strong>Profile photo</strong> — from your linked Google account.</li>
                <li><strong>Phone number</strong> — if you choose to add it to your profile or listing.</li>
                <li><strong>City or location</strong> — to help buyers find books nearby.</li>
                <li><strong>Listing details</strong> — book title, description, price, condition, category, and photos you upload.</li>
                <li><strong>Activity data</strong> — wishlist items, offers made, notifications received, and report submissions.</li>
                <li><strong>Device and usage data</strong> — browser type, IP address, and pages visited, primarily for security and performance.</li>
              </ul>
            </Section>

            <Section title="How We Use Your Data">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>To create and manage your account.</li>
                <li>To display your listings to potential buyers.</li>
                <li>To enable marketplace safety features like reporting and moderation.</li>
                <li>To send notifications about offers, listing approvals, or account activity.</li>
                <li>To improve the platform, fix bugs, and understand how users interact with BookVerse.</li>
              </ul>
            </Section>

            <Section title="Third-Party Services">
              <p>BookVerse relies on the following services to operate:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li><strong>Firebase Authentication</strong> — for secure sign-in and account management.</li>
                <li><strong>Firestore</strong> — to store user profiles, listings, offers, and activity data.</li>
                <li><strong>Firebase Storage</strong> — to store book photos and user-uploaded images.</li>
                <li><strong>Analytics tools</strong> — we may add privacy-friendly analytics in the future to understand platform usage. If added, this policy will be updated.</li>
              </ul>
              <p>
                These services are provided by Google and are subject to their respective privacy policies and data processing terms.
              </p>
            </Section>

            <Section title="Data Sharing">
              <p>
                We do not sell your personal data. Your contact information is shared only as you choose — for example, when you list a book, your displayed name and city are visible to other users. If you include a WhatsApp number in a listing, that is visible to potential buyers.
              </p>
              <p>
                We may disclose information if required by law, to enforce our terms, or to protect the rights and safety of our users.
              </p>
            </Section>

            <Section title="Your Rights">
              <ul className="list-disc space-y-1.5 pl-5">
                <li>You can update your profile information at any time.</li>
                <li>You can request deletion of your account and associated data by contacting us.</li>
                <li>You can request correction of inaccurate information.</li>
                <li>You can opt out of non-essential notifications in your account settings.</li>
              </ul>
            </Section>

            <Section title="Data Security">
              <p>
                We use industry-standard practices to protect your data, including secure authentication via Firebase, encrypted data transmission, and access controls on our database. However, no internet-based service can guarantee 100% security. Please use strong passwords and avoid sharing sensitive information in public listings.
              </p>
            </Section>

            <Section title="Data Retention">
              <p>
                We retain your account and listing data for as long as your account is active. If you delete your account, we will remove your personal data from active systems within a reasonable timeframe, though some data may remain in backups or logs for legal or technical reasons.
              </p>
            </Section>

            <Section title="Children's Privacy">
              <p>
                BookVerse is not intended for children under 16. We do not knowingly collect personal information from children. If you believe we have inadvertently collected data from a child, please contact us and we will delete it promptly.
              </p>
            </Section>

            <Section title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. Significant changes will be communicated via email or a notice on the platform. Continued use of BookVerse after changes constitutes acceptance of the updated policy.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                For privacy-related questions, data deletion requests, or concerns about how your information is handled, please reach out through the platform or contact The Technology Fiction directly.
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
