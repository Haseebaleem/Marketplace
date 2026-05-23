import type { SupplierProfileUpdate } from "@marketplace/shared";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/errors";

export const getProfile = async (userId: string) => {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId },
  });
  if (!profile) {
    throw new NotFoundError("Supplier profile not found");
  }
  return {
    id: profile.id,
    storeName: profile.storeName,
    storeSlug: profile.storeSlug,
    description: profile.description,
    logoUrl: profile.logoUrl,
  };
};

export interface ProfileUpdateInput extends SupplierProfileUpdate {
  logoUrl?: string | null;
}

export const updateProfile = async (
  userId: string,
  input: ProfileUpdateInput,
) => {
  const existing = await prisma.supplierProfile.findUnique({
    where: { userId },
  });
  if (!existing) {
    throw new NotFoundError("Supplier profile not found");
  }

  const changed: string[] = [];
  const data: {
    storeName?: string;
    description?: string | null;
    logoUrl?: string | null;
  } = {};

  if (input.storeName !== undefined && input.storeName !== existing.storeName) {
    data.storeName = input.storeName;
    changed.push("storeName");
  }
  if (input.description !== undefined && input.description !== existing.description) {
    data.description = input.description || null;
    changed.push("description");
  }
  if (input.logoUrl !== undefined && input.logoUrl !== existing.logoUrl) {
    data.logoUrl = input.logoUrl;
    changed.push("logoUrl");
  }

  if (changed.length === 0) {
    return {
      profile: {
        id: existing.id,
        storeName: existing.storeName,
        storeSlug: existing.storeSlug,
        description: existing.description,
        logoUrl: existing.logoUrl,
      },
      changed,
      previousLogoUrl: existing.logoUrl,
    };
  }

  const updated = await prisma.supplierProfile.update({
    where: { userId },
    data,
  });

  return {
    profile: {
      id: updated.id,
      storeName: updated.storeName,
      storeSlug: updated.storeSlug,
      description: updated.description,
      logoUrl: updated.logoUrl,
    },
    changed,
    previousLogoUrl: existing.logoUrl,
  };
};
