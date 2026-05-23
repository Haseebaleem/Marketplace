import type { RequestHandler } from "express";
import { prisma } from "../config/prisma";
import { ForbiddenError, NotFoundError } from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      product?: {
        id: string;
        supplierId: string;
      };
    }
  }
}

/**
 * Loads the :id product, asserts it belongs to req.user.id, and stashes the
 * minimal record on req.product so the route handler can reuse it.
 */
export const requireProductOwnership: RequestHandler = async (req, _res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      next(new NotFoundError("Product not found"));
      return;
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, supplierId: true },
    });
    if (!product) {
      next(new NotFoundError("Product not found"));
      return;
    }
    if (product.supplierId !== req.user?.id) {
      next(new ForbiddenError("You do not own this product"));
      return;
    }
    req.product = product;
    next();
  } catch (err) {
    next(err);
  }
};
