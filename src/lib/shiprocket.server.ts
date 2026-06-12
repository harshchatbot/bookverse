// Minimal Shiprocket REST client. Token cached in module scope per worker.
// Docs: https://apidocs.shiprocket.in/

const BASE = "https://apiv2.shiprocket.in/v1/external";

function getShiprocketMode(): "live" | "mock" {
  return (process.env.SHIPROCKET_MODE ?? "").trim().toLowerCase() === "live" ? "live" : "mock";
}

function getRazorpayMode(): "live" | "test" {
  return (process.env.RAZORPAY_MODE ?? "").trim().toLowerCase() === "test" ? "test" : "live";
}

function shouldUseMockServiceability() {
  return getRazorpayMode() === "test" || getShiprocketMode() !== "live";
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) throw new Error("SHIPROCKET_EMAIL/PASSWORD not set");

  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shiprocket auth failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { token: string };
  cached = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token;
}

async function srFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shiprocket ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

export interface ServiceabilityResult {
  available: boolean;
  rate: number;
  courierId: number;
  courierName: string;
  etd: string | null;
  raw: unknown;
}

export async function checkServiceability(opts: {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number; // kg, e.g. 0.5
  declaredValue: number; // INR
  cod?: boolean;
}): Promise<ServiceabilityResult> {
  if (shouldUseMockServiceability()) {
    console.info("[shiprocket/serviceability] using mock serviceability", {
      razorpayMode: getRazorpayMode(),
      shiprocketMode: getShiprocketMode(),
      pickupPincode: opts.pickupPincode,
      deliveryPincode: opts.deliveryPincode,
      weightKg: opts.weightKg,
      declaredValue: opts.declaredValue,
    });
    return {
      available: true,
      rate: 60,
      courierId: 0,
      courierName: "Mock Courier",
      etd: null,
      raw: {
        mode: "mock",
        reason: getRazorpayMode() === "test" ? "razorpay_test_mode" : "shiprocket_not_live",
      },
    };
  }

  const params = new URLSearchParams({
    pickup_postcode: opts.pickupPincode,
    delivery_postcode: opts.deliveryPincode,
    weight: String(opts.weightKg),
    cod: opts.cod ? "1" : "0",
    declared_value: String(opts.declaredValue),
  });
  type Resp = {
    status: number;
    data?: {
      available_courier_companies?: Array<{
        courier_company_id: number;
        courier_name: string;
        rate: number;
        etd: string;
      }>;
    };
  };
  const data = await srFetch<Resp>(`/courier/serviceability/?${params.toString()}`);
  const couriers = data.data?.available_courier_companies ?? [];
  if (couriers.length === 0) {
    return { available: false, rate: 0, courierId: 0, courierName: "", etd: null, raw: data };
  }
  // Pick cheapest.
  const cheapest = couriers.reduce((a, b) => (a.rate <= b.rate ? a : b));
  return {
    available: true,
    rate: Math.ceil(cheapest.rate),
    courierId: cheapest.courier_company_id,
    courierName: cheapest.courier_name,
    etd: cheapest.etd ?? null,
    raw: data,
  };
}

export interface CreateOrderInput {
  orderId: string;
  orderDate: string; // YYYY-MM-DD HH:mm
  pickup: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    location?: string; // Shiprocket pickup nickname; defaults to "Primary"
  };
  buyer: {
    name: string;
    phone: string;
    email: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  items: Array<{
    name: string;
    sku: string;
    unitsPriceInr: number;
    quantity: number;
  }>;
  weightKg: number;
  parcel: {
    lengthCm: number;
    breadthCm: number;
    heightCm: number;
  };
  paymentMethod: "Prepaid" | "COD";
  subtotalInr: number;
}

export interface CreateOrderResult {
  shiprocketOrderId: number;
  shipmentId: number;
  status: string;
  raw: unknown;
}

export async function createShiprocketOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const body = {
    order_id: input.orderId,
    order_date: input.orderDate,
    pickup_location: input.pickup.location ?? "Primary",
    billing_customer_name: input.buyer.name.split(" ")[0] || input.buyer.name,
    billing_last_name: input.buyer.name.split(" ").slice(1).join(" ") || ".",
    billing_address: input.buyer.address1,
    billing_address_2: input.buyer.address2,
    billing_city: input.buyer.city,
    billing_pincode: input.buyer.pincode,
    billing_state: input.buyer.state,
    billing_country: input.buyer.country,
    billing_email: input.buyer.email,
    billing_phone: input.buyer.phone,
    shipping_is_billing: true,
    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.quantity,
      selling_price: item.unitsPriceInr,
    })),
    payment_method: input.paymentMethod,
    sub_total: input.subtotalInr,
    length: input.parcel.lengthCm,
    breadth: input.parcel.breadthCm,
    height: input.parcel.heightCm,
    weight: input.weightKg,
  };
  type Resp = {
    order_id: number;
    shipment_id: number;
    status: string;
    status_code?: number;
  };
  const data = await srFetch<Resp>(`/orders/create/adhoc`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return {
    shiprocketOrderId: data.order_id,
    shipmentId: data.shipment_id,
    status: data.status,
    raw: data,
  };
}

