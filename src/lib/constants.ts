export const CATEGORIES = [
  { value: "engineering", label: "Engineering" },
  { value: "medical", label: "Medical" },
  { value: "jee", label: "JEE" },
  { value: "neet", label: "NEET" },
  { value: "gate", label: "GATE" },
  { value: "upsc", label: "UPSC" },
  { value: "ssc", label: "SSC" },
  { value: "banking", label: "Banking" },
  { value: "mba", label: "MBA" },
  { value: "ca-cs-cma", label: "CA/CS/CMA" },
  { value: "it-certifications", label: "IT Certifications" },
  { value: "programming", label: "Programming" },
  { value: "other", label: "Other" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const CONDITIONS = [
  { value: "like_new", label: "Like New", description: "Barely used, looks new" },
  { value: "good", label: "Good", description: "Light usage, minor marks" },
  { value: "acceptable", label: "Acceptable", description: "Noticeable wear, fully readable" },
  { value: "heavy_usage", label: "Heavy Usage", description: "Significant wear, all pages intact" },
] as const;

export type ConditionValue = (typeof CONDITIONS)[number]["value"];

export const DELIVERY_TYPES = [
  { value: "local", label: "Local Pickup Only" },
  { value: "shipping", label: "Shipping Available Across India" },
] as const;

export type DeliveryType = (typeof DELIVERY_TYPES)[number]["value"];

export type ListingStatus = "pending" | "approved" | "rejected" | "sold";

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const conditionLabel = (v: string) =>
  CONDITIONS.find((c) => c.value === v)?.label ?? v;
export const deliveryLabel = (v: string) =>
  DELIVERY_TYPES.find((d) => d.value === v)?.label ?? v;
