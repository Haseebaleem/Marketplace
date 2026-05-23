"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, ImagePlus } from "lucide-react";
import { MAX_PRODUCT_IMAGES } from "@marketplace/shared";
import { Button } from "@/components/ui/button";

interface Preview {
  file: File;
  url: string;
}

interface ImageUploaderProps {
  /** Number of slots already filled by existing (saved) images. */
  existingCount?: number;
  onChange: (files: File[]) => void;
  /** Reset signal — toggling clears the local previews. */
  resetKey?: number;
}

const FIVE_MB = 5 * 1024 * 1024;

export const ImageUploader = ({
  existingCount = 0,
  onChange,
  resetKey,
}: ImageUploaderProps) => {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Track active blob URLs in a ref so we can revoke them on unmount without
  // re-running cleanup every time `previews` changes (which would revoke
  // URLs still being rendered).
  const liveUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = liveUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    // External reset: drop any blob URLs we currently own.
    liveUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    liveUrlsRef.current.clear();
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  }, [resetKey]);

  const remainingSlots = MAX_PRODUCT_IMAGES - existingCount - previews.length;

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: Preview[] = [];
    const rejected: string[] = [];
    Array.from(incoming).forEach((file) => {
      if (accepted.length >= remainingSlots) {
        rejected.push(`${file.name}: limit reached`);
        return;
      }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        rejected.push(`${file.name}: not a supported image`);
        return;
      }
      if (file.size > FIVE_MB) {
        rejected.push(`${file.name}: exceeds 5 MB`);
        return;
      }
      const url = URL.createObjectURL(file);
      liveUrlsRef.current.add(url);
      accepted.push({ file, url });
    });
    if (accepted.length > 0) {
      const next = [...previews, ...accepted];
      setPreviews(next);
      onChange(next.map((p) => p.file));
    }
    if (rejected.length > 0) {
      // eslint-disable-next-line no-alert
      alert(rejected.join("\n"));
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeAt = (idx: number) => {
    setPreviews((prev) => {
      const removed = prev[idx];
      if (removed) {
        URL.revokeObjectURL(removed.url);
        liveUrlsRef.current.delete(removed.url);
      }
      const next = prev.filter((_, i) => i !== idx);
      onChange(next.map((p) => p.file));
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {previews.map((p, i) => (
          <div
            key={`${p.url}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
          >
            <Image
              src={p.url}
              alt={`Upload preview ${i + 1}`}
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {remainingSlots > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground hover:bg-accent"
          >
            <ImagePlus className="h-6 w-6" />
            <span className="text-xs">Add image</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        JPG, PNG, or WebP. Up to 5 MB each. {existingCount + previews.length} /{" "}
        {MAX_PRODUCT_IMAGES} used.
      </p>
      {previews.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            previews.forEach((p) => URL.revokeObjectURL(p.url));
            setPreviews([]);
            onChange([]);
          }}
        >
          Clear previews
        </Button>
      )}
    </div>
  );
};
