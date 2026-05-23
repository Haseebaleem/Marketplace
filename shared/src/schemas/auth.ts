import { z } from "zod";
import { roleSchema } from "./common";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be at most 100 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .max(255, "Email is too long");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is too long");

export const storeNameSchema = z
  .string()
  .trim()
  .min(2, "Store name must be at least 2 characters")
  .max(120, "Store name is too long");

export const registerBuyerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.literal("BUYER"),
});

export const registerSupplierSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  role: z.literal("SUPPLIER"),
  storeName: storeNameSchema,
});

export const registerSchema = z.discriminatedUnion("role", [
  registerBuyerSchema,
  registerSupplierSchema,
]);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: roleSchema,
  emailVerified: z.boolean(),
  suspended: z.boolean(),
  createdAt: z.string().or(z.date()),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: authUserSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterBuyerInput = z.infer<typeof registerBuyerSchema>;
export type RegisterSupplierInput = z.infer<typeof registerSupplierSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
