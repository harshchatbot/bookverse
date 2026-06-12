import Razorpay from "razorpay";
import crypto from "crypto";

let _instance: Razorpay | null = null;
let _instanceKey: string | null = null;
let _loggedConfigKey: string | null = null;

export type RazorpayMode = "live" | "test";

export interface RazorpayConfig {
  mode: RazorpayMode;
  keyId: string;
  keySecret: string;
}

function getRazorpayMode(): RazorpayMode {
  return (process.env.RAZORPAY_MODE ?? "live").trim().toLowerCase() === "test" ? "test" : "live";
}

function validateRazorpayKeyId(mode: RazorpayMode, keyId: string) {
  const expectedPrefix = mode === "test" ? "rzp_test" : "rzp_live";
  if (!keyId.startsWith(expectedPrefix)) {
    throw new Error(
      `Razorpay mode/key mismatch: mode=${mode} requires a key starting with ${expectedPrefix}.`,
    );
  }
}

function maskRazorpayKeyId(keyId: string) {
  if (keyId.startsWith("rzp_test")) return "rzp_test_xxxxx";
  if (keyId.startsWith("rzp_live")) return "rzp_live_xxxxx";
  return "unknown";
}

export function getRazorpayConfig(): RazorpayConfig {
  const mode = getRazorpayMode();
  const keyId =
    mode === "test"
      ? process.env.RAZORPAY_TEST_KEY_ID?.trim()
      : process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret =
    mode === "test"
      ? process.env.RAZORPAY_TEST_KEY_SECRET?.trim()
      : process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error(
      mode === "test"
        ? "RAZORPAY_TEST_KEY_ID / RAZORPAY_TEST_KEY_SECRET are not set"
        : "RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set",
    );
  }

  validateRazorpayKeyId(mode, keyId);

  const logKey = `${mode}:${keyId}`;
  if (_loggedConfigKey !== logKey) {
    console.info(`[razorpay] mode=${mode} activeKey=${maskRazorpayKeyId(keyId)}`);
    _loggedConfigKey = logKey;
  }

  return { mode, keyId, keySecret };
}

export function razorpay(): Razorpay {
  const config = getRazorpayConfig();
  const configKey = `${config.mode}:${config.keyId}`;
  if (_instance && _instanceKey === configKey) return _instance;
  if (_instanceKey !== configKey) {
    _instance = null;
  }
  _instance = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  _instanceKey = configKey;
  return _instance;
}

export function razorpayKeyId(): string {
  return getRazorpayConfig().keyId;
}

export function verifyRazorpaySignature(opts: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayConfig().keySecret;
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
