import { adminKit } from "./admin.server";

export interface UserOrderMetrics {
  sellerEarnings: number;
  sellerOrderCount: number;
  buyerTotalSpent: number;
}

function isPaidOrder(data: Record<string, unknown>) {
  const paymentStatus = typeof data.paymentStatus === "string" ? data.paymentStatus : "";
  const status = typeof data.status === "string" ? data.status : "";

  return (
    paymentStatus === "paid" ||
    paymentStatus === "captured" ||
    [
      "paid",
      "shipment_created",
      "pickup_scheduled",
      "in_transit",
      "dispute_window",
      "completed",
    ].includes(status)
  );
}

export async function getUserOrderMetricsForUid(uid: string): Promise<UserOrderMetrics> {
  const { db } = await adminKit();

  const [sellerOrdersSnap, buyerOrdersSnap] = await Promise.all([
    db.collection("orders").where("sellerUid", "==", uid).get(),
    db.collection("orders").where("buyerUid", "==", uid).get(),
  ]);

  const sellerOrders = sellerOrdersSnap.docs
    .map((docSnap) => docSnap.data() as Record<string, unknown>)
    .filter(isPaidOrder);
  const buyerOrders = buyerOrdersSnap.docs
    .map((docSnap) => docSnap.data() as Record<string, unknown>)
    .filter(isPaidOrder);

  return {
    sellerEarnings: sellerOrders.reduce((sum, order) => {
      const value =
        typeof order.sellerAmount === "number"
          ? order.sellerAmount
          : typeof order.subtotal === "number"
            ? order.subtotal
            : 0;
      return sum + value;
    }, 0),
    sellerOrderCount: sellerOrders.length,
    buyerTotalSpent: buyerOrders.reduce((sum, order) => {
      const value = typeof order.totalAmount === "number" ? order.totalAmount : 0;
      return sum + value;
    }, 0),
  };
}
