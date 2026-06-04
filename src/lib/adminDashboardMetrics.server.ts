import { adminKit } from "./admin.server";

export interface DashboardStat {
  label: string;
  value: number;
}

export interface ProtectedDeliveryOrderMetrics {
  totalOrders: number;
  paidOrders: number;
  totalGMV: number;
  avgOrderValue: number;
  totalDelivered: number;
  totalPlatformSupportFees: number;
  totalCouponDiscount: number;
  totalShippingSubsidy: number;
  ordersByStatus: DashboardStat[];
}

function countValues(values: string[]): DashboardStat[] {
  const counts = values.reduce<Map<string, number>>((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function isRevenueOrder(order: Record<string, unknown>) {
  const paymentStatus = typeof order.paymentStatus === "string" ? order.paymentStatus : "";
  return paymentStatus === "paid" || paymentStatus === "captured";
}

export async function getProtectedDeliveryOrderMetrics(): Promise<ProtectedDeliveryOrderMetrics> {
  const { db } = await adminKit();
  const ordersSnap = await db.collection("orders").get();
  const orders = ordersSnap.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
  const paidOrders = orders.filter(isRevenueOrder);
  const deliveredOrders = orders.filter((order) => order.status === "delivered");
  const totalGMV = paidOrders.reduce((sum, order) => {
    const value = typeof order.totalAmount === "number" ? order.totalAmount : 0;
    return sum + value;
  }, 0);
  const totalPlatformSupportFees = paidOrders.reduce((sum, order) => {
    const value =
      typeof order.platformSupportFee === "number"
        ? order.platformSupportFee
        : typeof order.platformFee === "number"
          ? order.platformFee
          : 0;
    return sum + value;
  }, 0);
  const totalCouponDiscount = paidOrders.reduce((sum, order) => {
    const value = typeof order.couponDiscount === "number" ? order.couponDiscount : 0;
    return sum + value;
  }, 0);
  const totalShippingSubsidy = paidOrders.reduce((sum, order) => {
    const value =
      typeof order.bookVerseShippingSubsidy === "number" ? order.bookVerseShippingSubsidy : 0;
    return sum + value;
  }, 0);

  return {
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    totalGMV,
    avgOrderValue: paidOrders.length > 0 ? totalGMV / paidOrders.length : 0,
    totalDelivered: deliveredOrders.length,
    totalPlatformSupportFees,
    totalCouponDiscount,
    totalShippingSubsidy,
    ordersByStatus: countValues(
      orders.map((order) => (typeof order.status === "string" ? order.status : "unknown")),
    ),
  };
}
