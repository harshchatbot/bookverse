import { cn } from "@/lib/utils";

type Variant = "books" | "search" | "wishlist" | "orders" | "leaf";

type Props = {
  variant?: Variant;
  className?: string;
  size?: number;
};

/**
 * Friendly inline SVG illustrations using the BookVerse palette.
 * No external assets — all colors come from semantic tokens.
 */
export function Illustration({ variant = "books", className, size = 220 }: Props) {
  const common = {
    width: size,
    height: size * 0.75,
    viewBox: "0 0 320 240",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true as const,
    className: cn("max-w-full", className),
  };

  if (variant === "search") {
    return (
      <svg {...common}>
        <ellipse cx="160" cy="210" rx="120" ry="12" className="fill-muted/30" />
        <circle cx="140" cy="110" r="62" className="fill-accent/50 stroke-primary" strokeWidth="3" />
        <circle cx="140" cy="110" r="46" className="fill-card" />
        <path d="M186 156 L228 198" className="stroke-primary" strokeWidth="10" strokeLinecap="round" />
        <path d="M118 110 h44 M118 124 h32" className="stroke-primary/60" strokeWidth="3" strokeLinecap="round" />
        <path d="M118 96 h44" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "wishlist") {
    return (
      <svg {...common}>
        <ellipse cx="160" cy="210" rx="120" ry="12" className="fill-muted/30" />
        <path
          d="M160 198 C 80 150, 56 110, 86 80 C 110 56, 140 70, 160 96 C 180 70, 210 56, 234 80 C 264 110, 240 150, 160 198 Z"
          className="fill-accent/50 stroke-primary"
          strokeWidth="3"
        />
        <path d="M120 96 c 10 -14, 30 -14, 40 0" className="stroke-primary" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  if (variant === "orders") {
    return (
      <svg {...common}>
        <ellipse cx="160" cy="210" rx="120" ry="12" className="fill-muted/30" />
        <rect x="80" y="90" width="160" height="100" rx="8" className="fill-accent/40 stroke-primary" strokeWidth="3" />
        <path d="M80 120 h160" className="stroke-primary" strokeWidth="3" />
        <path d="M140 90 v-20 h40 v20" className="stroke-primary" strokeWidth="3" fill="none" />
        <circle cx="160" cy="155" r="14" className="fill-card stroke-primary" strokeWidth="3" />
        <path d="M153 155 l5 5 l9 -10" className="stroke-primary" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (variant === "leaf") {
    return (
      <svg {...common}>
        <path d="M60 200 C 90 120, 180 60, 280 60 C 270 160, 200 210, 90 210 Z" className="fill-accent/50 stroke-primary" strokeWidth="3" />
        <path d="M90 210 C 140 170, 200 130, 270 80" className="stroke-primary" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    );
  }

  // default: stack of books
  return (
    <svg {...common}>
      <ellipse cx="160" cy="210" rx="120" ry="12" className="fill-muted/30" />
      <rect x="80" y="160" width="160" height="36" rx="4" className="fill-primary" />
      <rect x="96" y="118" width="128" height="42" rx="4" className="fill-accent stroke-primary" strokeWidth="3" />
      <rect x="120" y="70" width="80" height="48" rx="4" className="fill-card stroke-primary" strokeWidth="3" />
      <path d="M132 90 h56 M132 102 h40" className="stroke-primary/70" strokeWidth="3" strokeLinecap="round" />
      <path d="M210 70 q 6 -14, 18 -10 q -2 12, -14 16 Z" className="fill-primary" />
    </svg>
  );
}
