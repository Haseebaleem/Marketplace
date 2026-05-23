"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { thumbUrl } from "@marketplace/shared";
import {
  deleteProduct,
  fetchProducts,
  updateProduct,
  type ProductSummary,
} from "@/lib/supplier-api";
import { assetUrl } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ProductRow = ({
  product,
  onDelete,
  onToggleActive,
}: {
  product: ProductSummary;
  onDelete: () => void;
  onToggleActive: () => void;
}) => {
  const cover = product.images[0];
  const coverUrl = cover ? assetUrl(thumbUrl(cover.url)) : null;
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={product.name}
              width={64}
              height={64}
              className="h-16 w-16 object-cover"
              unoptimized
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{product.name}</p>
            {!product.active && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {product.category.name} · ${product.price} · {product.stock} in stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleActive}
          >
            {product.active ? "Delist" : "Relist"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/supplier/products/${product.id}/edit`}>
              <Edit className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function SupplierProductsPage() {
  const [page, setPage] = useState(1);
  const limit = 20;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["supplier", "products", page, limit],
    queryFn: () => fetchProducts(page, limit),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: (data) => {
      toast.success(
        data.mode === "hard"
          ? "Product deleted permanently."
          : "Product had orders — marked inactive instead.",
      );
      qc.invalidateQueries({ queryKey: ["supplier", "products"] });
      qc.invalidateQueries({ queryKey: ["supplier", "dashboard"] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? "Could not delete"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updateProduct(id, { active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier", "products"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your listings.
          </p>
        </div>
        <Button asChild>
          <Link href="/supplier/products/new">
            <Plus className="mr-2 h-4 w-4" /> New product
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-16 w-16 flex-shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-9 w-16" />
                  <Skeleton className="h-9 w-9" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.data.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No products yet. Add your first one to get started.
            </p>
            <Button asChild>
              <Link href="/supplier/products/new">
                <Plus className="mr-2 h-4 w-4" /> New product
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-3">
          {data.data.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete "${p.name}"? This cannot be undone.`,
                  )
                ) {
                  deleteMutation.mutate(p.id);
                }
              }}
              onToggleActive={() =>
                toggleMutation.mutate({ id: p.id, active: !p.active })
              }
            />
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
