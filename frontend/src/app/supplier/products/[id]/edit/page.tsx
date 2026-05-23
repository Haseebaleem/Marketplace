"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import type { CategoryNode } from "@marketplace/shared";
import { thumbUrl } from "@marketplace/shared";
import {
  addProductImages,
  fetchCategories,
  fetchProduct,
  removeProductImage,
  updateProduct,
} from "@/lib/supplier-api";
import { assetUrl } from "@/lib/env";
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
  active: boolean;
}

const flattenCategories = (
  nodes: CategoryNode[],
  depth = 0,
): Array<{ id: string; label: string }> =>
  nodes.flatMap((n) => [
    { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
    ...flattenCategories(n.children, depth + 1),
  ]);

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [uploaderResetKey, setUploaderResetKey] = useState(0);

  const productQuery = useQuery({
    queryKey: ["supplier", "product", params.id],
    queryFn: () => fetchProduct(params.id),
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const flatCategories = useMemo(
    () => (categoriesQuery.data ? flattenCategories(categoriesQuery.data.categories) : []),
    [categoriesQuery.data],
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      categoryId: "",
      price: "",
      stock: "",
      active: true,
    },
  });

  useEffect(() => {
    if (productQuery.data) {
      const p = productQuery.data.product;
      reset({
        name: p.name,
        description: p.description,
        categoryId: p.categoryId,
        price: p.price,
        stock: String(p.stock),
        active: p.active,
      });
    }
  }, [productQuery.data, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateProduct(params.id, {
        name: values.name,
        description: values.description,
        categoryId: values.categoryId,
        price: values.price,
        stock: values.stock,
        active: values.active,
      }),
    onSuccess: (data) => {
      toast.success(
        data.changed.length > 0
          ? `Saved (${data.changed.join(", ")})`
          : "No changes",
      );
      qc.invalidateQueries({ queryKey: ["supplier", "product", params.id] });
      qc.invalidateQueries({ queryKey: ["supplier", "products"] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? "Save failed"),
  });

  const addImagesMutation = useMutation({
    mutationFn: (files: File[]) => addProductImages(params.id, files),
    onSuccess: () => {
      toast.success("Images added");
      setPendingImages([]);
      setUploaderResetKey((k) => k + 1);
      qc.invalidateQueries({ queryKey: ["supplier", "product", params.id] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? "Upload failed"),
  });

  const removeImageMutation = useMutation({
    mutationFn: (imageId: string) => removeProductImage(params.id, imageId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supplier", "product", params.id] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? "Could not remove image"),
  });

  if (productQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="h-64 animate-pulse" />
        </Card>
      </div>
    );
  }
  if (productQuery.isError || !productQuery.data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Could not load product.
        </CardContent>
      </Card>
    );
  }

  const product = productQuery.data.product;
  const existingImageCount = product.images.length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit product</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name", { required: "Name is required" })} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
                {...register("categoryId", { required: true })}
              >
                <option value="">Choose a category…</option>
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register("price", { required: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input id="stock" type="number" {...register("stock", { required: true })} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input
                id="active"
                type="checkbox"
                className="h-4 w-4 rounded border border-input"
                {...register("active")}
              />
              <Label htmlFor="active" className="cursor-pointer">
                Listed for buyers
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/supplier/products")}
          >
            Back
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <CardDescription>
            {existingImageCount} / 5 used. Removing the last image is not
            allowed — add a new one first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {product.images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {product.images.map((img) => {
                const url = assetUrl(thumbUrl(img.url));
                return (
                  <div
                    key={img.id}
                    className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                  >
                    {url && (
                      <Image
                        src={url}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => {
                        if (window.confirm("Remove this image?")) {
                          removeImageMutation.mutate(img.id);
                        }
                      }}
                      aria-label="Remove image"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {existingImageCount < 5 && (
            <>
              <ImageUploader
                existingCount={existingImageCount}
                onChange={setPendingImages}
                resetKey={uploaderResetKey}
              />
              <Button
                type="button"
                disabled={pendingImages.length === 0 || addImagesMutation.isPending}
                onClick={() => addImagesMutation.mutate(pendingImages)}
              >
                {addImagesMutation.isPending ? "Uploading…" : "Add selected"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
