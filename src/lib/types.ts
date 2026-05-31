import type { Timestamp } from "firebase/firestore";
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
  city: string;
  deliveryType: DeliveryType;
  description: string;
  images: string[];
  sellerName: string;
  sellerMobile: string;
  sellerUid: string;
  sellerEmail: string;
  status: ListingStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  views?: number;
}
