import type { CategoryValue, ConditionValue, DeliveryType, ListingStatus } from "./constants";

export interface Listing {
  id: string;
  title: string;
  author: string;
  category: CategoryValue;
  edition: string;
  originalPrice: number;
  sellingPrice: number;
  condition: ConditionValue;
  state: string;
  city: string;
  deliveryType: DeliveryType;
  description: string;
  images: string[];
  videoUrl?: string;
  sellerName: string;
  sellerUid: string;
  status: ListingStatus;
  createdAt: string | null;
  updatedAt: string | null;
  views?: number;
  shares?: number;
}

export type FulfillmentMode = "protected_delivery";

export interface CheckoutDeliveryAddress {
  name: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface PickupAddressSnapshot {
  pickupLocationName?: string;
  name: string;
  phone: string;
  email?: string;
  address1?: string;
  address2?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  landmark?: string;
  location?: string | null;
  placeId?: string;
  formattedAddress?: string;
  lat?: number;
  lon?: number;
  sellerConfirmed?: boolean;
  pinConfirmedAt?: string | null;
  googleValidatedAt?: string | null;
  isCourierReady?: boolean;
  validationLevel?: "google_validated" | "needs_more_detail" | "failed" | null;
  googleValidation?: {
    addressComplete?: boolean;
    validationGranularity?: string | null;
    geocodeGranularity?: string | null;
    reasonCodes?: string[];
    message?: string;
  } | null;
}

export interface OrderItemSnapshot {
  listingId: string;
  sellerUid: string;
  title: string;
  author: string;
  image: string;
  category: string;
  condition: string;
  price: number;
  quantity: 1;
  estimatedWeightKg: number;
}

export function summarizeOrderItems(items: OrderItemSnapshot[]): string {
  if (items.length === 0) return "your books";
  if (items.length === 1) return items[0]?.title || "your book";
  const [first] = items;
  return `${first?.title || "Your book"} + ${items.length - 1} more book${items.length > 2 ? "s" : ""}`;
}

export interface Offer {
  id: string;
  listingId: string;
  listingTitle: string;
  listingPrice: number;
  sellerUid: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string | null;
  amount: number;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string | null;
}
