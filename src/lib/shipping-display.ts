export type ServiceabilitySource = "shiprocket" | "mock" | "fallback";

export function normalizeServiceabilitySource(value: unknown): ServiceabilitySource {
  return value === "shiprocket" || value === "fallback" ? value : "mock";
}

export function isPlaceholderCourierName(
  courierName: string | null | undefined,
  source?: ServiceabilitySource | null,
) {
  const normalizedSource = source ? normalizeServiceabilitySource(source) : null;
  const normalizedName = (courierName ?? "").trim().toLowerCase();
  return (
    normalizedSource !== "shiprocket" ||
    !normalizedName ||
    normalizedName === "mock courier"
  );
}

export function getCustomerFacingCourierName(
  courierName: string | null | undefined,
  source?: ServiceabilitySource | null,
) {
  return isPlaceholderCourierName(courierName, source) ? null : (courierName ?? "").trim();
}

export function getCustomerFacingCourierMessage(
  courierName: string | null | undefined,
  source?: ServiceabilitySource | null,
) {
  const displayName = getCustomerFacingCourierName(courierName, source);
  return displayName
    ? `Courier: ${displayName}`
    : "Delivery partner will be assigned after shipment processing.";
}