export interface AssignAwbResult {
  awb: string;
  courierCompanyId: number;
  courierName: string;
  raw: unknown;
}

/**
 * Assign an AWB (waybill) to a Shiprocket shipment.
 * If courierId is omitted, Shiprocket picks the recommended courier.
 */
export async function assignAwb(opts: {
  shipmentId: number;
  courierId?: number;
}): Promise<AssignAwbResult> {
  type Resp = {
    awb_assign_status?: number;
    status?: number;
    message?: string;
    response?: {
      data?: {
        awb_code?: string;
        courier_company_id?: number;
        courier_name?: string;
      };
    };
  };
  const body: Record<string, unknown> = { shipment_id: opts.shipmentId };
  if (opts.courierId) body.courier_id = opts.courierId;
  const data = await srFetch<Resp>(`/courier/assign/awb`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const awb = data.response?.data?.awb_code;
  if (!awb) {
    throw new Error(`Shiprocket AWB assignment returned no awb: ${JSON.stringify(data)}`);
  }
  return {
    awb,
    courierCompanyId: data.response?.data?.courier_company_id ?? 0,
    courierName: data.response?.data?.courier_name ?? "",
    raw: data,
  };
}

export interface PickupResult {
  scheduledDate: string | null;
  pickupTokenNumber: string | null;
  raw: unknown;
}

/** Generate a pickup request for one or more shipment ids. */
export async function generatePickup(shipmentId: number): Promise<PickupResult> {
  type Resp = {
    pickup_status?: number;
    response?: {
      pickup_scheduled_date?: string;
      pickup_token_number?: string | number;
    };
    message?: string;
  };
  const data = await srFetch<Resp>(`/courier/generate/pickup`, {
    method: "POST",
    body: JSON.stringify({ shipment_id: [shipmentId] }),
  });
  return {
    scheduledDate: data.response?.pickup_scheduled_date ?? null,
    pickupTokenNumber:
      data.response?.pickup_token_number != null ? String(data.response.pickup_token_number) : null,
    raw: data,
  };
}

/** Cancel a Shiprocket order (before AWB) or an AWB (after). Best-effort. */
export async function cancelShiprocketShipment(opts: {
  shiprocketOrderId?: number;
  awb?: string;
}): Promise<{ ok: boolean; raw: unknown }> {
  try {
    if (opts.awb) {
      const data = await srFetch<unknown>(`/orders/cancel/shipment/awbs`, {
        method: "POST",
        body: JSON.stringify({ awbs: [opts.awb] }),
      });
      return { ok: true, raw: data };
    }
    if (opts.shiprocketOrderId) {
      const data = await srFetch<unknown>(`/orders/cancel`, {
        method: "POST",
        body: JSON.stringify({ ids: [opts.shiprocketOrderId] }),
      });
      return { ok: true, raw: data };
    }
    return { ok: false, raw: null };
  } catch (e) {
    return { ok: false, raw: e instanceof Error ? e.message : "cancel failed" };
  }
}

export async function trackShipment(shipmentId: number) {
  return srFetch<unknown>(`/courier/track/shipment/${shipmentId}`);
}

/**
 * Map free-text Shiprocket statuses (from webhooks / tracking) to our canonical
 * OrderStatus values. Anything unknown returns null.
 */
export function mapShiprocketStatus(
  s: string | null | undefined,
): "pickup_scheduled" | "in_transit" | "delivered" | "cancelled" | "failed" | null {
  if (!s) return null;
  const v = s.toLowerCase().trim();
  if (v.includes("delivered")) return "delivered";
  if (v.includes("rto") || v.includes("returned")) return "failed";
  if (v.includes("cancel")) return "cancelled";
  if (v.includes("pickup scheduled") || v === "manifested") return "pickup_scheduled";
  if (
    v.includes("picked up") ||
    v.includes("in transit") ||
    v.includes("out for delivery") ||
    v.includes("shipped")
  )
    return "in_transit";
  return null;
}
