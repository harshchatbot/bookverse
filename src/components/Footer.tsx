import { Link } from "@tanstack/react-router";
const bookverseLogo = { url: "/assets/logo/bookverse-logo.webp" };

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold" aria-label="BookVerse home">
              <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-primary/30 bg-gradient-to-br from-primary/25 via-accent-surface to-primary/40 shadow-sm">
                <img src={bookverseLogo.url} alt="" width={48} height={48} loading="lazy" decoding="async" className="h-full w-full object-contain p-0.15" />
              </span>
              BookVerse
            </Link>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              India's marketplace for educational books. Don't let your books become scrap —
              pass them on to the next learner.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Explore</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/browse" className="hover:text-foreground">Browse books</Link></li>
              <li><Link to="/sell" className="hover:text-foreground">Sell a book</Link></li>
              <li><Link to="/about" className="hover:text-foreground">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link to="/refunds" className="hover:text-foreground">Refunds & Returns</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 space-y-2 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>© 2026 BookVerse. Made for learners across India.</p>
          <p>
            A unit of{" "}
            <a
              href="https://www.thetechnologyfiction.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              The Technology Fiction
            </a>
            .
          </p>
          <p>
            Made with <span aria-label="love" className="text-destructive">♥</span> by{" "}
            <a
              href="https://www.techfilabs.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              TechFi Labs
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
