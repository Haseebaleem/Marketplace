"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { CategoryNode } from "@marketplace/shared";
import {
  createProduct,
  fetchCategories,
} from "@/lib/supplier-api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/textarea";
import { ImageUploader } from "@/components/image-uploader";

interface FormValues {
  name: string;
  description: string;
  categoryId: string;
  price: string;
  stock: string;
}

const flattenCategories = (
  nodes: CategoryNode[],
  depth = 0,
): Array<{ id: string; label: string }> =>
  nodes.flatMap((n) => [
    { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
    ...flattenCategories(n.children, depth + 1),
  ]);

export default function NewProductPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [images, setImages] = useState<File[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: "", description: "", categoryId: "", price: "", stock: "" },
  });

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const flatCategories = useMemo(
    () => (categoriesQuery.data ? flattenCategories(categoriesQuery.data.categories) : []),
    [categoriesQuery.data],
  );

  const mutation = useMutation({
    mutationFn: ({ values, files }: { values: FormValues; files: File[] }) =>
      createProduct(values, files),
    onSuccess: (data) => {
      toast.success(`Created "${data.product.name}"`);
      qc.invalidateQueries({ queryKey: ["supplier", "products"] });
      qc.invalidateQueries({ queryKey: ["supplier", "dashboard"] });
      router.push("/supplier/products");
    },
    onError: (err: { message?: string; details?: Array<{ message: string }> }) => {
      const detail = err.details?.[0]?.message;
      toast.error(detail ?? err.message ?? "Could not create product");
    },
  });

  const onSubmit = (values: FormValues) => {
    setSubmitAttempted(true);
    if (images.length === 0) {
      toast.error("Please add at least one image");
      return;
    }
    mutation.mutate({ values, files: images });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New product</h1>
        <p className="text-sm text-muted-foreground">
          List something for buyers to discover.
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Required fields marked. Images can be added in any order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...register("name", { required: "Name is required" })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={5}
                {...register("description", { required: "Description is required" })}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register("categoryId", { required: "Category is required" })}
              >
                <option value="">Choose a category…</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="text-sm text-destructive">{errors.categoryId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  {...register("price", { required: "Price is required" })}
                />
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  inputMode="numeric"
                  {...register("stock", { required: "Stock is required" })}
                />
                {errors.stock && (
                  <p className="text-sm text-destructive">{errors.stock.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Images</Label>
              <ImageUploader onChange={setImages} />
              {submitAttempted && images.length === 0 && (
                <p className="text-sm text-destructive">
                  At least one image is required
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/supplier/products")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
