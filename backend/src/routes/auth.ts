import { Router } from "express";
import { loginSchema, registerSchema } from "@marketplace/shared";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { authRateLimiter } from "../middleware/rateLimit";
import * as authService from "../services/auth.service";
import { createAuditLog, extractIp } from "../services/audit.service";
import { enqueueEmail, welcomeEmail } from "../services/email.service";

export const authRouter = Router();

authRouter.post(
  "/register",
  authRateLimiter,
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      await enqueueEmail({
        ...welcomeEmail(result.user.name, result.user.role),
        to: result.user.email,
      });
      await createAuditLog({
        userId: result.user.id,
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: result.user.id,
        metadata: { email: result.user.email, role: result.user.role },
        ipAddress: extractIp(req),
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      await createAuditLog({
        userId: result.user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: result.user.id,
        ipAddress: extractIp(req),
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    if (!req.user) {
      res.status(401).end();
      return;
    }
    const user = await authService.getCurrentUser(req.user.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
