import { Router } from "express";
import { loginSchema, registerSchema } from "@marketplace/shared";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import * as authService from "../services/auth.service";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  async (req, res, next) => {
    try {
      const result = await authService.register(req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

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
