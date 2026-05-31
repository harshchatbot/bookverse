import { ShieldCheck } from "lucide-react";

export function hasValidMobile(mobile: string | undefined | null): boolean {
  if (!mobile) return false;
  const digits = mobile.replace(/\D/g, "");
  return digits.length >= 10;
}

export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ${className}`}
      title="This user has provided a valid mobile number"
    >
      <ShieldCheck className="h-3 w-3" />
      Verified Mobile
    </span>
  );
}
