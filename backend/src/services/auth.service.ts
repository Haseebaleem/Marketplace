import bcrypt from "bcryptjs";
import type { Prisma, User } from "@prisma/client";
import type { LoginInput, RegisterInput } from "@marketplace/shared";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { signToken } from "../utils/jwt";
import { uniqueSlug } from "../utils/slug";
import {
  ConflictError,
  SuspendedAccountError,
  UnauthorizedError,
} from "../utils/errors";

const toAuthUser = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: u.emailVerified,
  suspended: u.suspended,
  createdAt: u.createdAt.toISOString(),
});

export interface AuthResult {
  token: string;
  user: ReturnType<typeof toAuthUser>;
}

export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const created = await prisma.$transaction(async (tx) => {
    const userData: Prisma.UserCreateInput = {
      email: input.email,
      password: passwordHash,
      name: input.name,
      role: input.role,
    };

    if (input.role === "SUPPLIER") {
      const slug = await uniqueSlug(input.storeName, async (candidate) => {
        const found = await tx.supplierProfile.findUnique({
          where: { storeSlug: candidate },
          select: { id: true },
        });
        return Boolean(found);
      });
      userData.supplierProfile = {
        create: { storeName: input.storeName, storeSlug: slug },
      };
    } else {
      userData.buyerProfile = { create: {} };
    }

    return tx.user.create({ data: userData });
  });

  const token = signToken({ sub: created.id, role: created.role });
  return { token, user: toAuthUser(created) };
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Constant-time-ish: still hash to avoid revealing whether the email exists.
    await bcrypt.compare(input.password, "$2a$10$invalidsaltsaltsaltsaltsaltsx");
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.suspended) {
    throw new SuspendedAccountError();
  }

  const token = signToken({ sub: user.id, role: user.role });
  return { token, user: toAuthUser(user) };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      supplierProfile: true,
      buyerProfile: true,
    },
  });
  if (!user) {
    throw new UnauthorizedError("Account no longer exists");
  }
  return {
    ...toAuthUser(user),
    supplierProfile: user.supplierProfile
      ? {
          storeName: user.supplierProfile.storeName,
          storeSlug: user.supplierProfile.storeSlug,
          description: user.supplierProfile.description,
          logoUrl: user.supplierProfile.logoUrl,
        }
      : null,
    buyerProfile: user.buyerProfile
      ? {
          phone: user.buyerProfile.phone,
          defaultAddress: user.buyerProfile.defaultAddress,
        }
      : null,
  };
};
