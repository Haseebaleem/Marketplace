import { prisma } from "../config/prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const sumOrderItems = (
  rows: { quantity: number; productPrice: { toString: () => string } }[],
): number =>
  rows.reduce(
    (acc, row) => acc + row.quantity * Number(row.productPrice.toString()),
    0,
  );

export const getSupplierDashboard = async (supplierId: string) => {
  const [totalProducts, activeProducts] = await Promise.all([
    prisma.product.count({ where: { supplierId } }),
    prisma.product.count({ where: { supplierId, active: true } }),
  ]);

  // Count distinct orders containing any item from this supplier.
  const orderIdsAll = await prisma.orderItem.findMany({
    where: { supplierId },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  const totalOrders = orderIdsAll.length;

  // Pending shipments: this supplier has items in a PROCESSING order that
  // are not yet shipped.
  const pendingShipmentsRows = await prisma.orderItem.findMany({
    where: {
      supplierId,
      shippedAt: null,
      order: { status: "PROCESSING" },
    },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  const pendingShipments = pendingShipmentsRows.length;

  // Revenue from PAID / PROCESSING / SHIPPED / DELIVERED orders.
  const revenueRows = await prisma.orderItem.findMany({
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
  });
  const allTime = sumOrderItems(
    revenueRows.map(({ quantity, productPrice }) => ({ quantity, productPrice })),
  );
  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const last30Days = sumOrderItems(
    revenueRows
      .filter((r) => r.order.createdAt >= since)
      .map(({ quantity, productPrice }) => ({ quantity, productPrice })),
  );

  // Recent orders for this supplier.
  const recentOrderRows = await prisma.order.findMany({
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
  });
  const recentOrders = recentOrderRows.map((o) => ({
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
  }));

  return {
    totalProducts,
    activeProducts,
    totalOrders,
    pendingShipments,
    revenue: {
      allTime: allTime.toFixed(2),
      last30Days: last30Days.toFixed(2),
    },
    recentOrders,
  };
};
