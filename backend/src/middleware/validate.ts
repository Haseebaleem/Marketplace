import type { RequestHandler } from "express";
import type { ZodTypeAny, z } from "zod";

type Source = "body" | "query" | "params";

export const validate = <S extends ZodTypeAny>(
  schema: S,
  source: Source = "body",
): RequestHandler => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Re-assign parsed (coerced/transformed) value back to request.
    (req as unknown as Record<Source, z.infer<S>>)[source] = result.data;
    next();
  };
};
