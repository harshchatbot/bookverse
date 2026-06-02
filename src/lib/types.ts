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
}
