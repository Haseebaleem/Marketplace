import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { AppError } from "../utils/errors";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: err.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    });
    return;
  }

  logger.error("Unhandled error", {
    err: err instanceof Error ? err.stack : err,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
};

export const notFoundHandler: import("express").RequestHandler = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    code: "NOT_FOUND",
  });
};
