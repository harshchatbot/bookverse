import Razorpay from "razorpay";
import crypto from "crypto";

let _instance: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (_instance) return _instance;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
  }
  _instance = new Razorpay({ key_id, key_secret });
  return _instance;
}

export function razorpayKeyId(): string {
  const k = process.env.RAZORPAY_KEY_ID;
  if (!k) throw new Error("RAZORPAY_KEY_ID is not set");
  return k;
}

export function verifyRazorpaySignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not set");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${opts.razorpayOrderId}|${opts.razorpayPaymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(opts.signature));
  } catch {
    return false;
  }
}

/** Gateway fee estimate (Razorpay ~2% + 18% GST = ~2.36%). Buyer-borne. */
export function estimateGatewayFee(amountInRupees: number): number {
  const fee = amountInRupees * 0.0236;
  // Round up to nearest rupee so we don't undercharge.
  return Math.ceil(fee);
}
