import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "SUPPLIER", "BUYER"]);
export type Role = z.infer<typeof roleSchema>;

export const orderStatusSchema = z.enum([
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INSUFFICIENT_STOCK",
  "INVALID_TRANSITION",
  "SUSPENDED_ACCOUNT",
  "RATE_LIMIT_EXCEEDED",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorDetailSchema = z.object({
  field: z.string(),
  message: z.string(),
});

export const errorEnvelopeSchema = z.object({
  error: z.string(),
  code: errorCodeSchema,
  details: z.array(errorDetailSchema).optional(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });
