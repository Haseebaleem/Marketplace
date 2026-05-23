import type { RequestHandler } from "express";
import type { Role } from "@marketplace/shared";
import { prisma } from "../config/prisma";
import { verifyToken } from "../utils/jwt";
import {
  ForbiddenError,
  SuspendedAccountError,
  UnauthorizedError,
} from "../utils/errors";

const extractBearerToken = (header: string | undefined): string | null => {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.header("authorization"));
    if (!token) {
      throw new UnauthorizedError("Missing or malformed Authorization header");
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, suspended: true },
    });

    if (!user) {
      throw new UnauthorizedError("Account no longer exists");
    }
    if (user.suspended) {
      throw new SuspendedAccountError();
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

export const requireRole = (...allowed: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${allowed.join(" or ")}`));
      return;
    }
    next();
  };
};
