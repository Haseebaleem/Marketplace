"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ImagePlus } from "lucide-react";
import { fetchProfile, updateProfile } from "@/lib/supplier-api";
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

interface FormValues {
  storeName: string;
  description: string;
}

export default function StoreProfilePage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const profileQuery = useQuery({
    queryKey: ["supplier", "profile"],
    queryFn: fetchProfile,
  });

  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: { storeName: "", description: "" },
  });

  useEffect(() => {
    if (profileQuery.data) {
      reset({
        storeName: profileQuery.data.profile.storeName,
        description: profileQuery.data.profile.description ?? "",
      });
    }
  }, [profileQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateProfile({ storeName: values.storeName, description: values.description }, logoFile),
    onSuccess: (data) => {
      toast.success(
        data.changed.length > 0
          ? `Saved (${data.changed.join(", ")})`
          : "No changes",
      );
      setLogoFile(null);
      if (logoPreview) URL.revokeObjectURL(logoPreview);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["supplier", "profile"] });
    },
    onError: (err: { message?: string }) =>
      toast.error(err.message ?? "Could not save"),
  });

  const currentLogo = assetUrl(profileQuery.data?.profile.logoUrl ?? null);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Store</h1>
        <p className="text-sm text-muted-foreground">
          How buyers see your storefront.
        </p>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Public profile</CardTitle>
            <CardDescription>
              Slug:{" "}
              <span className="font-mono">
                {profileQuery.data?.profile.storeSlug ?? "…"}
              </span>{" "}
              (auto-generated, not editable)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border bg-muted">
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Logo preview"
                    width={80}
                    height={80}
                    className="h-20 w-20 object-cover"
                    unoptimized
                  />
                ) : currentLogo ? (
                  <Image
                    src={currentLogo}
                    alt="Store logo"
                    width={80}
                    height={80}
                    className="h-20 w-20 object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoFile ? "Change selection" : "Upload logo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (logoPreview) URL.revokeObjectURL(logoPreview);
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  JPG / PNG / WebP, up to 5 MB.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input
                id="storeName"
                {...register("storeName", { required: "Store name is required" })}
              />
              {formState.errors.storeName && (
                <p className="text-sm text-destructive">
                  {formState.errors.storeName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={4} {...register("description")} />
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
