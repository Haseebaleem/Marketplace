import { Prisma } from "@prisma/client";
import type {
  ProductCreateBody,
  ProductUpdateBody,
} from "@marketplace/shared";
import { prisma } from "../config/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";
import { slugify, uniqueSlug } from "../utils/slug";

const SLUG_MAX_ATTEMPTS = 50;

const isUniqueConstraintErrorOn = (err: unknown, target: string): boolean =>
  err instanceof Prisma.PrismaClientKnownRequestError &&
  err.code === "P2002" &&
  Array.isArray((err.meta as { target?: string[] } | undefined)?.target) &&
  ((err.meta as { target: string[] }).target.includes(target));

const CATEGORY_NOT_FOUND_MSG = "Category does not exist";

const assertCategoryExists = async (
  tx: Prisma.TransactionClient,
  categoryId: string,
) => {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new ValidationError(CATEGORY_NOT_FOUND_MSG, [
      { field: "categoryId", message: CATEGORY_NOT_FOUND_MSG },
    ]);
  }
};

interface CreateInput extends ProductCreateBody {
  supplierId: string;
  imageUrls: string[];
}

const buildSlugCandidate = (root: string, attempt: number): string =>
  attempt === 0 ? root : `${root}-${attempt + 1}`;

export const createProduct = async (input: CreateInput) => {
  if (input.imageUrls.length === 0) {
    throw new ValidationError("At least one image is required", [
      { field: "images", message: "At least one image is required" },
    ]);
  }

  const root = slugify(input.name);

  // Two-layer slug uniqueness:
  //   1. Pre-check inside the transaction (fast happy path, picks the lowest
  //      suffix that doesn't collide with already-committed rows).
  //   2. Catch P2002 on slug if a concurrent transaction committed the same
  //      candidate before our INSERT — retry with the next suffix.
  // Postgres Read Committed isolation lets two transactions see "slug
  // available" simultaneously, so the second layer is the actual safety net.
  let lastError: unknown;
  for (let attempt = 0; attempt < SLUG_MAX_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- intentional retry loop
      return await prisma.$transaction(async (tx) => {
        await assertCategoryExists(tx, input.categoryId);
        const slug = await uniqueSlug(input.name, async (candidate) => {
          const existing = await tx.product.findUnique({
            where: { slug: candidate },
            select: { id: true },
          });
          return Boolean(existing);
        });
        return tx.product.create({
          data: {
            supplierId: input.supplierId,
            categoryId: input.categoryId,
            name: input.name,
            slug,
            description: input.description,
            price: input.price,
            stock: input.stock,
            images: {
              create: input.imageUrls.map((url, idx) => ({ url, order: idx })),
            },
          },
          include: {
            images: { orderBy: { order: "asc" } },
            category: { select: { id: true, name: true, slug: true } },
          },
        });
      });
    } catch (err) {
      // Only retry when a concurrent insert won the race for *this* slug.
      if (isUniqueConstraintErrorOn(err, "slug")) {
        lastError = err;
        // The next attempt will see the committed row and bump past it.
        continue;
      }
      throw err;
    }
  }
  // Shouldn't happen unless 50 concurrent inserts all picked the same root.
  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not generate unique slug for "${root}"`);
};

// Exported only so tests can verify the candidate progression.
export const __testing = { buildSlugCandidate };

interface UpdateInput extends ProductUpdateBody {
  productId: string;
}

export const updateProduct = async (input: UpdateInput) => {
  const existing = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  const data: Prisma.ProductUpdateInput = {};
  const changed: string[] = [];

  if (input.categoryId && input.categoryId !== existing.categoryId) {
    await assertCategoryExists(prisma, input.categoryId);
    data.category = { connect: { id: input.categoryId } };
    changed.push("categoryId");
  }
  if (input.name !== undefined && input.name !== existing.name) {
    data.name = input.name;
    changed.push("name");
  }
  if (
    input.description !== undefined &&
    input.description !== existing.description
  ) {
    data.description = input.description;
    changed.push("description");
  }
  if (input.price !== undefined && Number(existing.price) !== input.price) {
    data.price = input.price;
    changed.push("price");
  }
  if (input.stock !== undefined && existing.stock !== input.stock) {
    data.stock = input.stock;
    changed.push("stock");
  }
  if (input.active !== undefined && existing.active !== input.active) {
    data.active = input.active;
    changed.push("active");
  }

  if (changed.length === 0) {
    const refreshed = await prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        images: { orderBy: { order: "asc" } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    return { product: refreshed!, changed };
  }

  const updated = await prisma.product.update({
    where: { id: input.productId },
    data,
    include: {
      images: { orderBy: { order: "asc" } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  return { product: updated, changed };
};

interface ListInput {
  supplierId: string;
  page: number;
  limit: number;
}

export const listSupplierProducts = async ({
  supplierId,
  page,
  limit,
}: ListInput) => {
  const [data, total] = await prisma.$transaction([
    prisma.product.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where: { supplierId } }),
  ]);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const getSupplierProductById = async (
  supplierId: string,
  productId: string,
) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      images: { orderBy: { order: "asc" } },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!product || product.supplierId !== supplierId) {
    throw new NotFoundError("Product not found");
  }
  return product;
};

export const productHasOrders = async (productId: string): Promise<boolean> => {
  const count = await prisma.orderItem.count({ where: { productId } });
  return count > 0;
};

/**
 * Removes all ProductImage rows for the given product and returns their URLs
 * so the caller can delete files from disk. Runs inside an existing
 * transaction.
 */
export const collectImageUrlsAndDelete = async (
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<string[]> => {
  const images = await tx.productImage.findMany({
    where: { productId },
    select: { url: true },
  });
  await tx.productImage.deleteMany({ where: { productId } });
  return images.map((i) => i.url);
};

export const deleteProductSoft = async (productId: string) => {
  await prisma.product.update({
    where: { id: productId },
    data: { active: false },
  });
};

export const deleteProductHard = async (productId: string): Promise<string[]> => {
  return prisma.$transaction(async (tx) => {
    const urls = await collectImageUrlsAndDelete(tx, productId);
    await tx.cartItem.deleteMany({ where: { productId } });
    await tx.product.delete({ where: { id: productId } });
    return urls;
  });
};

export const ensureCategoryExistsPublic = assertCategoryExists;

// Re-export for testing convenience
export { CATEGORY_NOT_FOUND_MSG };

// Defensive helper exposed for the image add route.
export const countImages = async (productId: string): Promise<number> => {
  return prisma.productImage.count({ where: { productId } });
};

export const addImages = async (
  productId: string,
  urls: string[],
): Promise<void> => {
  if (urls.length === 0) return;
  const startOrder = await prisma.productImage.aggregate({
    where: { productId },
    _max: { order: true },
  });
  const base = (startOrder._max.order ?? -1) + 1;
  await prisma.productImage.createMany({
    data: urls.map((url, idx) => ({
      productId,
      url,
      order: base + idx,
    })),
  });
};

export const removeImage = async (
  productId: string,
  imageId: string,
): Promise<string> => {
  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
  });
  if (!image || image.productId !== productId) {
    throw new NotFoundError("Image not found on this product");
  }
  const remaining = await prisma.productImage.count({
    where: { productId, NOT: { id: imageId } },
  });
  if (remaining === 0) {
    throw new ConflictError(
      "Cannot remove the last image. Add another first.",
    );
  }
  await prisma.productImage.delete({ where: { id: imageId } });
  return image.url;
};
