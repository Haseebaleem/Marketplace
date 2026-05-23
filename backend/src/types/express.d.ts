import type { Role } from "@marketplace/shared";

declare global {
  namespace Express {
    interface AuthenticatedUser {
      id: string;
      role: Role;
    }
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
