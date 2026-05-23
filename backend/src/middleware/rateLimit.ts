import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const baseAuthLimiter = () =>
  rateLimit({
    windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
    limit: env.RATE_LIMIT_AUTH_MAX,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many attempts. Please wait before trying again.",
      code: "RATE_LIMIT_EXCEEDED",
    },
  });

// Separate instances → independent counters per route so a flood on
// /register cannot lock out legitimate /login traffic.
export const registerRateLimiter = baseAuthLimiter();
export const loginRateLimiter = baseAuthLimiter();
