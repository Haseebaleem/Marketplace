import { z } from "zod";

export const productNameSchema = z
  .string()
  .trim()
  .min(3, "Product name must be at least 3 characters")
  .max(200, "Product name must be at most 200 characters");

export const productDescriptionSchema = z
  .string()
  .trim()
  .min(10, "Description must be at least 10 characters")
  .max(5000, "Description must be at most 5000 characters");

export const priceSchema = z
  .coerce.number({ invalid_type_error: "Price must be a number" })
  .positive("Price must be greater than zero")
  .max(999_999.99, "Price is too high")
  .refine(
    (n) => Number.isFinite(n) && Math.round(n * 100) / 100 === n,
    "Price must have at most 2 decimal places",
  );

export const stockSchema = z
  .coerce.number({ invalid_type_error: "Stock must be a number" })
  .int("Stock must be an integer")
  .min(0, "Stock cannot be negative")
  .max(100_000, "Stock is too high");

export const productCreateBodySchema = z.object({
  name: productNameSchema,
  description: productDescriptionSchema,
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
  price: priceSchema,
  stock: stockSchema,
});

export const productUpdateBodySchema = z.object({
  name: productNameSchema.optional(),
  description: productDescriptionSchema.optional(),
  categoryId: z.string().uuid().optional(),
  price: priceSchema.optional(),
  stock: stockSchema.optional(),
  active: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => (typeof v === "boolean" ? v : v === "true"))
    .optional(),
});

export type ProductCreateBody = z.infer<typeof productCreateBodySchema>;
export type ProductUpdateBody = z.infer<typeof productUpdateBodySchema>;

export const MAX_PRODUCT_IMAGES = 5;
