import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "@marketplace/shared";

export interface JwtPayload {
  sub: string;
  role: Role;
}

export const signToken = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token payload");
  }
  const { sub, role } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string") {
    throw new Error("Invalid token claims");
  }
  return { sub, role: role as Role };
};
