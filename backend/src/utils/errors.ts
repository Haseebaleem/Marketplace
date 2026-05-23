import type { ErrorCode } from "@marketplace/shared";

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: ErrorDetail[] | undefined;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class SuspendedAccountError extends AppError {
  constructor(message = "Your account has been suspended") {
    super(message, "SUSPENDED_ACCOUNT", 403);
  }
}
