export interface SellerPickupAddress {
  id: string;
  userUid: string;
  pickupLocationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  country: "India";
  pincode: string;
  isDefault: boolean;
  shiprocketPickupId: string | null;
  verifiedByShiprocket: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

// Future Shiprocket pickup location support only. Do not collect this during V1 onboarding.
// Shiprocket pickup location needs a courier-ready pickup contact/address. Typical fields include:
// pickup_location / pickupLocationName, shipper name, email, phone, address line, city, state,
// country, and pincode.
export interface BuyerDeliveryAddress {
  id: string;
  userUid: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  country: "India";
  pincode: string;
  isDefault: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
