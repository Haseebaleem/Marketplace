"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Boxes, ListChecks, PackageOpen, Wallet, Plus } from "lucide-react";
import { fetchDashboard, type DashboardStats } from "@/lib/supplier-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const Stat = ({
  label,
  value,
  icon: Icon,
  sublabel,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sublabel?: string;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {label}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </CardContent>
  </Card>
);

const RecentOrders = ({ data }: { data: DashboardStats["recentOrders"] }) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No orders yet. Orders show up here once buyers start checking out.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((order) => (
          <div
            key={order.id}
            className="flex items-start justify-between border-b pb-3 last:border-b-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium">{order.orderNumber}</p>
              <p className="text-xs text-muted-foreground">
                {order.items.length} item{order.items.length === 1 ? "" : "s"} ·{" "}
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
              {order.status}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default function SupplierDashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["supplier", "dashboard"],
    queryFn: fetchDashboard,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your store at a glance.
          </p>
        </div>
        <Button asChild>
          <Link href="/supplier/products/new">
            <Plus className="mr-2 h-4 w-4" /> New product
          </Link>
        </Button>
      </div>

      {isLoading && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4 rounded-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="mt-2 h-3 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex items-start justify-between border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">Failed to load dashboard.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Products"
              value={data.totalProducts}
              icon={Boxes}
              sublabel={`${data.activeProducts} active`}
            />
            <Stat label="Orders" value={data.totalOrders} icon={ListChecks} />
            <Stat
              label="Pending shipments"
              value={data.pendingShipments}
              icon={PackageOpen}
            />
            <Stat
              label="Revenue"
              value={`$${data.revenue.allTime}`}
              icon={Wallet}
              sublabel={`$${data.revenue.last30Days} last 30 days`}
            />
          </div>
          <RecentOrders data={data.recentOrders} />
        </>
      )}
    </div>
  );
}
