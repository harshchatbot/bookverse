import { cn } from "@/lib/utils";

type SpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

/**
 * BookVerse spinner — an open book whose pages turn, with a leaf orbiting above.
 * Uses semantic tokens (primary / accent / muted) so it adapts to the theme.
 */
export function Spinner({ size = 56, label, className }: SpinnerProps) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* soft halo */}
        <circle cx="32" cy="34" r="26" className="fill-accent/40" />
        {/* book base */}
        <path
          d="M10 22h18c2.2 0 4 1.8 4 4v22H14c-2.2 0-4-1.8-4-4V22z"
          className="fill-card stroke-primary"
          strokeWidth="2"
        />
        <path
          d="M54 22H36c-2.2 0-4 1.8-4 4v22h18c2.2 0 4-1.8 4-4V22z"
          className="fill-card stroke-primary"
          strokeWidth="2"
        />
        {/* turning page */}
        <g style={{ transformOrigin: "32px 26px", animation: "bv-flip 1.6s ease-in-out infinite" }}>
          <path
            d="M32 26 L18 26 L18 46 L32 46 Z"
            className="fill-primary/15 stroke-primary"
            strokeWidth="1.5"
          />
        </g>
        {/* orbiting leaf */}
        <g style={{ transformOrigin: "32px 32px", animation: "bv-orbit 2.4s linear infinite" }}>
          <path d="M32 6c4 2 6 5 6 9s-3 7-6 7-6-3-6-7 2-7 6-9z" className="fill-primary" />
          <path d="M32 8v14" className="stroke-card" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <style>{`
          @keyframes bv-flip {
            0%, 100% { transform: rotateY(0deg); }
            50% { transform: rotateY(-150deg); }
          }
          @keyframes bv-orbit {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </svg>
      {label ? <p className="text-sm font-medium text-muted-foreground">{label}</p> : null}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Full-page centered spinner with the BookVerse mark. */
export function PageSpinner({ label = "Loading your shelf…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner size={72} label={label} />
    </div>
  );
}
