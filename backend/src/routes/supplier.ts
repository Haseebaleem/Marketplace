import { Router } from "express";
import { supplierProfileUpdateSchema } from "@marketplace/shared";
import { requireAuth, requireRole } from "../middleware/auth";
import { uploadLogo } from "../middleware/upload";
import { validate } from "../middleware/validate";
import { createAuditLog, extractIp } from "../services/audit.service";
import * as supplierService from "../services/supplier.service";
import {
  LOGOS_DIR,
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
