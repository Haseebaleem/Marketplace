import { Router } from "express";
import {
  MAX_PRODUCT_IMAGES,
  paginationQuerySchema,
  productCreateBodySchema,
  productUpdateBodySchema,
  supplierProfileUpdateSchema,
} from "@marketplace/shared";
import { requireAuth, requireRole } from "../middleware/auth";
import { uploadLogo, uploadProductImages } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { requireProductOwnership } from "../middleware/productOwnership";
import { createAuditLog, extractIp } from "../services/audit.service";
import * as supplierService from "../services/supplier.service";
import * as productService from "../services/product.service";
import { ValidationError } from "../utils/errors";
import {
  LOGOS_DIR,
  PRODUCTS_DIR,
  deleteImageFiles,
  processImage,
} from "../utils/images";

export const supplierRouter = Router();

supplierRouter.use(requireAuth, requireRole("SUPPLIER"));

supplierRouter.get("/profile", async (req, res, next) => {
  try {
    const profile = await supplierService.getProfile(req.user!.id);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

supplierRouter.patch(
  "/profile",
  uploadLogo,
  validate(supplierProfileUpdateSchema),
  async (req, res, next) => {
    try {
      const input: supplierService.ProfileUpdateInput = { ...req.body };

      if (req.file) {
        const processed = await processImage({
          buffer: req.file.buffer,
          outputDir: LOGOS_DIR,
          maxWidth: 400,
        });
        input.logoUrl = processed.url;
      }

      const result = await supplierService.updateProfile(req.user!.id, input);

      if (
        result.changed.includes("logoUrl") &&
        result.previousLogoUrl &&
        result.previousLogoUrl !== result.profile.logoUrl
      ) {
        try {
          await deleteImageFiles(result.previousLogoUrl);
        } catch {
          // Non-fatal; new logo is already saved.
        }
      }

      if (result.changed.length > 0) {
        await createAuditLog({
          userId: req.user!.id,
          action: "SUPPLIER_PROFILE_UPDATED",
          entityType: "SupplierProfile",
          entityId: result.profile.id,
          metadata: { changed: result.changed },
          ipAddress: extractIp(req),
        });
      }

      res.json({ profile: result.profile, changed: result.changed });
    } catch (err) {
      next(err);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Product CRUD
// ──────────────────────────────────────────────────────────────────────────

supplierRouter.get("/products", async (req, res, next) => {
  try {
    const query = paginationQuerySchema.parse(req.query);
    const result = await productService.listSupplierProducts({
      supplierId: req.user!.id,
      page: query.page,
      limit: query.limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

supplierRouter.get(
  "/products/:id",
  requireProductOwnership,
  async (req, res, next) => {
    try {
      const product = await productService.getSupplierProductById(
        req.user!.id,
        req.params.id!,
      );
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

supplierRouter.post(
  "/products",
  uploadProductImages,
  validate(productCreateBodySchema),
  async (req, res, next) => {
    const processed: { url: string }[] = [];
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        throw new ValidationError("At least one image is required", [
          { field: "images", message: "At least one image is required" },
        ]);
      }
      if (files.length > MAX_PRODUCT_IMAGES) {
        throw new ValidationError(
          `At most ${MAX_PRODUCT_IMAGES} images are allowed`,
          [
            {
              field: "images",
              message: `At most ${MAX_PRODUCT_IMAGES} images are allowed`,
            },
          ],
        );
      }

      for (const file of files) {
        const result = await processImage({
          buffer: file.buffer,
          outputDir: PRODUCTS_DIR,
          maxWidth: 1200,
          generateThumbnail: true,
        });
        processed.push({ url: result.url });
      }

      const created = await productService.createProduct({
        ...req.body,
        supplierId: req.user!.id,
        imageUrls: processed.map((p) => p.url),
      });

      await createAuditLog({
        userId: req.user!.id,
        action: "PRODUCT_CREATED",
        entityType: "Product",
        entityId: created.id,
        metadata: {
          name: created.name,
          imageCount: created.images.length,
        },
        ipAddress: extractIp(req),
      });

      res.status(201).json({ product: created });
    } catch (err) {
      // Clean up any files we wrote before the DB rejected the create.
      await Promise.allSettled(
        processed.map((p) => deleteImageFiles(p.url)),
      );
      next(err);
    }
  },
);

supplierRouter.patch(
  "/products/:id",
  requireProductOwnership,
  validate(productUpdateBodySchema),
  async (req, res, next) => {
    try {
      const result = await productService.updateProduct({
        ...req.body,
        productId: req.params.id!,
      });
      if (result.changed.length > 0) {
        await createAuditLog({
          userId: req.user!.id,
          action: "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: result.product.id,
          metadata: { changed: result.changed },
          ipAddress: extractIp(req),
        });
      }
      res.json({ product: result.product, changed: result.changed });
    } catch (err) {
      next(err);
    }
  },
);

supplierRouter.delete(
  "/products/:id",
  requireProductOwnership,
  async (req, res, next) => {
    try {
      const productId = req.params.id!;
      const referenced = await productService.productHasOrders(productId);

      let deletionMode: "soft" | "hard";
      let imageUrls: string[] = [];
      if (referenced) {
        await productService.deleteProductSoft(productId);
        deletionMode = "soft";
      } else {
        imageUrls = await productService.deleteProductHard(productId);
        deletionMode = "hard";
        await Promise.allSettled(imageUrls.map((url) => deleteImageFiles(url)));
      }

      await createAuditLog({
        userId: req.user!.id,
        action: "PRODUCT_DELETED",
        entityType: "Product",
        entityId: productId,
        metadata: { mode: deletionMode },
        ipAddress: extractIp(req),
      });

      res.json({ deleted: true, mode: deletionMode });
    } catch (err) {
      next(err);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// Product image management
// ──────────────────────────────────────────────────────────────────────────

supplierRouter.post(
  "/products/:id/images",
  requireProductOwnership,
  uploadProductImages,
  async (req, res, next) => {
    const processed: { url: string }[] = [];
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) {
        throw new ValidationError("No images provided");
      }
      const existing = await productService.countImages(req.params.id!);
      if (existing + files.length > MAX_PRODUCT_IMAGES) {
        throw new ValidationError(
          `Adding ${files.length} would exceed the ${MAX_PRODUCT_IMAGES}-image limit (already ${existing})`,
        );
      }
      for (const file of files) {
        const result = await processImage({
          buffer: file.buffer,
          outputDir: PRODUCTS_DIR,
          maxWidth: 1200,
          generateThumbnail: true,
        });
        processed.push({ url: result.url });
      }
      await productService.addImages(
        req.params.id!,
        processed.map((p) => p.url),
      );
      await createAuditLog({
        userId: req.user!.id,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: req.params.id!,
        metadata: { addedImages: processed.length },
        ipAddress: extractIp(req),
      });
      res.status(201).json({ added: processed });
    } catch (err) {
      await Promise.allSettled(
        processed.map((p) => deleteImageFiles(p.url)),
      );
      next(err);
    }
  },
);

supplierRouter.delete(
  "/products/:id/images/:imageId",
  requireProductOwnership,
  async (req, res, next) => {
    try {
      const url = await productService.removeImage(
        req.params.id!,
        req.params.imageId!,
      );
      await deleteImageFiles(url).catch(() => undefined);
      await createAuditLog({
        userId: req.user!.id,
        action: "PRODUCT_UPDATED",
        entityType: "Product",
        entityId: req.params.id!,
        metadata: { removedImage: req.params.imageId! },
        ipAddress: extractIp(req),
      });
      res.json({ removed: true });
    } catch (err) {
      next(err);
    }
  },
);
