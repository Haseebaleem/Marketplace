import { z } from "zod";
import { storeNameSchema } from "./auth";

export const storeDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be at most 2000 characters")
  .optional();

export const supplierProfileUpdateSchema = z.object({
  storeName: storeNameSchema.optional(),
  description: storeDescriptionSchema,
});

export const supplierProfileResponseSchema = z.object({
  id: z.string().uuid(),
  storeName: z.string(),
  storeSlug: z.string(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
});

export type SupplierProfileUpdate = z.infer<typeof supplierProfileUpdateSchema>;
export type SupplierProfileResponse = z.infer<
  typeof supplierProfileResponseSchema
>;
