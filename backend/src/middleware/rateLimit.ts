import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please wait before trying again.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});
