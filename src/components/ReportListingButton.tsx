import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { createReport, REPORT_REASONS, type ReportReason } from "@/lib/reports";
import type { Listing } from "@/lib/types";

export function ReportListingButton({ listing }: { listing: Listing }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("fake");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOwner = user?.uid === listing.sellerUid;
  if (isOwner) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await createReport({
        listingId: listing.id,
        listingTitle: listing.title,
        sellerUid: listing.sellerUid,
        reason,
        details: details.trim().slice(0, 1000),
        reporterUid: user?.uid ?? null,
        reporterEmail: user?.email ?? null,
      });
      toast.success("Report submitted. Thanks for helping keep BookVerse safe.");
      setOpen(false);
      setDetails("");
      setReason("fake");
    } catch {
      toast.error("Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-destructive"
        >
          <Flag className="h-3.5 w-3.5" /> Report this listing
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report listing</DialogTitle>
          <DialogDescription>
            Let us know what's wrong with "{listing.title}". Our team will review it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block text-sm font-semibold">Reason</Label>
            <RadioGroup
              value={reason}
              onValueChange={(v) => setReason(v as ReportReason)}
              className="space-y-2"
            >
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem id={`reason-${r.value}`} value={r.value} />
                  <Label htmlFor={`reason-${r.value}`} className="text-sm font-normal">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label htmlFor="report-details" className="mb-2 block text-sm font-semibold">
              Additional details{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add anything that helps us investigate…"
              maxLength={1000}
              rows={4}
            />
            <div className="mt-1 text-right text-xs text-muted-foreground">
              {details.length}/1000
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit report
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
