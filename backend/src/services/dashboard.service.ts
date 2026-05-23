import { prisma } from "../config/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface RevenueRow {
  quantity: number;
  productPrice: { toString: () => string };
  order: { createdAt: Date };
}

const sumOrderItems = (rows: RevenueRow[]): number =>
  rows.reduce(
    (acc, row) => acc + row.quantity * Number(row.productPrice.toString()),
    0,
  );

export const getSupplierDashboard = async (supplierId: string) => {
  // All six top-level queries are independent — run them concurrently so
  // wall-clock cost is the slowest single query, not the sum.
  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const [
    totalProducts,
    activeProducts,
    distinctOrderIds,
    distinctPendingShipmentOrderIds,
    revenueRows,
    recentOrderRows,
  ] = await Promise.all([
    prisma.product.count({ where: { supplierId } }),
    prisma.product.count({ where: { supplierId, active: true } }),
    prisma.orderItem.findMany({
      where: { supplierId },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.orderItem.findMany({
      where: {
        supplierId,
        shippedAt: null,
        order: { status: "PROCESSING" },
      },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.orderItem.findMany({
      where: {
        supplierId,
        order: {
          status: { in: ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      select: {
        quantity: true,
        productPrice: true,
        order: { select: { createdAt: true } },
      },
    }),
    prisma.order.findMany({
      where: { items: { some: { supplierId } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        items: {
          where: { supplierId },
          select: {
            id: true,
            productName: true,
            quantity: true,
            productPrice: true,
            shippedAt: true,
          },
        },
      },
    }),
  ]);

  const allTime = sumOrderItems(revenueRows);
  const last30Days = sumOrderItems(
    revenueRows.filter((r) => r.order.createdAt >= since),
  );

  return {
    totalProducts,
    activeProducts,
    totalOrders: distinctOrderIds.length,
    pendingShipments: distinctPendingShipmentOrderIds.length,
    revenue: {
      allTime: allTime.toFixed(2),
      last30Days: last30Days.toFixed(2),
    },
    recentOrders: recentOrderRows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({
        id: i.id,
        productName: i.productName,
        quantity: i.quantity,
        productPrice: i.productPrice.toString(),
        shippedAt: i.shippedAt?.toISOString() ?? null,
      })),
    })),
  };
};
