import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <BookOpen className="h-4 w-4" />
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
            <h4 className="text-sm font-semibold">Categories</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/browse" search={{ category: "engineering" } as never} className="hover:text-foreground">Engineering</Link></li>
              <li><Link to="/browse" search={{ category: "medical" } as never} className="hover:text-foreground">Medical</Link></li>
              <li><Link to="/browse" search={{ category: "jee" } as never} className="hover:text-foreground">JEE</Link></li>
              <li><Link to="/browse" search={{ category: "neet" } as never} className="hover:text-foreground">NEET</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} BookVerse. Made for learners across India.
        </div>
      </div>
    </footer>
  );
}
