import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../config/prisma";
import { logger } from "../config/logger";

export type AuditAction =
  | "USER_REGISTERED"
  | "USER_LOGIN"
  | "USER_SUSPENDED"
  | "USER_UNSUSPENDED"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED"
  | "PRODUCT_FLAGGED"
  | "ORDER_CREATED"
  | "ORDER_PAID"
  | "ORDER_PROCESSED"
  | "ORDER_SHIPPED"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "ORDER_REFUNDED"
  | "CATEGORY_CREATED"
  | "CATEGORY_UPDATED"
  | "CATEGORY_DELETED";

export interface AuditLogInput {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

export const extractIp = (req: Request): string | null => {
  // trust proxy is enabled; req.ip respects X-Forwarded-For.
  return req.ip ?? null;
};

export const createAuditLog = async (input: AuditLogInput): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
        ipAddress: input.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never break a request — log and swallow.
    logger.error("Failed to write audit log", {
      err: err instanceof Error ? err.message : err,
      action: input.action,
      entityType: input.entityType,
    });
  }
};
