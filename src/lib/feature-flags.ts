export function isProtectedDeliveryEnabled() {
  return import.meta.env.VITE_ENABLE_PROTECTED_DELIVERY === "true";
}
