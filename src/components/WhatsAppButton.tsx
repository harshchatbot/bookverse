import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { Listing } from "@/lib/types";
import { useMarketplaceAccess } from "@/hooks/useMarketplaceAccess";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { createBookInquiry } from "@/lib/inquiries";
import { getUserProfile } from "@/lib/users";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function openListingWhatsApp({
  listing,
  access,
}: {
  listing: Listing;
  access: ReturnType<typeof useMarketplaceAccess>;
}) {
  if (!access.ensureAccess("contact") || !access.user) return;

  if (listing.sellerUid === access.user.uid) {
    toast.error("This is your own listing. Buyers will contact you on WhatsApp after approval.");
    return;
  }

  const seller = await getUserProfile(listing.sellerUid);
  const mobile = seller?.whatsappNumber || seller?.mobile || "";

  if (!mobile) {
    toast.error("Seller contact is not available yet.");
    console.error("[whatsapp] seller mobile missing", {
      sellerUid: listing.sellerUid,
      seller,
    });
    return;
  }

  let whatsappUrl = "";
  try {
    whatsappUrl = getWhatsAppUrl(listing, mobile);
  } catch (error) {
    console.error("[whatsapp] invalid seller mobile", {
      sellerUid: listing.sellerUid,
      mobile,
      error,
    });
    toast.error("Seller WhatsApp number is invalid.");
    return;
  }

  try {
    await createBookInquiry({
      listingId: listing.id,
      listingTitle: listing.title,
      sellerUid: listing.sellerUid,
      buyerUid: access.user.uid,
      buyerName: access.profile?.name || access.user.displayName || access.user.email || "Buyer",
    });
  } catch (error) {
    console.error("[whatsapp] failed to create inquiry", {
      listingId: listing.id,
      sellerUid: listing.sellerUid,
      buyerUid: access.user.uid,
      error,
    });
    toast.error(`Could not create inquiry: ${getErrorMessage(error)}`);
    return;
  }

  const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");

  if (!opened) {
    console.error("[whatsapp] window.open blocked", { whatsappUrl });
    toast.error("Popup blocked. Please allow popups for BookVerse and try again.");
    return;
  }
}

export function WhatsAppButton({
  listing,
  className = "",
}: {
  listing: Listing;
  className?: string;
}) {
  const access = useMarketplaceAccess();
  const [opening, setOpening] = useState(false);

  const openWhatsApp = async () => {
    if (opening) return;
    setOpening(true);

    try {
      await openListingWhatsApp({ listing, access });
    } catch (error) {
      console.error("[whatsapp] unexpected failure", error);
      toast.error(`Could not open WhatsApp: ${getErrorMessage(error)}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      onClick={openWhatsApp}
      disabled={opening}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-whatsapp px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-elegant transition-transform hover:scale-[1.02] ${className}`}
    >
      {opening ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <MessageCircle className="h-5 w-5" />
      )}
      {opening ? "Opening WhatsApp..." : "Contact Seller on WhatsApp"}
    </button>
  );
}

export function WhatsAppIconLink({
  listing,
  className = "",
}: {
  listing: Listing;
  className?: string;
}) {
  const access = useMarketplaceAccess();
  const [opening, setOpening] = useState(false);

  const openWhatsApp = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();

    if (opening) return;
    setOpening(true);

    try {
      await openListingWhatsApp({ listing, access });
    } catch (error) {
      console.error("[whatsapp] unexpected failure", error);
      toast.error(`Could not open WhatsApp: ${getErrorMessage(error)}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <button
      type="button"
      title="Contact seller on WhatsApp"
      onClick={openWhatsApp}
      disabled={opening}
      className={`inline-flex items-center gap-1 rounded-full bg-whatsapp px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:scale-[1.02] ${className}`}
    >
      {opening ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <MessageCircle className="h-3.5 w-3.5" />
      )}
      {opening ? "Opening" : "WhatsApp"}
    </button>
  );
}
