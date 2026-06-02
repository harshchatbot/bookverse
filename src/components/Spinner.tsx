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



type FullScreenLoaderProps = {
  open: boolean;
  title?: string;
  message?: string;
  progress?: number;
};

export function FullScreenLoader({
  open,
  title = "Please wait…",
  message = "We are working on it.",
  progress,
}: FullScreenLoaderProps) {
  if (!open) return null;

  const safeProgress =
    typeof progress === "number" ? Math.min(100, Math.max(0, Math.round(progress))) : null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/85 px-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fullscreen-loader-title"
      aria-describedby="fullscreen-loader-message"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-elegant">
        <Spinner size={84} label={title} />

        <p id="fullscreen-loader-title" className="sr-only">
          {title}
        </p>

        <p id="fullscreen-loader-message" className="mt-3 text-sm text-muted-foreground">
          {message}
        </p>

        {safeProgress !== null ? (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Upload progress</span>
              <span>{safeProgress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-label="Listing upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={safeProgress}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${safeProgress}%` }}
              />
            </div>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Please don’t close this tab until your listing is submitted.
        </p>
      </div>
    </div>
  );
}
